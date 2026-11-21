package scan

import (
	"bufio"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"leaaf.green/scanner/internal/payload"
)

// RawDarwin holds the macOS readings the payload needs (feature 007 FR-004). The system tools
// also return the serial number, hardware UUID, provisioning UDID, drive, battery and display
// serials, and volume names; the structs below name only the allowed keys, so encoding/json
// drops everything else while decoding (FR-008). Do not add identifying keys here.
type RawDarwin struct {
	Profiler *Profiler     // system_profiler -json; nil when it failed
	Battery  *IORegBattery // ioreg -a -r -c AppleSmartBattery; nil when unreadable or absent
	// sw_vers.
	ProductName, ProductVersion, BuildVersion *string
	// sysctl machdep.cpu.brand_string, hw.physicalcpu, hw.logicalcpu, hw.memsize.
	CPUBrand                *string
	PhysicalCPU, LogicalCPU *int
	MemSize                 *uint64
}

// ProfilerDataTypes are the system_profiler sections the collector requests.
var ProfilerDataTypes = []string{"SPHardwareDataType", "SPMemoryDataType", "SPNVMeDataType", "SPSerialATADataType", "SPPowerDataType", "SPDisplaysDataType"}

type Profiler struct {
	Hardware []struct {
		MachineModel string `json:"machine_model"` // "Mac14,2"
		MachineName  string `json:"machine_name"`  // "MacBook Air"
		ModelNumber  string `json:"model_number"`  // order number such as "MLY33D/A", shared by many units
		ChipType     string `json:"chip_type"`     // Apple Silicon only: "Apple M2"
	} `json:"SPHardwareDataType"`
	Memory []struct {
		// Apple Silicon: one entry for the unified memory.
		Type string `json:"dimm_type"`
		// Intel: one entry per bank.
		Items []struct {
			Size  string `json:"dimm_size"`  // "4 GB" or "Empty"
			Speed string `json:"dimm_speed"` // "2133 MHz"
			Type  string `json:"dimm_type"`  // "LPDDR3"
		} `json:"_items"`
	} `json:"SPMemoryDataType"`
	NVMe  []profilerController `json:"SPNVMeDataType"`
	SATA  []profilerController `json:"SPSerialATADataType"`
	Power []struct {
		Name   string `json:"_name"`
		Health *struct {
			CycleCount *int   `json:"sppower_battery_cycle_count"`
			Maximum    string `json:"sppower_battery_health_maximum_capacity"` // "90%"
		} `json:"sppower_battery_health_info"`
	} `json:"SPPowerDataType"`
	Displays []struct {
		Model string `json:"sppci_model"`
	} `json:"SPDisplaysDataType"`
}

type profilerController struct {
	Items []struct {
		SizeBytes  *uint64 `json:"size_in_bytes"`
		Smart      string  `json:"smart_status"`     // "Verified", "Failing", "Not Supported"
		Detachable string  `json:"detachable_drive"` // "yes" for external drives
		Removable  string  `json:"removable_media"`  // NVMe: "yes"/"no"
		SATARemov  string  `json:"spsata_removable_media"`
		Medium     string  `json:"spsata_medium_type"` // "Solid State" or "Rotational"
	} `json:"_items"`
}

// IORegBattery holds AppleSmartBattery capacities in mAh and the present voltage in mV.
type IORegBattery struct {
	DesignCapacity, RawMaxCapacity, MaxCapacity, CycleCount, Voltage *int
}

// ParseProfiler decodes system_profiler -json output into the allowlisted keys.
func ParseProfiler(data []byte) (*Profiler, error) {
	var p Profiler
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

// ParseIORegBattery reads the integer keys it needs from the first top-level dictionary of
// `ioreg -a` plist XML. Nested dictionaries (BatteryData and others) and strings, which hold the
// battery serial number, are skipped. It returns nil when the output has no battery.
func ParseIORegBattery(data []byte) *IORegBattery {
	want := map[string]bool{"DesignCapacity": true, "AppleRawMaxCapacity": true, "MaxCapacity": true, "CycleCount": true, "Voltage": true}
	values := map[string]int{}
	dec := xml.NewDecoder(bytes.NewReader(data))
	depth, started := 0, false // depth of nested <dict> elements
	var key string
	var inKey, inInt bool
loop:
	for {
		tok, err := dec.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "dict":
				depth++
				started = true
			case "key":
				inKey = depth == 1
			case "integer":
				inInt = depth == 1
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "dict":
				depth--
				key = ""
				if started && depth == 0 {
					break loop // only the first battery
				}
			case "key":
				inKey = false
			default:
				inInt = false
				if depth == 1 {
					key = ""
				}
			}
		case xml.CharData:
			if inKey {
				key = string(t)
			} else if inInt && want[key] {
				if v, err := strconv.Atoi(strings.TrimSpace(string(t))); err == nil {
					values[key] = v
				}
			}
		}
	}
	if len(values) == 0 {
		return nil
	}
	get := func(k string) *int {
		if v, ok := values[k]; ok {
			return &v
		}
		return nil
	}
	return &IORegBattery{
		DesignCapacity: get("DesignCapacity"), RawMaxCapacity: get("AppleRawMaxCapacity"),
		MaxCapacity: get("MaxCapacity"), CycleCount: get("CycleCount"), Voltage: get("Voltage"),
	}
}

