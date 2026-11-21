//go:build darwin

package collect

import (
	"context"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"leaaf.green/scanner/internal/scan"
)

// system_profiler takes a few seconds, mostly for the displays section.
const profilerTimeout = 30 * time.Second

// Collect reads the macOS sources as the signed-in user; none of them needs administrator
// rights (feature 007 FR-001, FR-004). A failing tool leaves its fields null.
// progress receives the scan step IDs of shared/src/session.ts, each with the state "running";
// the web app counts a step as done when the next one starts (feature 006 FR-041).
func Collect(progress func(step, state string)) (scan.Reading, []string) {
	var raw scan.RawDarwin
	var notes []string
	note := func(source string, err error) {
		if err != nil {
			notes = append(notes, fmt.Sprintf("%s: %v", source, err))
		}
	}

	progress("started", scan.StepRunning)
	if out, err := tool(10*time.Second, "/usr/bin/sw_vers"); err == nil {
		raw.ProductName, raw.ProductVersion, raw.BuildVersion = scan.ParseSwVers(out)
	} else {
		note("sw_vers", err)
	}

	progress("cpu_memory", scan.StepRunning)
	raw.CPUBrand = sysctlString("machdep.cpu.brand_string", note)
	raw.PhysicalCPU = sysctlInt("hw.physicalcpu", note)
	raw.LogicalCPU = sysctlInt("hw.logicalcpu", note)
	if v := sysctlString("hw.memsize", note); v != nil {
		if n, err := strconv.ParseUint(*v, 10, 64); err == nil {
			raw.MemSize = &n
		}
	}

	progress("storage", scan.StepRunning)
	args := append([]string{"-json"}, scan.ProfilerDataTypes...)
	if out, err := tool(profilerTimeout, "/usr/sbin/system_profiler", args...); err == nil {
		p, err := scan.ParseProfiler(out)
		note("system_profiler", err)
		raw.Profiler = p
	} else {
		note("system_profiler", err)
	}

	progress("battery", scan.StepRunning)
	if out, err := tool(10*time.Second, "/usr/sbin/ioreg", "-a", "-r", "-c", "AppleSmartBattery"); err == nil {
		raw.Battery = scan.ParseIORegBattery(out)
	} else {
		note("ioreg", err)
	}
	return raw, notes
}

// tool runs a system program by its absolute path with a timeout.
func tool(timeout time.Duration, path string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	return exec.CommandContext(ctx, path, args...).Output()
}

func sysctlString(name string, note func(string, error)) *string {
	out, err := tool(5*time.Second, "/usr/sbin/sysctl", "-n", name)
	if err != nil {
		note("sysctl "+name, err)
		return nil
	}
	v := strings.TrimSpace(string(out))
	if v == "" {
		return nil
	}
	return &v
}

func sysctlInt(name string, note func(string, error)) *int {
	v := sysctlString(name, note)
	if v == nil {
		return nil
	}
	n, err := strconv.Atoi(*v)
	if err != nil || n < 1 {
		return nil
	}
	return &n
}
