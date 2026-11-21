package scan

import (
	"encoding/binary"
	"errors"
	"math"

	"leaaf.green/scanner/internal/payload"
)

// SMBIOSMemory is what the Linux root helper reads from the SMBIOS table
// (/sys/firmware/dmi/tables/DMI, root only). ParseSMBIOS reads only these numeric fields; the
// strings of a Memory Device structure (serial number, asset tag, part number, locator) are
// never decoded (feature 007 FR-008).
type SMBIOSMemory struct {
	// Slots in system memory arrays (type 16 with Use = 3).
	SlotsTotal *int           `json:"slots_total"`
	Modules    []SMBIOSModule `json:"modules"`
}

// SMBIOSModule is one populated Memory Device (type 17).
type SMBIOSModule struct {
	SizeMiB   uint64 `json:"size_mib"`
	Type      uint32 `json:"type"`       // DSP0134 memory type code, as in Win32_PhysicalMemory
	SpeedMTs  uint32 `json:"speed_mts"`  // maximum speed, 0 when unknown
	ConfigMTs uint32 `json:"config_mts"` // configured speed, 0 when unknown
}

// ParseSMBIOS walks the structure table (DMTF DSP0134): each structure is a formatted area of
// the length in its header, followed by strings ending in a double NUL.
func ParseSMBIOS(table []byte) (SMBIOSMemory, error) {
	var mem SMBIOSMemory
	slots, arrays := 0, 0
	for len(table) >= 4 {
		typ, length := table[0], int(table[1])
		if length < 4 || length > len(table) {
			return mem, errors.New("malformed SMBIOS structure")
		}
		f := table[:length]
		switch typ {
		case 16: // Physical Memory Array
			if length >= 0x0F && f[0x05] == 3 {
				slots += int(binary.LittleEndian.Uint16(f[0x0D:]))
				arrays++
			}
		case 17: // Memory Device
			if m, ok := memoryDevice(f); ok {
				mem.Modules = append(mem.Modules, m)
			}
		case 127: // end of table
			table = nil
			continue
		}
		// Skip the string set: it ends at the first double NUL after the formatted area.
		rest := table[length:]
		end := 0
		for end+1 < len(rest) && !(rest[end] == 0 && rest[end+1] == 0) {
			end++
		}
		if end+2 > len(rest) {
			break
		}
		table = rest[end+2:]
	}
	if arrays > 0 {
		mem.SlotsTotal = &slots
	}
	return mem, nil
}

func memoryDevice(f []byte) (SMBIOSModule, bool) {
	var m SMBIOSModule
	if len(f) < 0x15 {
		return m, false
	}
	size := binary.LittleEndian.Uint16(f[0x0C:])
	switch {
	case size == 0 || size == 0xFFFF:
		return m, false // empty slot or unknown size
	case size == 0x7FFF && len(f) >= 0x20:
		m.SizeMiB = uint64(binary.LittleEndian.Uint32(f[0x1C:]) & 0x7FFFFFFF)
	case size&0x8000 != 0:
		m.SizeMiB = uint64(size&0x7FFF) / 1024 // KiB units
	default:
		m.SizeMiB = uint64(size)
	}
	m.Type = uint32(f[0x12])
	if len(f) >= 0x17 {
		m.SpeedMTs = speed(f, 0x15, 0x54)
	}
	if len(f) >= 0x22 {
		m.ConfigMTs = speed(f, 0x20, 0x58)
	}
	return m, m.SizeMiB > 0
}

// speed reads a WORD speed in MT/s; 0xFFFF points to the DWORD extended speed (SMBIOS 3.3).
func speed(f []byte, word, ext int) uint32 {
	v := uint32(binary.LittleEndian.Uint16(f[word:]))
	if v == 0xFFFF {
		if len(f) >= ext+4 {
			return binary.LittleEndian.Uint32(f[ext:]) & 0x7FFFFFFF
		}
		return 0
	}
	return v
}

// payload turns the SMBIOS readings into the memory fields, with the same rules as the WMI
// readings on Windows (memory in normalize.go).
func (mem SMBIOSMemory) payload() payload.Memory {
	var m payload.Memory
	if len(mem.Modules) == 0 {
		return m
	}
	m.SlotsUsed = ptr(len(mem.Modules))
	var mib uint64
	var slowest uint32
	for _, mod := range mem.Modules {
		mib += mod.SizeMiB
		s := mod.ConfigMTs
		if s == 0 {
			s = mod.SpeedMTs
		}
		if s > 0 && (slowest == 0 || s < slowest) {
			slowest = s
		}
	}
	m.TotalGB = ptr(math.Round(float64(mib)/1024*10) / 10)
	for _, mod := range mem.Modules {
		if mod.Type <= 2 {
			continue
		}
		t, ok := memoryTypes[mod.Type]
		if !ok {
			t = "other"
		}
		m.Type = &t
		break
	}
	if slowest > 0 {
		m.SpeedMTs = ptr(int(slowest))
	}
	if mem.SlotsTotal != nil && *mem.SlotsTotal >= len(mem.Modules) {
		m.SlotsTotal = ptr(*mem.SlotsTotal)
	}
	return m
}
