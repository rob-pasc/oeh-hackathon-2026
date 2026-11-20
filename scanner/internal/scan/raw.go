// Package scan turns raw Windows readings into the DeviceScan payload.
//
// Raw holds exactly the WMI properties the payload needs: it is the privacy allowlist
// (feature 001 FR-005). The collector selects only these properties, and anything else a data
// source returns (serial numbers, UUIDs, host or user names, MAC addresses) has nowhere to go.
// Do not add identifying properties here.
//
// Each source is a pointer to a slice: nil means the query failed (for example access denied),
// an empty slice means it succeeded and found nothing. That distinction gives "no battery"
// versus "battery unknown". Property fields are pointers because WMI values may be NULL.
package scan

type Raw struct {
	ComputerSystem *[]ComputerSystem        `json:"Win32_ComputerSystem"`
	Product        *[]ComputerSystemProduct `json:"Win32_ComputerSystemProduct"`
	Enclosure      *[]SystemEnclosure       `json:"Win32_SystemEnclosure"`
	OS             *[]OperatingSystem       `json:"Win32_OperatingSystem"`
	BIOS           *[]BIOS                  `json:"Win32_BIOS"`
	Processors     *[]Processor             `json:"Win32_Processor"`
	Memory         *[]PhysicalMemory        `json:"Win32_PhysicalMemory"`
	MemoryArrays   *[]PhysicalMemoryArray   `json:"Win32_PhysicalMemoryArray"`
	Disks          *[]PhysicalDisk          `json:"MSFT_PhysicalDisk"`
	Batteries      *[]Battery               `json:"Win32_Battery"`
	BatteryStatic  *[]BatteryStaticData     `json:"BatteryStaticData"`
	BatteryFull    *[]BatteryFullCharged    `json:"BatteryFullChargedCapacity"`
	BatteryCycles  *[]BatteryCycleCount     `json:"BatteryCycleCount"`
	Video          *[]VideoController       `json:"Win32_VideoController"`
	TPM            *[]Tpm                   `json:"Win32_Tpm"`

	// powercfg /batteryreport, used when root\WMI battery classes are unreadable.
	BatteryReport *BatteryReport `json:"BatteryReport"`
	// Registry HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\DisplayVersion.
	DisplayVersion *string `json:"DisplayVersion"`
	// "uefi" or "legacy_bios", from the GetFirmwareType API.
	FirmwareType *string `json:"FirmwareType"`
	// Registry HKLM\SYSTEM\CurrentControlSet\Control\SecureBoot\State\UEFISecureBootEnabled.
	// nil when unreadable; the collector reports false when the key is absent on legacy BIOS.
	SecureBoot *bool `json:"SecureBoot"`
}

type ComputerSystem struct {
	Manufacturer    *string
	Model           *string
	SystemFamily    *string
	SystemSKUNumber *string
}

type ComputerSystemProduct struct {
	Version *string
}

type SystemEnclosure struct {
	// uint16[] in the WMI schema, but WMI's scripting interface delivers the elements as VT_I4
	// (int32). The wmi package panics when it loads those into an unsigned slice.
	ChassisTypes []int32
}

type OperatingSystem struct {
	Caption *string
	Version *string
}

type BIOS struct {
	// CIM DATETIME, e.g. "20210315000000.000000+000".
	ReleaseDate *string
}

type Processor struct {
	Name                      *string
	NumberOfCores             *uint32
	NumberOfLogicalProcessors *uint32
}

type PhysicalMemory struct {
	Capacity             *uint64
	SMBIOSMemoryType     *uint32
	ConfiguredClockSpeed *uint32
	Speed                *uint32
}

type PhysicalMemoryArray struct {
	MemoryDevices *uint32
	// 3 = system memory; other arrays (e.g. flash, video) are not RAM slots.
	Use *uint16
}

type PhysicalDisk struct {
	MediaType    *uint16
	BusType      *uint16
	Size         *uint64
	HealthStatus *uint16
}

type Battery struct {
	// Only used to count batteries; no property values are kept.
	BatteryStatus *uint16
}

type BatteryStaticData struct {
	DesignedCapacity *uint32
}

type BatteryFullCharged struct {
	FullChargedCapacity *uint32
}

type BatteryCycleCount struct {
	CycleCount *uint32
}

type VideoController struct {
	Name *string
}

type Tpm struct {
	SpecVersion *string
}

// BatteryReport holds the battery values parsed from powercfg's XML report; see ParseBatteryReport.
type BatteryReport struct {
	DesignCapacityMWh     *int
	FullChargeCapacityMWh *int
	CycleCount            *int
}
