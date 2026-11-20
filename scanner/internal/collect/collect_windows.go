//go:build windows

package collect

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
	"unsafe"

	"github.com/yusufpapurcu/wmi"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"

	"leaaf.green/scanner/internal/scan"
)

// Each source gets its own deadline; a hanging WMI provider must not stall the whole scan
// (performance target: under 30 seconds).
const sourceTimeout = 10 * time.Second

// PtrNil maps WMI NULL to a nil pointer; AllowMissingFields tolerates providers that lack a
// property, which then stays nil.
var client = &wmi.Client{PtrNil: true, AllowMissingFields: true}

// Collect reads every source. A failing source leaves its field nil and adds a note; it never
// aborts the scan (FR-004). The release exe runs elevated (FR-001), which privileged sources such
// as Win32_Tpm need; a dev build started without elevation still works, those sources just fail.
// progress receives the scan step IDs of shared/src/session.ts: started, cpu_memory, storage, battery.
func Collect(progress func(step string)) (scan.Raw, []string) {
	var raw scan.Raw
	var notes []string
	note := func(source string, err error) {
		if err != nil {
			notes = append(notes, fmt.Sprintf("%s: %v", source, err))
		}
	}

	progress("started")
	raw.ComputerSystem = run[scan.ComputerSystem](queries.ComputerSystem, note)
	raw.Product = run[scan.ComputerSystemProduct](queries.Product, note)
	raw.Enclosure = run[scan.SystemEnclosure](queries.Enclosure, note)
	raw.OS = run[scan.OperatingSystem](queries.OS, note)
	raw.BIOS = run[scan.BIOS](queries.BIOS, note)
	raw.DisplayVersion = displayVersion(note)
	raw.FirmwareType = firmwareType(note)
	raw.SecureBoot = secureBoot(raw.FirmwareType, note)
	raw.TPM = run[scan.Tpm](queries.TPM, note)

	progress("cpu_memory")
	raw.Processors = run[scan.Processor](queries.Processor, note)
	raw.Memory = run[scan.PhysicalMemory](queries.Memory, note)
	raw.MemoryArrays = run[scan.PhysicalMemoryArray](queries.MemoryArray, note)
	raw.Video = run[scan.VideoController](queries.Video, note)

	progress("storage")
	raw.Disks = run[scan.PhysicalDisk](queries.Disk, note)

	progress("battery")
	raw.Batteries = run[scan.Battery](queries.Battery, note)
	if raw.Batteries == nil || len(*raw.Batteries) > 0 {
		raw.BatteryStatic = run[scan.BatteryStaticData](queries.BatteryStatic, note)
		raw.BatteryFull = run[scan.BatteryFullCharged](queries.BatteryFull, note)
		raw.BatteryCycles = run[scan.BatteryCycleCount](queries.BatteryCycles, note)
		raw.BatteryReport = batteryReport(note)
	}
	return raw, notes
}

// run executes one WMI query with a timeout. A nil result means the source failed.
func run[T any](q query, note func(string, error)) *[]T {
	type result struct {
		rows []T
		err  error
	}
	done := make(chan result, 1)
	go func() {
		var rows []T
		err := guarded(func() error { return client.Query(q.wql, &rows, nil, q.namespace) })
		var mismatch *wmi.ErrFieldMismatch
		if errors.As(err, &mismatch) {
			err = nil // a property type we cannot read stays nil; the rest is usable
		}
		done <- result{rows, err}
	}()
	select {
	case r := <-done:
		if r.err != nil {
			note(q.wql, r.err)
			return nil
		}
		if r.rows == nil {
			r.rows = []T{}
		}
		return &r.rows
	case <-time.After(sourceTimeout):
		note(q.wql, errors.New("timed out"))
		return nil
	}
}

func displayVersion(note func(string, error)) *string {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows NT\CurrentVersion`, registry.QUERY_VALUE)
	if err != nil {
		note("DisplayVersion", err)
		return nil
	}
	defer k.Close()
	v, _, err := k.GetStringValue("DisplayVersion")
	if err != nil {
		// Windows 10 before 20H2 only has ReleaseId.
		if v, _, err = k.GetStringValue("ReleaseId"); err != nil {
			note("DisplayVersion", err)
			return nil
		}
	}
	return &v
}

var procGetFirmwareType = windows.NewLazySystemDLL("kernel32.dll").NewProc("GetFirmwareType")

func firmwareType(note func(string, error)) *string {
	var t uint32
	if r, _, err := procGetFirmwareType.Call(uintptr(unsafe.Pointer(&t))); r == 0 {
		note("GetFirmwareType", err)
		return nil
	}
	var s string
	switch t {
	case 1:
		s = "legacy_bios"
	case 2:
		s = "uefi"
	default:
		return nil
	}
	return &s
}

func secureBoot(fw *string, note func(string, error)) *bool {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\SecureBoot\State`, registry.QUERY_VALUE)
	if err != nil {
		// Legacy BIOS cannot do Secure Boot, so a missing key there means off.
		if errors.Is(err, registry.ErrNotExist) && fw != nil && *fw == "legacy_bios" {
			off := false
			return &off
		}
		note("SecureBoot", err)
		return nil
	}
	defer k.Close()
	v, _, err := k.GetIntegerValue("UEFISecureBootEnabled")
	if err != nil {
		note("SecureBoot", err)
		return nil
	}
	on := v == 1
	return &on
}

// batteryReport runs powercfg into a temporary file, parses only the battery section, and
// deletes the file, which also contains the computer name.
func batteryReport(note func(string, error)) *scan.BatteryReport {
	dir, err := os.MkdirTemp("", "leaaf-")
	if err != nil {
		note("powercfg", err)
		return nil
	}
	defer os.RemoveAll(dir)
	out := filepath.Join(dir, "battery.xml")
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "powercfg", "/batteryreport", "/xml", "/output", out)
	if err := cmd.Run(); err != nil {
		note("powercfg", err)
		return nil
	}
	f, err := os.Open(out)
	if err != nil {
		note("powercfg", err)
		return nil
	}
	defer f.Close()
	rep, err := scan.ParseBatteryReport(f)
	if err != nil {
		note("powercfg", err)
		return nil
	}
	return rep
}
