package scan

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"leaaf.green/scanner/internal/payload"
)

func loadDarwin(t *testing.T, name string) RawDarwin {
	t.Helper()
	read := func(file string) []byte {
		data, err := os.ReadFile(filepath.Join("testdata", "darwin", file))
		if err != nil {
			return nil
		}
		return data
	}
	var raw RawDarwin
	p, err := ParseProfiler(read(name + ".profiler.json"))
	if err != nil {
		t.Fatal(err)
	}
	raw.Profiler = p
	if x := read(name + ".ioreg.xml"); x != nil {
		raw.Battery = ParseIORegBattery(x)
	}
	return raw
}

func TestDarwinAppleSilicon(t *testing.T) {
	raw := loadDarwin(t, "applesilicon")
	raw.ProductName, raw.ProductVersion, raw.BuildVersion = ParseSwVers([]byte("ProductName:\t\tmacOS\nProductVersion:\t\t14.5\nBuildVersion:\t\t23F79\n"))
	raw.CPUBrand, raw.PhysicalCPU, raw.LogicalCPU, raw.MemSize = ptr("Apple M2"), ptr(8), ptr(8), ptr(uint64(8<<30))
	got := raw.Payload(testMeta)

	if *got.Identity.Manufacturer != "Apple Inc." || *got.Identity.Model != "Mac14,2" || *got.Identity.ProductVersion != "MacBook Air" || *got.Identity.FormFactor != "laptop" {
		t.Errorf("identity = %+v", got.Identity)
	}
	if got.OS.Family != "macos" || *got.OS.Caption != "macOS 14.5" || *got.OS.Build != "23F79" {
		t.Errorf("os = %+v", got.OS)
	}
	if *got.Firmware.FirmwareType != "apple" || got.TPM.Present != nil {
		t.Errorf("firmware %+v, tpm %+v", got.Firmware, got.TPM)
	}
	if *got.Memory.TotalGB != 8 || *got.Memory.Type != "lpddr5" || got.Memory.SlotsTotal != nil {
		t.Errorf("memory = %+v", got.Memory)
	}
	// Only the internal drive: the Thunderbolt SSD is detachable (FR-009).
	if got.Storage == nil || len(*got.Storage) != 1 {
		t.Fatalf("storage = %+v", got.Storage)
	}
	if d := (*got.Storage)[0]; d.Media != "ssd" || d.Bus != "nvme" || *d.CapacityGB != 251 || d.Health != "healthy" {
		t.Errorf("drive = %+v", d)
	}
	b := got.Battery
	// 3946 / 4382 mAh; three cells at 12.48 V, so 11.55 V nominal.
	if !*b.Present || *b.HealthPercent != 90.1 || *b.CycleCount != 210 || *b.DesignCapacityMWh != 50612 || *b.FullChargeCapacityMWh != 45576 {
		t.Errorf("battery = present %v health %v cycles %v design %v full %v", *b.Present, *b.HealthPercent, *b.CycleCount, *b.DesignCapacityMWh, *b.FullChargeCapacityMWh)
	}
	if got.GPUs == nil || len(*got.GPUs) != 1 || (*got.GPUs)[0] != "Apple M2" {
		t.Errorf("gpus = %v", got.GPUs)
	}
	// Apple Silicon reports no memory speed, so the scan stays partial on that field alone; the
	// TPM, BIOS date, Secure Boot, display version and slots are not applicable (FR-018).
	if got.ScanStatus != "partial" {
		t.Errorf("status = %s, want partial (no memory speed)", got.ScanStatus)
	}
	got.Memory.SpeedMTs = ptr(6400)
	if payload.Status(got) != "complete" {
		data, _ := json.Marshal(got)
		t.Errorf("with a speed the scan should be complete: %s", data)
	}
}

func TestDarwinIntel(t *testing.T) {
	raw := loadDarwin(t, "intel")
	raw.MemSize = ptr(uint64(8 << 30))
	got := raw.Payload(testMeta)
	if *got.Firmware.FirmwareType != "uefi" {
		t.Errorf("firmware = %v", *got.Firmware.FirmwareType)
	}
	m := got.Memory
	if *m.Type != "lpddr3" || *m.SpeedMTs != 2133 || *m.SlotsTotal != 2 || *m.SlotsUsed != 2 {
		t.Errorf("memory = %+v", m)
	}
	// Older ioreg: MaxCapacity in mAh, no AppleRawMaxCapacity.
	if b := got.Battery; *b.HealthPercent != 74.2 || *b.CycleCount != 512 {
		t.Errorf("battery = %+v", b)
	}
	if (*got.GPUs)[0] != "Intel Iris Plus Graphics 655" {
		t.Errorf("gpus = %v", *got.GPUs)
	}
}

func TestDarwinDesktop(t *testing.T) {
	got := loadDarwin(t, "desktop").Payload(testMeta)
	if *got.Identity.FormFactor != "desktop" || *got.Battery.Present || got.Battery.CycleCount != nil {
		t.Errorf("identity %+v battery %+v", got.Identity, got.Battery)
	}
}

func TestDarwinPayloadHasNoPlantedIdentifiers(t *testing.T) {
	for _, name := range []string{"applesilicon", "intel", "desktop"} {
		data, _ := json.Marshal(loadDarwin(t, name).Payload(testMeta))
		if bytes.Contains(data, []byte("PLANTED")) {
			t.Errorf("%s payload contains a planted identifier: %s", name, data)
		}
	}
}

func TestDarwinNothingReadable(t *testing.T) {
	got := RawDarwin{}.Payload(testMeta)
	if got.Storage != nil || got.Battery.Present != nil || got.GPUs != nil || got.Firmware.FirmwareType != nil || got.ScanStatus != "partial" {
		t.Errorf("unreadable sources must be null: %+v", got)
	}
}

func TestParseIORegBatteryIgnoresNestedDictionaries(t *testing.T) {
	data, _ := os.ReadFile(filepath.Join("testdata", "darwin", "applesilicon.ioreg.xml"))
	b := ParseIORegBattery(data)
	// BatteryData holds DesignCapacity 1; the top-level 4382 must win.
	if b == nil || *b.DesignCapacity != 4382 || *b.RawMaxCapacity != 3946 || *b.Voltage != 12480 {
		t.Fatalf("got %+v", b)
	}
	if ParseIORegBattery([]byte(`<plist><array></array></plist>`)) != nil {
		t.Error("an empty listing means no battery")
	}
}
