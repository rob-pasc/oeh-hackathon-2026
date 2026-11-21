package scan

import (
	"math"
	"strings"
	"time"

	"leaaf.green/scanner/internal/payload"
)

// Meta is what the payload needs besides the hardware readings.
type Meta struct {
	ScannerVersion string
	ScannedAt      time.Time
}

// Normalize builds the payload from raw readings. It is pure: every value comes from raw or
// meta, and anything missing or implausible becomes nil rather than a guess.
func Normalize(raw Raw, meta Meta) payload.DeviceScan {
	s := payload.DeviceScan{
		SchemaVersion:  payload.SchemaVersion,
		ScannerVersion: meta.ScannerVersion,
		ScannedAt:      meta.ScannedAt.UTC().Format(time.RFC3339),
		Identity:       identity(raw),
		OS:             osInfo(raw),
		Firmware:       firmware(raw),
		TPM:            tpm(raw),
		CPU:            cpu(raw),
		Memory:         memory(raw),
		Storage:        storage(raw),
		Battery:        battery(raw),
		GPUs:           gpus(raw),
	}
	s.ScanStatus = payload.Status(s)
	return s
}

func first[T any](rows *[]T) *T {
	if rows == nil || len(*rows) == 0 {
		return nil
	}
	return &(*rows)[0]
}

func ptr[T any](v T) *T { return &v }

// placeholders are firmware strings that mean "not set"; the contract requires null for them.
var placeholders = map[string]bool{
	"to be filled by o.e.m.": true, "to be filled by oem": true, "o.e.m.": true, "oem": true,
	"default string": true, "system product name": true, "system manufacturer": true,
	"system version": true, "system family": true, "system sku": true, "not applicable": true,
	"not specified": true, "none": true, "n/a": true, "invalid": true, "unknown": true,
	"sku": true, "0": true,
}

func text(v *string) *string {
	if v == nil {
		return nil
	}
	t := strings.Join(strings.Fields(*v), " ")
	if t == "" || placeholders[strings.ToLower(t)] {
		return nil
	}
	return &t
}

func identity(raw Raw) payload.Identity {
	var id payload.Identity
	if cs := first(raw.ComputerSystem); cs != nil {
		id.Manufacturer = text(cs.Manufacturer)
		id.Model = text(cs.Model)
		id.SystemFamily = text(cs.SystemFamily)
		id.SystemSKU = text(cs.SystemSKUNumber)
	}
	if p := first(raw.Product); p != nil {
		id.ProductVersion = text(p.Version)
	}
	if e := first(raw.Enclosure); e != nil {
		id.FormFactor = formFactor(e.ChassisTypes)
	}
	return id
}

// SMBIOS chassis types (DMTF DSP0134, table 17).
var (
	laptopChassis  = map[int32]bool{8: true, 9: true, 10: true, 11: true, 12: true, 14: true, 18: true, 21: true, 30: true, 31: true, 32: true}
	desktopChassis = map[int32]bool{3: true, 4: true, 5: true, 6: true, 7: true, 13: true, 15: true, 16: true, 24: true, 35: true, 36: true}
)

func formFactor(types []int32) *string {
	for _, t := range types {
		switch {
		case laptopChassis[t]:
			return ptr("laptop")
		case desktopChassis[t]:
			return ptr("desktop")
		}
	}
	for _, t := range types {
		// 1 = Other, 2 = Unknown carry no information.
		if t > 2 {
			return ptr("other")
		}
	}
	return nil
}

func osInfo(raw Raw) payload.OS {
	o := payload.OS{Family: "windows"}
	if os := first(raw.OS); os != nil {
		o.Caption = text(os.Caption)
		o.Build = text(os.Version)
	}
	o.DisplayVersion = text(raw.DisplayVersion)
	return o
}

func firmware(raw Raw) payload.Firmware {
	var f payload.Firmware
	if b := first(raw.BIOS); b != nil {
		f.BIOSReleaseDate = cimDate(b.ReleaseDate)
	}
	if raw.FirmwareType != nil && (*raw.FirmwareType == "uefi" || *raw.FirmwareType == "legacy_bios") {
		f.FirmwareType = ptr(*raw.FirmwareType)
	}
	f.SecureBootEnabled = raw.SecureBoot
	return f
}

