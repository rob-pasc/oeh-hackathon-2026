package scan

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

// loadTree reads a recorded file tree: "-- path --" starts a file whose content follows, and
// "-- path -> target --" is a symbolic link. Lines starting with "#" before the first file are
// comments.
func loadTree(t *testing.T, name string) fstest.MapFS {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", "linux", name))
	if err != nil {
		t.Fatal(err)
	}
	tree := fstest.MapFS{}
	var cur string
	var buf strings.Builder
	flush := func() {
		if cur != "" && tree[cur] == nil {
			tree[cur] = &fstest.MapFile{Data: []byte(buf.String())}
		}
		buf.Reset()
	}
	sc := bufio.NewScanner(bytes.NewReader(data))
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "-- ") && strings.HasSuffix(line, " --") {
			flush()
			spec := strings.TrimSuffix(strings.TrimPrefix(line, "-- "), " --")
			if from, to, ok := strings.Cut(spec, " -> "); ok {
				tree[from] = &fstest.MapFile{Data: []byte(to), Mode: fs.ModeSymlink}
				cur = ""
				continue
			}
			cur = spec
			continue
		}
		if cur != "" {
			buf.WriteString(line + "\n")
		}
	}
	flush()
	return tree
}

func TestReadLinuxLaptop(t *testing.T) {
	tree := loadTree(t, "laptop.txt")
	tree[secureBootVar] = &fstest.MapFile{Data: []byte{0x06, 0, 0, 0, 1}}
	raw, notes := ReadLinux(tree)
	if len(notes) != 0 {
		t.Errorf("notes: %v", notes)
	}
	got := raw.Payload(testMeta)

	str := func(p *string) string {
		if p == nil {
			return "<nil>"
		}
		return *p
	}
	checks := map[string][2]string{
		"manufacturer":    {str(got.Identity.Manufacturer), "LENOVO"},
		"model":           {str(got.Identity.Model), "21SXCTO1WW"},
		"product version": {str(got.Identity.ProductVersion), "ThinkPad E14 Gen 7"},
		"form factor":     {str(got.Identity.FormFactor), "laptop"},
		"os":              {str(got.OS.Caption) + " / " + str(got.OS.Build), "Fedora Linux 45 (KDE Plasma Desktop Edition) / 45"},
		"family":          {got.OS.Family, "linux"},
		"bios date":       {str(got.Firmware.BIOSReleaseDate), "2025-08-20"},
		"firmware":        {str(got.Firmware.FirmwareType), "uefi"},
		"tpm":             {str(got.TPM.SpecVersion), "2.0"},
		"cpu":             {str(got.CPU.Name), "Intel(R) Core(TM) Ultra 5 225H"},
	}
	for name, c := range checks {
		if c[0] != c[1] {
			t.Errorf("%s = %q, want %q", name, c[0], c[1])
		}
	}
	if got.Firmware.SecureBootEnabled == nil || !*got.Firmware.SecureBootEnabled {
		t.Error("Secure Boot should be enabled")
	}
	if *got.CPU.Cores != 3 || *got.CPU.Threads != 4 {
		t.Errorf("cores/threads = %d/%d, want 3/4", *got.CPU.Cores, *got.CPU.Threads)
	}
	if *got.Memory.TotalGB != 32 {
		t.Errorf("memory = %v GiB, want 32 (31.1 GiB online, rounded up)", *got.Memory.TotalGB)
	}
	// Only the internal NVMe drive: the Thunderbolt NVMe, USB stick, SD card, loop and zram
	// devices are external or virtual (FR-009).
	if got.Storage == nil || len(*got.Storage) != 1 {
		t.Fatalf("storage = %+v, want one internal drive", got.Storage)
	}
	if d := (*got.Storage)[0]; d.Media != "ssd" || d.Bus != "nvme" || *d.CapacityGB != 512 || d.Health != "unknown" {
		t.Errorf("drive = %+v", d)
	}
	b := got.Battery
	if !*b.Present || *b.DesignCapacityMWh != 64000 || *b.FullChargeCapacityMWh != 62990 || *b.HealthPercent != 98.4 || *b.CycleCount != 61 {
		t.Errorf("battery = %+v (the mouse battery must not count)", b)
	}
	if got.GPUs == nil || strings.Join(*got.GPUs, ",") != "Intel Arc Pro 130T/140T" {
		t.Errorf("gpus = %v", got.GPUs)
	}
	// Without the root helper, RAM type, speed and slots are unknown, so the scan is partial.
	if got.ScanStatus != "partial" || got.Memory.Type != nil || got.Memory.SlotsTotal != nil {
		t.Errorf("status %s, memory %+v", got.ScanStatus, got.Memory)
	}
}

func TestLinuxPayloadHasNoPlantedIdentifiers(t *testing.T) {
	raw, _ := ReadLinux(loadTree(t, "laptop.txt"))
	data, _ := json.Marshal(raw.Payload(testMeta))
	for _, planted := range []string{"PLANTED", "4c4c4544", "S6P7NS0T", "4711"} {
		if bytes.Contains(bytes.ToLower(data), bytes.ToLower([]byte(planted))) {
			t.Errorf("payload contains %q: %s", planted, data)
		}
	}
	// The reader never stores a DMI key outside the allowlist.
	for k := range raw.DMI {
		if strings.Contains(k, "serial") || strings.Contains(k, "uuid") {
			t.Errorf("read DMI %s", k)
		}
	}
}

