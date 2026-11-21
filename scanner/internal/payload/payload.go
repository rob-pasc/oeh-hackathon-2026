// Package payload mirrors the DeviceScan v1 contract in shared/src/device.ts.
//
// The structs are written by hand (ADR-001); scan/schema_test.go validates real output against
// shared/schemas/DeviceScan.schema.json so drift is caught. Nullable fields are pointers without
// omitempty, so an unreadable value is serialized as an explicit null (feature 001 FR-004).
package payload

import "encoding/json"

const SchemaVersion = 1

type DeviceScan struct {
	SchemaVersion  int       `json:"schema_version"`
	ScannerVersion string    `json:"scanner_version"`
	ScannedAt      string    `json:"scanned_at"`
	ScanStatus     string    `json:"scan_status"`
	Identity       Identity  `json:"identity"`
	OS             OS        `json:"os"`
	Firmware       Firmware  `json:"firmware"`
	TPM            TPM       `json:"tpm"`
	CPU            CPU       `json:"cpu"`
	Memory         Memory    `json:"memory"`
	Storage        *[]Disk   `json:"storage"`
	Battery        Battery   `json:"battery"`
	GPUs           *[]string `json:"gpus"`
	// Optional (omitted, not null) so a scan without a session is not partial.
	SessionID *string `json:"session_id,omitempty"`
}

type Identity struct {
	Manufacturer   *string `json:"manufacturer"`
	Model          *string `json:"model"`
	ProductVersion *string `json:"product_version"`
	SystemFamily   *string `json:"system_family"`
	SystemSKU      *string `json:"system_sku"`
	FormFactor     *string `json:"form_factor"`
}

type OS struct {
	// "windows", "macos" or "linux" (feature 007 FR-010). Optional in the schema, but every
	// scanner build sets it.
	Family         string  `json:"family,omitempty"`
	Caption        *string `json:"caption"`
	Build          *string `json:"build"`
	DisplayVersion *string `json:"display_version"`
}

type Firmware struct {
	BIOSReleaseDate   *string `json:"bios_release_date"`
	FirmwareType      *string `json:"firmware_type"`
	SecureBootEnabled *bool   `json:"secure_boot_enabled"`
}

type TPM struct {
	Present     *bool   `json:"present"`
	SpecVersion *string `json:"spec_version"`
}

type CPU struct {
	Name    *string `json:"name"`
	Cores   *int    `json:"cores"`
	Threads *int    `json:"threads"`
}

type Memory struct {
	TotalGB    *float64 `json:"total_gb"`
	Type       *string  `json:"type"`
	SpeedMTs   *int     `json:"speed_mts"`
	SlotsTotal *int     `json:"slots_total"`
	SlotsUsed  *int     `json:"slots_used"`
}

type Disk struct {
	Media      string   `json:"media"`
	Bus        string   `json:"bus"`
	CapacityGB *float64 `json:"capacity_gb"`
	Health     string   `json:"health"`
}

type Battery struct {
	Present               *bool    `json:"present"`
	DesignCapacityMWh     *int     `json:"design_capacity_mwh"`
	FullChargeCapacityMWh *int     `json:"full_charge_capacity_mwh"`
	HealthPercent         *float64 `json:"health_percent"`
	CycleCount            *int     `json:"cycle_count"`
}

// NotApplicable lists the fields, as dotted JSON paths, that do not exist on the scanned
// system (feature 007 FR-018). It mirrors notApplicableFields in shared/src/device.ts; the
// shared fixture test in status_test.go keeps the two in agreement.
func NotApplicable(scan DeviceScan) []string {
	switch scan.OS.Family {
	case "macos":
		fields := []string{"tpm.present", "tpm.spec_version", "firmware.bios_release_date", "firmware.secure_boot_enabled", "os.display_version"}
		// Apple Silicon memory is part of the chip, so there are no slots to count.
		if scan.Firmware.FirmwareType != nil && *scan.Firmware.FirmwareType == "apple" {
			fields = append(fields, "memory.slots_total", "memory.slots_used")
		}
		return fields
	case "linux":
		return []string{"os.display_version"}
	}
	return nil
}

// Status is "partial" when any applicable field of the serialized scan is null, and
// "complete" otherwise (feature 001 FR-004, feature 007 FR-018). It walks the JSON form so new
// fields are covered automatically.
func Status(scan DeviceScan) string {
	if hasNull(scan) {
		return "partial"
	}
	return "complete"
}

func hasNull(scan DeviceScan) bool {
	raw, err := json.Marshal(scan)
	if err != nil {
		return true
	}
	var tree any
	if err := json.Unmarshal(raw, &tree); err != nil {
		return true
	}
	skip := map[string]bool{}
	for _, f := range NotApplicable(scan) {
		skip[f] = true
	}
	return containsNull(tree, skip, "")
}

func containsNull(v any, skip map[string]bool, path string) bool {
	if skip[path] {
		return false
	}
	switch t := v.(type) {
	case nil:
		return true
	case []any:
		for _, e := range t {
			if containsNull(e, skip, path+"[]") {
				return true
			}
		}
	case map[string]any:
		for k, e := range t {
			p := k
			if path != "" {
				p = path + "." + k
			}
			if containsNull(e, skip, p) {
				return true
			}
		}
	}
	return false
}
