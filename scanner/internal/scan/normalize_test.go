package scan

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"leaaf.green/scanner/internal/payload"
)

var testMeta = Meta{ScannerVersion: "0.1.0-test", ScannedAt: time.Date(2026, 11, 20, 10, 30, 0, 0, time.FixedZone("CET", 3600))}

func loadRaw(t *testing.T, name string) Raw {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	var raw Raw
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return raw
}

func asJSON(t *testing.T, v any) map[string]any {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func equalJSON(t *testing.T, got, want any) {
	t.Helper()
	g, _ := json.MarshalIndent(got, "", "  ")
	w, _ := json.MarshalIndent(want, "", "  ")
	if string(g) != string(w) {
		t.Errorf("payload mismatch\n got: %s\nwant: %s", g, w)
	}
}

// AC-002 and AC-013: a complete laptop reading normalizes to the expected payload.
func TestNormalizeCompleteLaptop(t *testing.T) {
	got := Normalize(loadRaw(t, "laptop.raw.json"), testMeta)
	data, err := os.ReadFile(filepath.Join("testdata", "laptop.expected.json"))
	if err != nil {
		t.Fatal(err)
	}
	var want map[string]any
	if err := json.Unmarshal(data, &want); err != nil {
		t.Fatal(err)
	}
	equalJSON(t, asJSON(t, got), want)
}

// AC-003: failed battery and disk-health sources give nulls and a partial scan, and every
// other field is still populated.
func TestNormalizePartialSources(t *testing.T) {
	got := Normalize(loadRaw(t, "partial.raw.json"), testMeta)
	if got.ScanStatus != "partial" {
		t.Errorf("scan_status = %q, want partial", got.ScanStatus)
	}
	b := got.Battery
	if b.Present == nil || !*b.Present {
		t.Errorf("battery.present = %v, want true (Win32_Battery found one)", b.Present)
	}
	if b.DesignCapacityMWh != nil || b.FullChargeCapacityMWh != nil || b.HealthPercent != nil || b.CycleCount != nil {
		t.Errorf("battery values should be null when their sources fail: %+v", b)
	}
	if got.Storage == nil || len(*got.Storage) != 1 || (*got.Storage)[0].Health != "unknown" {
		t.Fatalf("storage = %+v, want one disk with unknown health", got.Storage)
	}
	d := (*got.Storage)[0]
	if d.Media != "hdd" || d.Bus != "sata" || d.CapacityGB == nil || *d.CapacityGB != 500 {
		t.Errorf("disk = %+v", d)
	}
	if got.TPM.Present != nil || got.Firmware.SecureBootEnabled != nil {
		t.Errorf("TPM and Secure Boot should be null when unreadable: %+v %+v", got.TPM, got.Firmware)
	}
	// Placeholder firmware strings are reported as null.
	if got.Identity.SystemSKU != nil || got.Identity.ProductVersion != nil || got.Identity.SystemFamily != nil {
		t.Errorf("placeholders not nulled: %+v", got.Identity)
	}
	for name, v := range map[string]any{
		"manufacturer": got.Identity.Manufacturer, "model": got.Identity.Model, "cpu": got.CPU.Name,
		"cores": got.CPU.Cores, "ram": got.Memory.TotalGB, "os": got.OS.Caption, "bios": got.Firmware.BIOSReleaseDate,
	} {
		if isNilPtr(v) {
			t.Errorf("%s should still be populated", name)
		}
	}
	if *got.Memory.TotalGB != 8 || *got.Memory.Type != "ddr4" || *got.Memory.SpeedMTs != 2133 {
		t.Errorf("memory = total %v type %v speed %v", *got.Memory.TotalGB, *got.Memory.Type, *got.Memory.SpeedMTs)
	}
}

func isNilPtr(v any) bool {
	switch p := v.(type) {
	case *string:
		return p == nil
	case *int:
		return p == nil
	case *float64:
		return p == nil
	}
	return false
}

// A desktop has no battery: present is false and every battery value is null.
func TestNormalizeDesktopWithoutBattery(t *testing.T) {
	got := Normalize(loadRaw(t, "desktop.raw.json"), testMeta)
	b := got.Battery
	if b.Present == nil || *b.Present {
		t.Fatalf("battery.present = %v, want false", b.Present)
	}
	if b.DesignCapacityMWh != nil || b.HealthPercent != nil || b.CycleCount != nil {
		t.Errorf("battery values must be null without a battery: %+v", b)
	}
	if got.Identity.Manufacturer != nil || got.Identity.Model != nil {
		t.Errorf("board placeholders should be null: %+v", got.Identity)
	}
	if *got.Identity.FormFactor != "desktop" || *got.Firmware.FirmwareType != "legacy_bios" || *got.Firmware.SecureBootEnabled {
		t.Errorf("unexpected identity/firmware: %+v %+v", got.Identity, got.Firmware)
	}
	if got.GPUs != nil {
		t.Errorf("gpus = %v, want null when the query failed", *got.GPUs)
	}
	if (*got.Storage)[0].Health != "warning" || *got.Memory.SlotsTotal != 4 {
		t.Errorf("storage/memory: %+v %+v", *got.Storage, got.Memory)
	}
	if got.ScanStatus != "partial" {
		t.Errorf("scan_status = %q", got.ScanStatus)
	}
}

// AC-004: identifiers present in the raw readings never reach the serialized payload.
func TestPayloadContainsNoIdentifiers(t *testing.T) {
	scan := Normalize(loadRaw(t, "planted.raw.json"), testMeta)
	out, err := json.Marshal(scan)
	if err != nil {
		t.Fatal(err)
	}
	text := strings.ToLower(string(out))
	for _, planted := range []string{
		"planted", "7f3a", "1b2c3d4e", "de:ad:be:ef", "192.0.2.77", "bfebfbff", "00330", "01av",
	} {
		if strings.Contains(text, planted) {
			t.Errorf("payload contains planted identifier %q:\n%s", planted, out)
		}
	}
	// The real values are still there, so the test is not passing on an empty payload.
	if !strings.Contains(string(out), "20L5CTO1WW") || scan.Battery.CycleCount == nil {
		t.Errorf("expected model and battery values in %s", out)
	}
}

// AC-013: the FR-013 fields are filled when their sources answer and null when access is denied.
func TestExtraFieldsPopulatedOrNull(t *testing.T) {
	full := Normalize(loadRaw(t, "laptop.raw.json"), testMeta)
	m := full.Memory
	checks := map[string]bool{
		"memory.type":        m.Type != nil && *m.Type == "ddr4",
		"memory.speed_mts":   m.SpeedMTs != nil && *m.SpeedMTs == 2400,
		"memory.slots_total": m.SlotsTotal != nil && *m.SlotsTotal == 2,
		"memory.slots_used":  m.SlotsUsed != nil && *m.SlotsUsed == 1,
		"tpm.present":        full.TPM.Present != nil && *full.TPM.Present,
		"tpm.spec_version":   full.TPM.SpecVersion != nil && *full.TPM.SpecVersion == "2.0",
		"secure_boot":        full.Firmware.SecureBootEnabled != nil && *full.Firmware.SecureBootEnabled,
		"firmware_type":      full.Firmware.FirmwareType != nil && *full.Firmware.FirmwareType == "uefi",
		"cycle_count":        full.Battery.CycleCount != nil && *full.Battery.CycleCount == 412,
		"gpus":               full.GPUs != nil && len(*full.GPUs) == 1,
	}
	for name, ok := range checks {
		if !ok {
			t.Errorf("%s not populated as expected", name)
		}
	}

	denied := Raw{} // every source failed
	got := Normalize(denied, testMeta)
	if got.Memory.Type != nil || got.Memory.SlotsTotal != nil || got.TPM.Present != nil || got.Firmware.SecureBootEnabled != nil ||
		got.Firmware.FirmwareType != nil || got.Battery.CycleCount != nil || got.GPUs != nil || got.Storage != nil {
		t.Errorf("fields should be null when every source fails: %+v", got)
	}
	if got.ScanStatus != "partial" || got.SchemaVersion != payload.SchemaVersion {
		t.Errorf("an empty scan still succeeds as partial, got %q", got.ScanStatus)
	}
}

func TestTPMQueryWithNoRowsMeansAbsent(t *testing.T) {
	got := Normalize(Raw{TPM: &[]Tpm{}}, testMeta)
	if got.TPM.Present == nil || *got.TPM.Present {
		t.Errorf("tpm.present = %v, want false", got.TPM.Present)
	}
}

func TestSlotCountContradictingModulesIsDropped(t *testing.T) {
	two, one, sys := uint32(2), uint32(1), uint16(3)
	size := uint64(4 << 30)
	raw := Raw{
		Memory:       &[]PhysicalMemory{{Capacity: &size}, {Capacity: &size}},
		MemoryArrays: &[]PhysicalMemoryArray{{MemoryDevices: &one, Use: &sys}},
	}
	if got := Normalize(raw, testMeta).Memory; got.SlotsTotal != nil || *got.SlotsUsed != int(two) {
		t.Errorf("slots = %v/%v, want unknown total and 2 used", got.SlotsTotal, *got.SlotsUsed)
	}
}

func TestParseBatteryReport(t *testing.T) {
	f, err := os.Open(filepath.Join("testdata", "batteryreport.xml"))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	rep, err := ParseBatteryReport(f)
	if err != nil {
		t.Fatal(err)
	}
	if *rep.DesignCapacityMWh != 57000 || *rep.FullChargeCapacityMWh != 41040 || *rep.CycleCount != 412 {
		t.Errorf("report = %d/%d/%d", *rep.DesignCapacityMWh, *rep.FullChargeCapacityMWh, *rep.CycleCount)
	}
	// Battery-report fallback when the root\WMI classes are unreadable.
	got := Normalize(Raw{Batteries: &[]Battery{{}}, BatteryReport: rep}, testMeta)
	if got.Battery.HealthPercent == nil || *got.Battery.HealthPercent != 72 {
		t.Errorf("health from report = %v", got.Battery.HealthPercent)
	}
}