// ParseSwVers reads `sw_vers` output ("ProductName:\tmacOS").
func ParseSwVers(data []byte) (name, version, build *string) {
	sc := bufio.NewScanner(bytes.NewReader(data))
	for sc.Scan() {
		k, v, ok := strings.Cut(sc.Text(), ":")
		if !ok {
			continue
		}
		switch strings.TrimSpace(k) {
		case "ProductName":
			name = text(&v)
		case "ProductVersion":
			version = text(&v)
		case "BuildVersion":
			build = text(&v)
		}
	}
	return
}

// Payload implements Reading for the macOS readings.
func (raw RawDarwin) Payload(meta Meta) payload.DeviceScan {
	s := payload.DeviceScan{
		SchemaVersion:  payload.SchemaVersion,
		ScannerVersion: meta.ScannerVersion,
		ScannedAt:      meta.ScannedAt.UTC().Format(time.RFC3339),
		Identity:       raw.identity(),
		OS:             raw.os(),
		Firmware:       payload.Firmware{FirmwareType: raw.firmwareType()},
		// Macs have no TPM (FR-004); the fields are not applicable (FR-018).
		TPM:     payload.TPM{},
		CPU:     payload.CPU{Name: raw.CPUBrand, Cores: raw.PhysicalCPU, Threads: raw.LogicalCPU},
		Memory:  raw.memory(),
		Storage: raw.storage(),
		Battery: raw.battery(),
		GPUs:    raw.gpus(),
	}
	s.ScanStatus = payload.Status(s)
	return s
}

func (raw RawDarwin) hardware() (model, name, number, chip *string) {
	if raw.Profiler == nil || len(raw.Profiler.Hardware) == 0 {
		return
	}
	h := raw.Profiler.Hardware[0]
	return text(&h.MachineModel), text(&h.MachineName), text(&h.ModelNumber), text(&h.ChipType)
}

func (raw RawDarwin) identity() payload.Identity {
	model, name, number, _ := raw.hardware()
	id := payload.Identity{Model: model, ProductVersion: name, SystemFamily: name, SystemSKU: number}
	if raw.Profiler != nil && len(raw.Profiler.Hardware) > 0 {
		id.Manufacturer = ptr("Apple Inc.")
	}
	if name != nil {
		switch {
		case strings.HasPrefix(*name, "MacBook"):
			id.FormFactor = ptr("laptop")
		case strings.HasPrefix(*name, "iMac"), strings.HasPrefix(*name, "Mac mini"), strings.HasPrefix(*name, "Mac Pro"), strings.HasPrefix(*name, "Mac Studio"):
			id.FormFactor = ptr("desktop")
		default:
			id.FormFactor = ptr("other")
		}
	}
	return id
}

func (raw RawDarwin) os() payload.OS {
	o := payload.OS{Family: "macos", Build: raw.BuildVersion}
	if raw.ProductName != nil && raw.ProductVersion != nil {
		o.Caption = ptr(*raw.ProductName + " " + *raw.ProductVersion)
	}
	return o
}

// firmwareType is "apple" for Apple Silicon and "uefi" for Intel Macs, which use Apple's EFI.
func (raw RawDarwin) firmwareType() *string {
	if raw.Profiler == nil || len(raw.Profiler.Hardware) == 0 {
		return nil
	}
	if _, _, _, chip := raw.hardware(); chip != nil {
		return ptr("apple")
	}
	return ptr("uefi")
}

var gbPattern = regexp.MustCompile(`^(\d+(?:[.,]\d+)?)\s*GB$`)

func (raw RawDarwin) memory() payload.Memory {
	var m payload.Memory
	if raw.MemSize != nil && *raw.MemSize > 0 {
		m.TotalGB = ptr(math.Round(float64(*raw.MemSize)/(1<<30)*10) / 10)
	}
	if raw.Profiler == nil || len(raw.Profiler.Memory) == 0 {
		return m
	}
	entry := raw.Profiler.Memory[0]
	if len(entry.Items) == 0 {
		// Apple Silicon: memory is part of the chip, so slots are not applicable (FR-018), and
		// system_profiler reports no speed.
		m.Type = macMemoryType(entry.Type)
		return m
	}
	used := 0
	var speed int
	for _, it := range entry.Items {
		if !gbPattern.MatchString(strings.TrimSpace(it.Size)) {
			continue // "Empty"
		}
		used++
		if m.Type == nil {
			m.Type = macMemoryType(it.Type)
		}
		if f := strings.Fields(it.Speed); len(f) == 2 && f[1] == "MHz" {
			if s, err := strconv.Atoi(f[0]); err == nil && s > 0 && (speed == 0 || s < speed) {
				speed = s // the slowest module sets the speed; macOS reports the data rate here
			}
		}
	}
	m.SlotsTotal, m.SlotsUsed = ptr(len(entry.Items)), ptr(used)
	if speed > 0 {
		m.SpeedMTs = &speed
	}
	return m
}