// cimDate turns a CIM DATETIME ("20210315000000.000000+000") into "2021-03-15".
func cimDate(v *string) *string {
	if v == nil || len(*v) < 8 {
		return nil
	}
	d, err := time.Parse("20060102", (*v)[:8])
	if err != nil || d.Year() < 1980 {
		return nil
	}
	return ptr(d.Format("2006-01-02"))
}

func tpm(raw Raw) payload.TPM {
	if raw.TPM == nil {
		// Win32_Tpm usually needs admin rights; unreadable is unknown, not absent.
		return payload.TPM{}
	}
	t := first(raw.TPM)
	if t == nil {
		return payload.TPM{Present: ptr(false), SpecVersion: nil}
	}
	tp := payload.TPM{Present: ptr(true)}
	// SpecVersion lists supported versions, highest first: "2.0, 0, 1.38".
	if t.SpecVersion != nil {
		if v := strings.TrimSpace(strings.Split(*t.SpecVersion, ",")[0]); v != "" {
			tp.SpecVersion = &v
		}
	}
	return tp
}

func cpu(raw Raw) payload.CPU {
	var c payload.CPU
	if raw.Processors == nil || len(*raw.Processors) == 0 {
		return c
	}
	procs := *raw.Processors
	c.Name = text(procs[0].Name)
	var cores, threads int
	coresKnown, threadsKnown := true, true
	for _, p := range procs {
		if p.NumberOfCores == nil || *p.NumberOfCores == 0 {
			coresKnown = false
		} else {
			cores += int(*p.NumberOfCores)
		}
		if p.NumberOfLogicalProcessors == nil || *p.NumberOfLogicalProcessors == 0 {
			threadsKnown = false
		} else {
			threads += int(*p.NumberOfLogicalProcessors)
		}
	}
	if coresKnown {
		c.Cores = &cores
	}
	if threadsKnown {
		c.Threads = &threads
	}
	return c
}

// SMBIOS memory types (DSP0134, table 76). LPDDR4X and LPDDR5X have no codes of their own.
var memoryTypes = map[uint32]string{24: "ddr3", 26: "ddr4", 29: "lpddr3", 30: "lpddr4", 34: "ddr5", 35: "lpddr5"}

func memory(raw Raw) payload.Memory {
	var m payload.Memory
	if raw.Memory != nil {
		modules := *raw.Memory
		m.SlotsUsed = ptr(len(modules))
		var bytes uint64
		known := len(modules) > 0
		for _, mod := range modules {
			if mod.Capacity == nil || *mod.Capacity == 0 {
				known = false
				break
			}
			bytes += *mod.Capacity
		}
		if known {
			gib := math.Round(float64(bytes)/(1<<30)*10) / 10
			m.TotalGB = &gib
		}
		for _, mod := range modules {
			if mod.SMBIOSMemoryType == nil || *mod.SMBIOSMemoryType <= 2 {
				continue // 0 = not reported, 1 = other, 2 = unknown
			}
			t, ok := memoryTypes[*mod.SMBIOSMemoryType]
			if !ok {
				t = "other"
			}
			m.Type = &t
			break
		}
		// The slowest module sets the speed the memory actually runs at.
		var speed uint32
		for _, mod := range modules {
			s := mod.ConfiguredClockSpeed
			if s == nil || *s == 0 {
				s = mod.Speed
			}
			if s != nil && *s > 0 && (speed == 0 || *s < speed) {
				speed = *s
			}
		}
		if speed > 0 {
			m.SpeedMTs = ptr(int(speed))
		}
	}
	if raw.MemoryArrays != nil {
		total, found := 0, false
		for _, a := range *raw.MemoryArrays {
			if a.Use != nil && *a.Use == 3 && a.MemoryDevices != nil {
				total += int(*a.MemoryDevices)
				found = true
			}
		}
		// SMBIOS slot counts are unreliable; drop them when they contradict the modules found.
		if found && (m.SlotsUsed == nil || *m.SlotsUsed <= total) {
			m.SlotsTotal = &total
		}
	}
	return m
}

