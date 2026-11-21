package payload

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// The shared fixtures carry the scan_status that checkDeviceScan in shared/src/invariants.ts
// expects, so agreeing with them keeps Status and NotApplicable in step with the TypeScript
// rule (feature 007 FR-018).
func TestStatusAgreesWithSharedFixtures(t *testing.T) {
	files, _ := filepath.Glob(filepath.Join("..", "..", "..", "shared", "fixtures", "device-scan.*.json"))
	if len(files) < 4 {
		t.Fatalf("expected the Windows, desktop, macOS and Linux fixtures, found %d", len(files))
	}
	for _, f := range files {
		scan := load(t, f)
		if got := Status(scan); got != scan.ScanStatus {
			t.Errorf("%s: Status = %q, fixture says %q", filepath.Base(f), got, scan.ScanStatus)
		}
	}
}

func TestStatusSkipsOnlyFieldsMissingOnTheSystem(t *testing.T) {
	fixture := func(name string) DeviceScan {
		return load(t, filepath.Join("..", "..", "..", "shared", "fixtures", name))
	}
	uefi := "uefi"
	cases := []struct {
		name   string
		scan   func() DeviceScan
		expect string
	}{
		{"Intel Mac counts its RAM slots", func() DeviceScan {
			s := fixture("device-scan.macos-complete.json")
			s.Firmware.FirmwareType = &uefi
			return s
		}, "partial"},
		{"Mac with another null", func() DeviceScan {
			s := fixture("device-scan.macos-complete.json")
			s.Battery.CycleCount = nil
			return s
		}, "partial"},
		{"Linux without a TPM version", func() DeviceScan {
			s := fixture("device-scan.linux-complete.json")
			s.TPM.SpecVersion = nil
			return s
		}, "partial"},
		{"Windows without a display version", func() DeviceScan {
			s := fixture("device-scan.laptop-complete.json")
			s.OS.Family = "windows"
			s.OS.DisplayVersion = nil
			return s
		}, "partial"},
		{"no family without a display version", func() DeviceScan {
			s := fixture("device-scan.laptop-complete.json")
			s.OS.DisplayVersion = nil
			return s
		}, "partial"},
	}
	for _, c := range cases {
		if got := Status(c.scan()); got != c.expect {
			t.Errorf("%s: Status = %q, want %q", c.name, got, c.expect)
		}
	}
}

func load(t *testing.T, path string) DeviceScan {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var s DeviceScan
	if err := json.Unmarshal(data, &s); err != nil {
		t.Fatal(err)
	}
	return s
}
