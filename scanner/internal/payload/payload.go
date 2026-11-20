// Package payload mirrors the DeviceScan v1 contract in shared/src/device.ts.
//
// The structs are written by hand (ADR-001); payload_test.go validates real output against
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

// HasNull reports whether any field of the serialized scan is null, which makes the scan
// "partial" (FR-004). It walks the JSON form so new fields are covered automatically.
func HasNull(scan DeviceScan) bool {
	raw, err := json.Marshal(scan)
	if err != nil {
		return true
	}
	var tree any
	if err := json.Unmarshal(raw, &tree); err != nil {
		return true
	}
	return containsNull(tree)
}

func containsNull(v any) bool {
	switch t := v.(type) {
	case nil:
		return true
	case []any:
		for _, e := range t {
			if containsNull(e) {
				return true
			}
		}
	case map[string]any:
		for _, e := range t {
			if containsNull(e) {
				return true
			}
		}
	}
	return false
}