// MSFT_PhysicalDisk.BusType values for removable or virtual disks, which are not internal drives.
var excludedBus = map[uint16]bool{7: true, 12: true, 13: true, 14: true, 15: true, 16: true}

func storage(raw Raw) *[]payload.Disk {
	if raw.Disks == nil {
		return nil
	}
	disks := []payload.Disk{}
	for _, d := range *raw.Disks {
		if d.BusType != nil && excludedBus[*d.BusType] {
			continue
		}
		disk := payload.Disk{Media: "unknown", Bus: "unknown", Health: "unknown"}
		if d.MediaType != nil {
			switch *d.MediaType {
			case 3:
				disk.Media = "hdd"
			case 4:
				disk.Media = "ssd"
			case 5:
				disk.Media = "scm"
			}
		}
		if d.BusType != nil {
			switch *d.BusType {
			case 0:
			case 17:
				disk.Bus = "nvme"
			case 11:
				disk.Bus = "sata"
			default:
				disk.Bus = "other"
			}
		}
		if d.HealthStatus != nil {
			switch *d.HealthStatus {
			case 0:
				disk.Health = "healthy"
			case 1:
				disk.Health = "warning"
			case 2:
				disk.Health = "unhealthy"
			}
		}
		if d.Size != nil && *d.Size > 0 {
			disk.CapacityGB = ptr(math.Round(float64(*d.Size) / 1e9))
		}
		disks = append(disks, disk)
	}
	return &disks
}

func sumUint32[T any](rows *[]T, get func(T) *uint32) *int {
	if rows == nil || len(*rows) == 0 {
		return nil
	}
	total := 0
	for _, r := range *rows {
		v := get(r)
		if v == nil || *v == 0 {
			return nil
		}
		total += int(*v)
	}
	return &total
}

func battery(raw Raw) payload.Battery {
	var b payload.Battery
	if raw.Batteries != nil {
		b.Present = ptr(len(*raw.Batteries) > 0)
		if len(*raw.Batteries) == 0 {
			return b // no battery: every value stays null (contract invariant)
		}
	}
	b.DesignCapacityMWh = sumUint32(raw.BatteryStatic, func(r BatteryStaticData) *uint32 { return r.DesignedCapacity })
	b.FullChargeCapacityMWh = sumUint32(raw.BatteryFull, func(r BatteryFullCharged) *uint32 { return r.FullChargedCapacity })
	if raw.BatteryCycles != nil && len(*raw.BatteryCycles) > 0 {
		if c := (*raw.BatteryCycles)[0].CycleCount; c != nil {
			b.CycleCount = ptr(int(*c))
		}
	}
	if r := raw.BatteryReport; r != nil {
		if b.DesignCapacityMWh == nil {
			b.DesignCapacityMWh = r.DesignCapacityMWh
		}
		if b.FullChargeCapacityMWh == nil {
			b.FullChargeCapacityMWh = r.FullChargeCapacityMWh
		}
		// Many firmwares report 0 cycles through WMI; the battery report is more reliable.
		if r.CycleCount != nil && (b.CycleCount == nil || *b.CycleCount == 0) {
			b.CycleCount = r.CycleCount
		}
	}
	if b.Present == nil && (b.DesignCapacityMWh != nil || b.FullChargeCapacityMWh != nil) {
		b.Present = ptr(true)
	}
	if b.DesignCapacityMWh != nil && b.FullChargeCapacityMWh != nil && *b.DesignCapacityMWh > 0 {
		h := math.Round(float64(*b.FullChargeCapacityMWh)/float64(*b.DesignCapacityMWh)*1000) / 10
		if h <= 200 {
			b.HealthPercent = &h
		}
	}
	return b
}

// Adapters that are not real graphics hardware or hide its name.
var ignoredGPUs = map[string]bool{"microsoft basic display adapter": true, "microsoft remote display adapter": true}

func gpus(raw Raw) *[]string {
	if raw.Video == nil {
		return nil
	}
	names := []string{}
	seen := map[string]bool{}
	for _, v := range *raw.Video {
		n := text(v.Name)
		if n == nil || ignoredGPUs[strings.ToLower(*n)] || seen[*n] {
			continue
		}
		seen[*n] = true
		names = append(names, *n)
	}
	return &names
}
