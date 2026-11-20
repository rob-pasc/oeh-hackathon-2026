// Package collect reads the raw hardware values on Windows.
//
// The WMI queries name every property they select. Together with scan.Raw they are the privacy
// allowlist (feature 001 FR-005): no query selects serial numbers, UUIDs, host or user names,
// or network identifiers. queries_test.go enforces that on every platform.
package collect

const (
	nsCIMV2   = `root\CIMV2`
	nsStorage = `root\Microsoft\Windows\Storage`
	nsWMI     = `root\WMI`
	nsTPM     = `root\CIMV2\Security\MicrosoftTpm`
)

type query struct {
	namespace string
	wql       string
}

var queries = struct {
	ComputerSystem, Product, Enclosure, OS, BIOS, Processor, Memory, MemoryArray,
	Disk, Battery, BatteryStatic, BatteryFull, BatteryCycles, Video, TPM query
}{
	ComputerSystem: query{nsCIMV2, "SELECT Manufacturer, Model, SystemFamily, SystemSKUNumber FROM Win32_ComputerSystem"},
	Product:        query{nsCIMV2, "SELECT Version FROM Win32_ComputerSystemProduct"},
	Enclosure:      query{nsCIMV2, "SELECT ChassisTypes FROM Win32_SystemEnclosure"},
	OS:             query{nsCIMV2, "SELECT Caption, Version FROM Win32_OperatingSystem"},
	BIOS:           query{nsCIMV2, "SELECT ReleaseDate FROM Win32_BIOS"},
	Processor:      query{nsCIMV2, "SELECT Name, NumberOfCores, NumberOfLogicalProcessors FROM Win32_Processor"},
	Memory:         query{nsCIMV2, "SELECT Capacity, SMBIOSMemoryType, ConfiguredClockSpeed, Speed FROM Win32_PhysicalMemory"},
	MemoryArray:    query{nsCIMV2, "SELECT MemoryDevices, Use FROM Win32_PhysicalMemoryArray"},
	Disk:           query{nsStorage, "SELECT MediaType, BusType, Size, HealthStatus FROM MSFT_PhysicalDisk"},
	Battery:        query{nsCIMV2, "SELECT BatteryStatus FROM Win32_Battery"},
	BatteryStatic:  query{nsWMI, "SELECT DesignedCapacity FROM BatteryStaticData"},
	BatteryFull:    query{nsWMI, "SELECT FullChargedCapacity FROM BatteryFullChargedCapacity"},
	BatteryCycles:  query{nsWMI, "SELECT CycleCount FROM BatteryCycleCount"},
	Video:          query{nsCIMV2, "SELECT Name FROM Win32_VideoController"},
	TPM:            query{nsTPM, "SELECT SpecVersion FROM Win32_Tpm"},
}