func TestLinuxWithRootHelper(t *testing.T) {
	raw, _ := ReadLinux(loadTree(t, "laptop.txt"))
	raw.SecureBoot = ptr(true)
	mem, err := ParseSMBIOS(smbiosTable(t))
	if err != nil {
		t.Fatal(err)
	}
	raw.Privileged = &Privileged{Memory: &mem, DiskHealth: map[string]string{"nvme0n1": "warning", "sda": "unhealthy"}}
	got := raw.Payload(testMeta)
	m := got.Memory
	if *m.TotalGB != 24 || *m.Type != "ddr5" || *m.SpeedMTs != 5600 || *m.SlotsTotal != 2 || *m.SlotsUsed != 2 {
		t.Errorf("memory = total %v type %v speed %v slots %v/%v", *m.TotalGB, *m.Type, *m.SpeedMTs, *m.SlotsUsed, *m.SlotsTotal)
	}
	if (*got.Storage)[0].Health != "warning" {
		t.Errorf("health = %s", (*got.Storage)[0].Health)
	}
	// Linux has no Windows display version (FR-018); everything else is known now.
	if got.ScanStatus != "complete" {
		data, _ := json.Marshal(got)
		t.Errorf("status = %s: %s", got.ScanStatus, data)
	}
}

func TestReadLinuxMissingSources(t *testing.T) {
	raw, notes := ReadLinux(fstest.MapFS{"proc/meminfo": {Data: []byte("MemTotal: 7863412 kB\n")}})
	got := raw.Payload(testMeta)
	if len(notes) == 0 || got.ScanStatus != "partial" {
		t.Errorf("notes %v, status %s", notes, got.ScanStatus)
	}
	if got.Storage != nil || got.Battery.Present != nil || got.GPUs != nil || got.TPM.Present != nil || got.Firmware.FirmwareType != nil {
		t.Errorf("unreadable sources must be null: %+v", got)
	}
	// MemTotal only: 7.5 GiB visible rounds up to 8.
	if *got.Memory.TotalGB != 8 {
		t.Errorf("memory = %v", *got.Memory.TotalGB)
	}
}

func TestLinuxDesktopWithoutBattery(t *testing.T) {
	tree := loadTree(t, "laptop.txt")
	for k := range tree {
		if strings.HasPrefix(k, "sys/class/power_supply/BAT0") {
			delete(tree, k)
		}
	}
	raw, _ := ReadLinux(tree)
	b := raw.Payload(testMeta).Battery
	if b.Present == nil || *b.Present || b.DesignCapacityMWh != nil {
		t.Errorf("battery = %+v, want present=false and nulls", b)
	}
}

func TestBatteryInChargeUnits(t *testing.T) {
	// Some drivers report µAh; the design voltage converts them to energy.
	raw := RawLinux{Batteries: &[]LinuxBattery{{
		ChargeFullDesign: ptr(uint64(4000000)), ChargeFull: ptr(uint64(3000000)), VoltageMinDesign: ptr(uint64(11400000)),
		CycleCount: ptr(uint64(0)),
	}}}
	b := raw.battery()
	if *b.DesignCapacityMWh != 45600 || *b.FullChargeCapacityMWh != 34200 || *b.HealthPercent != 75 || b.CycleCount != nil {
		t.Errorf("battery = %+v", b)
	}
}

// smbiosTable builds a small SMBIOS table: one system memory array with two slots, two DDR5
// modules (8 and 16 GiB, one with the extended size field), and strings holding a planted
// serial number that the parser must never read.
func smbiosTable(t *testing.T) []byte {
	t.Helper()
	var b bytes.Buffer
	le := binary.LittleEndian
	// Type 16, length 0x17.
	a := make([]byte, 0x17)
	a[0], a[1] = 16, 0x17
	a[0x05] = 3 // system memory
	le.PutUint16(a[0x0D:], 2)
	b.Write(a)
	b.Write([]byte{0, 0})
	module := func(sizeField uint16, ext uint32, speed, conf uint16) {
		m := make([]byte, 0x28)
		m[0], m[1] = 17, 0x28
		le.PutUint16(m[0x0C:], sizeField)
		m[0x12] = 34 // DDR5
		le.PutUint16(m[0x15:], speed)
		m[0x18] = 3 // serial number: string 3
		le.PutUint32(m[0x1C:], ext)
		le.PutUint16(m[0x20:], conf)
		b.Write(m)
		b.WriteString("DIMM A\x00BANK 0\x00PLANTED-DIMM-SERIAL\x00\x00")
	}
	module(8192, 0, 5600, 5600)
	module(0x7FFF, 16384, 6400, 5600)
	// An empty slot.
	empty := make([]byte, 0x28)
	empty[0], empty[1] = 17, 0x28
	b.Write(empty)
	b.Write([]byte{0, 0})
	b.Write([]byte{127, 4, 0, 0, 0, 0})
	return b.Bytes()
}

func TestParseSMBIOS(t *testing.T) {
	mem, err := ParseSMBIOS(smbiosTable(t))
	if err != nil {
		t.Fatal(err)
	}
	if len(mem.Modules) != 2 || mem.Modules[1].SizeMiB != 16384 || *mem.SlotsTotal != 2 {
		t.Errorf("parsed %+v", mem)
	}
	data, _ := json.Marshal(mem)
	if bytes.Contains(data, []byte("PLANTED")) || bytes.Contains(data, []byte("DIMM")) {
		t.Errorf("strings leaked: %s", data)
	}
	if _, err := ParseSMBIOS([]byte{17, 200, 0, 0}); err == nil {
		t.Error("accepted a structure longer than the table")
	}
}