func macMemoryType(t string) *string {
	switch v := strings.ToLower(strings.TrimSpace(t)); v {
	case "ddr3", "ddr4", "ddr5", "lpddr3", "lpddr4", "lpddr4x", "lpddr5", "lpddr5x":
		return &v
	case "":
		return nil
	}
	return ptr("other")
}

func (raw RawDarwin) storage() *[]payload.Disk {
	if raw.Profiler == nil {
		return nil
	}
	disks := []payload.Disk{}
	add := func(ctrls []profilerController, bus string) {
		for _, c := range ctrls {
			for _, it := range c.Items {
				if yes(it.Detachable) || yes(it.Removable) || yes(it.SATARemov) {
					continue // external drive (FR-009)
				}
				d := payload.Disk{Media: "unknown", Bus: bus, Health: "unknown"}
				switch {
				case bus == "nvme", it.Medium == "Solid State":
					d.Media = "ssd"
				case it.Medium == "Rotational":
					d.Media = "hdd"
				}
				switch it.Smart {
				case "Verified":
					d.Health = "healthy"
				case "Failing":
					d.Health = "unhealthy"
				}
				if it.SizeBytes != nil && *it.SizeBytes > 0 {
					d.CapacityGB = ptr(math.Round(float64(*it.SizeBytes) / 1e9))
				}
				disks = append(disks, d)
			}
		}
	}
	add(raw.Profiler.NVMe, "nvme")
	add(raw.Profiler.SATA, "sata")
	return &disks
}

func yes(v string) bool { return strings.EqualFold(strings.TrimSpace(v), "yes") }

func (raw RawDarwin) battery() payload.Battery {
	var b payload.Battery
	if raw.Profiler == nil {
		return b
	}
	var cycles *int
	var maxPercent *float64
	found := false
	for _, p := range raw.Profiler.Power {
		if p.Name != "spbattery_information" {
			continue
		}
		found = true
		if p.Health != nil {
			cycles = p.Health.CycleCount
			if v, err := strconv.ParseFloat(strings.TrimSuffix(strings.TrimSpace(p.Health.Maximum), "%"), 64); err == nil {
				maxPercent = &v
			}
		}
	}
	b.Present = ptr(found || raw.Battery != nil)
	if !*b.Present {
		return b // desktop Mac: every value stays null
	}
	b.CycleCount = cycles
	if io := raw.Battery; io != nil {
		if b.CycleCount == nil {
			b.CycleCount = io.CycleCount
		}
		full := io.RawMaxCapacity
		// Before AppleRawMaxCapacity, MaxCapacity was in mAh; on Apple Silicon it is a percentage.
		if full == nil && io.MaxCapacity != nil && *io.MaxCapacity > 100 {
			full = io.MaxCapacity
		}
		if io.DesignCapacity != nil && *io.DesignCapacity > 0 {
			volts := nominalVolts(io.Voltage)
			if volts > 0 {
				b.DesignCapacityMWh = ptr(int(math.Round(float64(*io.DesignCapacity) * volts)))
				if full != nil && *full > 0 {
					b.FullChargeCapacityMWh = ptr(int(math.Round(float64(*full) * volts)))
				}
			}
			if full != nil && *full > 0 {
				if h := math.Round(float64(*full)/float64(*io.DesignCapacity)*1000) / 10; h <= 200 {
					b.HealthPercent = &h
				}
			}
		}
	}
	if b.HealthPercent == nil && maxPercent != nil && *maxPercent > 0 && *maxPercent <= 200 {
		b.HealthPercent = maxPercent
	}
	return b
}

// nominalVolts estimates the pack's nominal voltage from the present one. ioreg gives
// capacities in mAh and no design voltage, so the cell count is taken from the present voltage
// (Li-ion cells run between about 3.0 and 4.4 V) and multiplied by a typical nominal 3.85 V per
// cell. Health is the exact mAh ratio either way; the mWh values are approximate (a few %).
func nominalVolts(mV *int) float64 {
	if mV == nil || *mV <= 0 {
		return 0
	}
	cells := math.Round(float64(*mV) / 3850)
	if cells < 1 {
		return 0
	}
	return cells * 3.85
}

func (raw RawDarwin) gpus() *[]string {
	if raw.Profiler == nil {
		return nil
	}
	names := []string{}
	seen := map[string]bool{}
	for _, d := range raw.Profiler.Displays {
		if n := text(&d.Model); n != nil && !seen[*n] {
			seen[*n] = true
			names = append(names, *n)
		}
	}
	return &names
}
