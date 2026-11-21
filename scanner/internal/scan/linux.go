package scan

import (
	"bufio"
	"bytes"
	"fmt"
	"io/fs"
	"math"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"leaaf.green/scanner/internal/payload"
)

// RawLinux holds the Linux readings the payload needs (feature 007 FR-005). Like Raw it is the
// privacy allowlist: ReadLinux opens only the named files below, never product_serial,
// product_uuid, board_serial, chassis_serial, the battery's serial_number, or anything in a
// user's home. Pointers are nil when a source could not be read.
type RawLinux struct {
	// /sys/class/dmi/id, by file name; only the keys in dmiFields are read.
	DMI map[string]string
	// /proc/cpuinfo.
	CPUName        *string
	Cores, Threads *int
	// Memory visible to the kernel: online memory blocks, else MemTotal.
	MemoryBytes  *uint64
	Disks        *[]LinuxDisk
	Batteries    *[]LinuxBattery
	GPUs         *[]string
	OSName       *string // os-release PRETTY_NAME
	OSVersion    *string // os-release VERSION_ID
	FirmwareType *string
	SecureBoot   *bool
	// nil when /sys/class/tpm cannot be read; "" when it lists no TPM.
	TPMVersion *string
	// From the root helper (FR-006); nil when it did not run or failed.
	Privileged *Privileged
}

// LinuxDisk is one internal block device; external and virtual devices are filtered out by
// ReadLinux (FR-009).
type LinuxDisk struct {
	Name       string // kernel name such as nvme0n1 or sda, used to match helper health values
	Bus        string // nvme, sata, or other
	Rotational *bool
	Bytes      *uint64
}

// LinuxBattery holds one battery's power_supply values in the kernel's units.
type LinuxBattery struct {
	EnergyFullDesign, EnergyFull *uint64 // µWh
	ChargeFullDesign, ChargeFull *uint64 // µAh, used with VoltageMinDesign when energy is missing
	VoltageMinDesign             *uint64 // µV
	CycleCount                   *uint64
}

// Privileged is what the root helper returns (FR-006): only these fields, decoded strictly.
type Privileged struct {
	Memory *SMBIOSMemory `json:"memory"`
	// Health per kernel disk name: healthy, warning, or unhealthy.
	DiskHealth map[string]string `json:"disk_health"`
}

var dmiFields = []string{"sys_vendor", "product_name", "product_version", "product_family", "product_sku", "chassis_type", "bios_date"}

// ReadLinux reads the non-root sources from fsys, which is the root file system ("/") at run
// time and a recorded tree in tests. It does not run the root helper.
func ReadLinux(fsys fs.FS) (RawLinux, []string) {
	var raw RawLinux
	var notes []string
	note := func(source string, err error) {
		if err != nil {
			notes = append(notes, source+": "+err.Error())
		}
	}

	raw.DMI = map[string]string{}
	for _, f := range dmiFields {
		if v, err := readText(fsys, "sys/class/dmi/id/"+f); err == nil {
			raw.DMI[f] = v
		}
	}
	if len(raw.DMI) == 0 {
		notes = append(notes, "sys/class/dmi/id: unreadable")
	}

	if data, err := fs.ReadFile(fsys, "proc/cpuinfo"); err == nil {
		raw.CPUName, raw.Cores, raw.Threads = parseCPUInfo(data)
	} else {
		note("proc/cpuinfo", err)
	}
	raw.MemoryBytes = memoryBytes(fsys)
	if raw.MemoryBytes == nil {
		notes = append(notes, "memory size: unreadable")
	}

	disks, err := linuxDisks(fsys)
	note("sys/block", err)
	raw.Disks = disks
	bats, err := linuxBatteries(fsys)
	note("sys/class/power_supply", err)
	raw.Batteries = bats
	gpus, err := linuxGPUs(fsys)
	note("sys/bus/pci", err)
	raw.GPUs = gpus

	raw.OSName, raw.OSVersion = osRelease(fsys)
	raw.FirmwareType, raw.SecureBoot = linuxFirmware(fsys)
	raw.TPMVersion = linuxTPM(fsys)
	return raw, notes
}

func readText(fsys fs.FS, name string) (string, error) {
	data, err := fs.ReadFile(fsys, name)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func readUint(fsys fs.FS, name string) *uint64 {
	s, err := readText(fsys, name)
	if err != nil {
		return nil
	}
	v, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return nil
	}
	return &v
}

func parseCPUInfo(data []byte) (name *string, cores, threads *int) {
	type core struct{ pkg, id string }
	seen := map[core]bool{}
	n, coreKnown := 0, true
	var cur core
	var hasID bool
	flush := func() {
		if !hasID {
			coreKnown = false
		}
		seen[cur] = true
		cur, hasID = core{}, false
	}
	sc := bufio.NewScanner(bytes.NewReader(data))
	for sc.Scan() {
		k, v, ok := strings.Cut(sc.Text(), ":")
		if !ok {
			continue
		}
		k, v = strings.TrimSpace(k), strings.TrimSpace(v)
		switch k {
		case "processor":
			if n > 0 {
				flush()
			}
			n++
		case "model name":
			if name == nil {
				name = text(&v)
			}
		case "physical id":
			cur.pkg = v
		case "core id":
			cur.id, hasID = v, true
		}
	}
	if n == 0 {
		return name, nil, nil
	}
	flush()
	threads = ptr(n)
	if coreKnown {
		cores = ptr(len(seen))
	}
	return name, cores, threads
}

// memoryBytes sums the online memory blocks, which cover the installed RAM minus firmware and
// graphics reservations; MemTotal is smaller still because the kernel reserves memory too.
func memoryBytes(fsys fs.FS) *uint64 {
	if s, err := readText(fsys, "sys/devices/system/memory/block_size_bytes"); err == nil {
		if size, err := strconv.ParseUint(s, 16, 64); err == nil && size > 0 {
			entries, _ := fs.ReadDir(fsys, "sys/devices/system/memory")
			var blocks uint64
			for _, e := range entries {
				if !strings.HasPrefix(e.Name(), "memory") {
					continue
				}
				if st, err := readText(fsys, "sys/devices/system/memory/"+e.Name()+"/state"); err == nil && st == "online" {
					blocks++
				}
			}
			if blocks > 0 {
				return ptr(blocks * size)
			}
		}
	}
	data, err := fs.ReadFile(fsys, "proc/meminfo")
	if err != nil {
		return nil
	}
	sc := bufio.NewScanner(bytes.NewReader(data))
	for sc.Scan() {
		if f := strings.Fields(sc.Text()); len(f) >= 2 && f[0] == "MemTotal:" {
			if kb, err := strconv.ParseUint(f[1], 10, 64); err == nil {
				return ptr(kb * 1024)
			}
		}
	}
	return nil
}

// Kernel block devices that are never physical internal drives.
var virtualBlock = regexp.MustCompile(`^(loop|ram|zram|dm-|md|sr|fd|nbd|vd|xvd)`)

func linuxDisks(fsys fs.FS) (*[]LinuxDisk, error) {
	entries, err := fs.ReadDir(fsys, "sys/block")
	if err != nil {
		return nil, err
	}
	disks := []LinuxDisk{}
	for _, e := range entries {
		name := e.Name()
		if virtualBlock.MatchString(name) {
			continue
		}
		base := "sys/block/" + name
		target, err := fs.ReadLink(fsys, base)
		if err != nil || isExternalPath(target) {
			continue
		}
		if r, _ := readText(fsys, base+"/removable"); r == "1" {
			continue
		}
		d := LinuxDisk{Name: name, Bus: "other", Bytes: nil}
		switch {
		case strings.HasPrefix(name, "nvme"):
			// A PCIe device behind an external-facing port (Thunderbolt) is marked removable.
			if r, _ := readText(fsys, base+"/device/device/removable"); r == "removable" {
				continue
			}
			d.Bus = "nvme"
		case strings.HasPrefix(name, "mmcblk"):
			// SD cards are external; eMMC is soldered storage.
			if t, _ := readText(fsys, base+"/device/type"); t != "MMC" {
				continue
			}
		default:
			// libata reports SATA drives with the SCSI vendor "ATA".
			if v, _ := readText(fsys, base+"/device/vendor"); v == "ATA" {
				d.Bus = "sata"
			}
		}
		if r, err := readText(fsys, base+"/queue/rotational"); err == nil {
			d.Rotational = ptr(r == "1")
		}
		if sectors := readUint(fsys, base+"/size"); sectors != nil && *sectors > 0 {
			d.Bytes = ptr(*sectors * 512) // sysfs counts 512-byte sectors whatever the drive uses
		}
		disks = append(disks, d)
	}
	return &disks, nil
}

func isExternalPath(target string) bool {
	return strings.Contains(target, "/usb") || strings.Contains(target, "/virtual/") ||
		strings.Contains(target, "/virtio") || strings.Contains(target, "/firewire")
}

func linuxBatteries(fsys fs.FS) (*[]LinuxBattery, error) {
	entries, err := fs.ReadDir(fsys, "sys/class/power_supply")
	if err != nil {
		return nil, err
	}
	bats := []LinuxBattery{}
	for _, e := range entries {
		base := "sys/class/power_supply/" + e.Name()
		if t, _ := readText(fsys, base+"/type"); t != "Battery" {
			continue
		}
		// Mice, keyboards and headsets report scope "Device"; the laptop's battery is "System".
		if s, err := readText(fsys, base+"/scope"); err == nil && s == "Device" {
			continue
		}
		if p, err := readText(fsys, base+"/present"); err == nil && p == "0" {
			continue // empty battery bay
		}
		bats = append(bats, LinuxBattery{
			EnergyFullDesign: readUint(fsys, base+"/energy_full_design"),
			EnergyFull:       readUint(fsys, base+"/energy_full"),
			ChargeFullDesign: readUint(fsys, base+"/charge_full_design"),
			ChargeFull:       readUint(fsys, base+"/charge_full"),
			VoltageMinDesign: readUint(fsys, base+"/voltage_min_design"),
			CycleCount:       readUint(fsys, base+"/cycle_count"),
		})
	}
	return &bats, nil
}

// Short vendor names for the graphics vendors; others keep their pci.ids name.
var gpuVendors = map[string]string{"8086": "Intel", "10de": "NVIDIA", "1002": "AMD"}

// linuxGPUs names the PCI display controllers (class 0x03) from the system's pci.ids. It
// returns nil when a controller cannot be named, so the list is never silently incomplete.
func linuxGPUs(fsys fs.FS) (*[]string, error) {
	entries, err := fs.ReadDir(fsys, "sys/bus/pci/devices")
	if err != nil {
		return nil, err
	}
	type id struct{ vendor, device string }
	var ids []id
	for _, e := range entries {
		base := "sys/bus/pci/devices/" + e.Name()
		if c, _ := readText(fsys, base+"/class"); !strings.HasPrefix(c, "0x03") {
			continue
		}
		v, _ := readText(fsys, base+"/vendor")
		d, _ := readText(fsys, base+"/device")
		ids = append(ids, id{strings.TrimPrefix(v, "0x"), strings.TrimPrefix(d, "0x")})
	}
	names := []string{}
	if len(ids) == 0 {
		return &names, nil
	}
	db := pciIDs(fsys)
	if db == nil {
		return nil, fs.ErrNotExist
	}
	seen := map[string]bool{}
	for _, i := range ids {
		vendor, device, ok := db.lookup(i.vendor, i.device)
		if !ok {
			return nil, fmt.Errorf("pci.ids has no name for %s:%s", i.vendor, i.device)
		}
		if short, ok := gpuVendors[i.vendor]; ok {
			vendor = short
		}
		// "GP107M [GeForce GTX 1050 Mobile]": the bracket holds the marketing name.
		if open := strings.LastIndex(device, "["); open >= 0 && strings.HasSuffix(device, "]") {
			device = device[open+1 : len(device)-1]
		}
		n := vendor + " " + device
		if !seen[n] {
			seen[n] = true
			names = append(names, n)
		}
	}
	return &names, nil
}

type pciDB []byte

func pciIDs(fsys fs.FS) pciDB {
	for _, p := range []string{"usr/share/hwdata/pci.ids", "usr/share/misc/pci.ids", "usr/share/pci.ids"} {
		if data, err := fs.ReadFile(fsys, p); err == nil {
			return data
		}
	}
	return nil
}

// lookup finds a vendor line ("8086  Intel Corporation") and, below it, a device line with one
// leading tab ("\t7d51  Arrow Lake-P [Arc Pro 130T/140T]").
func (db pciDB) lookup(vendor, device string) (string, string, bool) {
	var vendorName string
	sc := bufio.NewScanner(bytes.NewReader(db))
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := sc.Text()
		if line == "" || line[0] == '#' {
			continue
		}
		if line[0] != '\t' {
			if vendorName != "" {
				return "", "", false // past the vendor's devices
			}
			if strings.HasPrefix(line, vendor+"  ") {
				vendorName = strings.TrimSpace(line[len(vendor):])
			}
			continue
		}
		if vendorName != "" && strings.HasPrefix(line, "\t"+device+"  ") {
			return vendorName, strings.TrimSpace(line[1+len(device):]), true
		}
	}
	return "", "", false
}

func osRelease(fsys fs.FS) (name, version *string) {
	for _, p := range []string{"etc/os-release", "usr/lib/os-release"} {
		data, err := fs.ReadFile(fsys, p)
		if err != nil {
			continue
		}
		sc := bufio.NewScanner(bytes.NewReader(data))
		for sc.Scan() {
			k, v, ok := strings.Cut(sc.Text(), "=")
			if !ok {
				continue
			}
			if u, err := strconv.Unquote(v); err == nil {
				v = u
			} else {
				v = strings.Trim(v, `'"`)
			}
			switch k {
			case "PRETTY_NAME":
				name = text(&v)
			case "VERSION_ID":
				version = text(&v)
			}
		}
		return name, version
	}
	return nil, nil
}

const secureBootVar = "sys/firmware/efi/efivars/SecureBoot-8be4df61-93ca-11d2-aa0d-00e098032b8c"

func linuxFirmware(fsys fs.FS) (fwType *string, secureBoot *bool) {
	if _, err := fs.Stat(fsys, "sys/firmware/efi"); err == nil {
		// efivarfs files start with four attribute bytes; the fifth is the value.
		if data, err := fs.ReadFile(fsys, secureBootVar); err == nil && len(data) >= 5 {
			secureBoot = ptr(data[4] == 1)
		} else if _, err := fs.Stat(fsys, "sys/firmware/efi/efivars"); err == nil {
			secureBoot = ptr(false) // efivars readable, variable absent: Secure Boot unsupported
		}
		return ptr("uefi"), secureBoot
	}
	if _, err := fs.Stat(fsys, "sys/firmware"); err == nil {
		return ptr("legacy_bios"), ptr(false)
	}
	return nil, nil
}

func linuxTPM(fsys fs.FS) *string {
	entries, err := fs.ReadDir(fsys, "sys/class/tpm")
	if err != nil {
		// The class is missing when no TPM driver is bound, which is how the system sees no TPM.
		if _, serr := fs.Stat(fsys, "sys/class"); serr == nil {
			return ptr("")
		}
		return nil
	}
	for _, e := range entries {
		if !strings.HasPrefix(e.Name(), "tpm") {
			continue
		}
		switch v, _ := readText(fsys, path.Join("sys/class/tpm", e.Name(), "tpm_version_major")); v {
		case "2":
			return ptr("2.0")
		case "1":
			return ptr("1.2")
		}
		return ptr("unknown")
	}
	return ptr("")
}

// Payload implements Reading for the Linux readings.
func (raw RawLinux) Payload(meta Meta) payload.DeviceScan {
	s := payload.DeviceScan{
		SchemaVersion:  payload.SchemaVersion,
		ScannerVersion: meta.ScannerVersion,
		ScannedAt:      meta.ScannedAt.UTC().Format(time.RFC3339),
		Identity:       raw.identity(),
		OS:             payload.OS{Family: "linux", Caption: raw.OSName, Build: raw.OSVersion},
		Firmware:       raw.firmware(),
		TPM:            raw.tpm(),
		CPU:            payload.CPU{Name: raw.CPUName, Cores: raw.Cores, Threads: raw.Threads},
		Memory:         raw.memory(),
		Storage:        raw.storage(),
		Battery:        raw.battery(),
		GPUs:           raw.GPUs,
	}
	s.ScanStatus = payload.Status(s)
	return s
}

func (raw RawLinux) dmi(key string) *string {
	v, ok := raw.DMI[key]
	if !ok {
		return nil
	}
	return text(&v)
}

func (raw RawLinux) identity() payload.Identity {
	id := payload.Identity{
		Manufacturer:   raw.dmi("sys_vendor"),
		Model:          raw.dmi("product_name"),
		ProductVersion: raw.dmi("product_version"),
		SystemFamily:   raw.dmi("product_family"),
		SystemSKU:      raw.dmi("product_sku"),
	}
	if c := raw.dmi("chassis_type"); c != nil {
		if n, err := strconv.Atoi(*c); err == nil {
			id.FormFactor = formFactor([]int32{int32(n)})
		}
	}
	return id
}

func (raw RawLinux) firmware() payload.Firmware {
	f := payload.Firmware{FirmwareType: raw.FirmwareType, SecureBootEnabled: raw.SecureBoot}
	// DMI dates are MM/DD/YYYY.
	if d := raw.dmi("bios_date"); d != nil {
		if t, err := time.Parse("01/02/2006", *d); err == nil && t.Year() >= 1980 {
			f.BIOSReleaseDate = ptr(t.Format("2006-01-02"))
		}
	}
	return f
}

func (raw RawLinux) tpm() payload.TPM {
	switch {
	case raw.TPMVersion == nil:
		return payload.TPM{}
	case *raw.TPMVersion == "":
		return payload.TPM{Present: ptr(false)}
	case *raw.TPMVersion == "unknown":
		return payload.TPM{Present: ptr(true)}
	}
	return payload.TPM{Present: ptr(true), SpecVersion: ptr(*raw.TPMVersion)}
}

func (raw RawLinux) memory() payload.Memory {
	var m payload.Memory
	if p := raw.Privileged; p != nil && p.Memory != nil {
		m = p.Memory.payload()
	}
	if m.TotalGB == nil && raw.MemoryBytes != nil {
		// Without the module sizes, round the visible memory up to whole GiB: firmware and
		// integrated graphics reserve part of the installed RAM, typically well under 1 GiB.
		m.TotalGB = ptr(math.Ceil(float64(*raw.MemoryBytes) / (1 << 30)))
	}
	return m
}

func (raw RawLinux) storage() *[]payload.Disk {
	if raw.Disks == nil {
		return nil
	}
	disks := []payload.Disk{}
	for _, d := range *raw.Disks {
		disk := payload.Disk{Media: "unknown", Bus: d.Bus, Health: "unknown"}
		switch {
		case d.Bus == "nvme":
			disk.Media = "ssd"
		case d.Rotational != nil && *d.Rotational:
			disk.Media = "hdd"
		case d.Rotational != nil:
			disk.Media = "ssd"
		}
		if raw.Privileged != nil {
			if h, ok := raw.Privileged.DiskHealth[d.Name]; ok && (h == "healthy" || h == "warning" || h == "unhealthy") {
				disk.Health = h
			}
		}
		if d.Bytes != nil {
			disk.CapacityGB = ptr(math.Round(float64(*d.Bytes) / 1e9))
		}
		disks = append(disks, disk)
	}
	return &disks
}

func (raw RawLinux) battery() payload.Battery {
	var b payload.Battery
	if raw.Batteries == nil {
		return b
	}
	b.Present = ptr(len(*raw.Batteries) > 0)
	if len(*raw.Batteries) == 0 {
		return b
	}
	var design, full, cycles int
	designOK, fullOK := true, true
	for _, bat := range *raw.Batteries {
		d, f := mWh(bat.EnergyFullDesign, bat.ChargeFullDesign, bat.VoltageMinDesign), mWh(bat.EnergyFull, bat.ChargeFull, bat.VoltageMinDesign)
		if d == nil {
			designOK = false
		} else {
			design += *d
		}
		if f == nil {
			fullOK = false
		} else {
			full += *f
		}
		if bat.CycleCount != nil && int(*bat.CycleCount) > cycles {
			cycles = int(*bat.CycleCount)
		}
	}
	if designOK {
		b.DesignCapacityMWh = &design
	}
	if fullOK {
		b.FullChargeCapacityMWh = &full
	}
	// Drivers without cycle counting report 0, so 0 is unknown rather than a new battery.
	if cycles > 0 {
		b.CycleCount = &cycles
	}
	if designOK && fullOK && design > 0 {
		h := math.Round(float64(full)/float64(design)*1000) / 10
		if h <= 200 {
			b.HealthPercent = &h
		}
	}
	return b
}

// mWh converts a power_supply capacity to mWh: energy is in µWh, charge in µAh times µV.
func mWh(energy, charge, voltage *uint64) *int {
	switch {
	case energy != nil && *energy > 0:
		return ptr(int(*energy / 1000))
	case charge != nil && *charge > 0 && voltage != nil && *voltage > 0:
		return ptr(int(float64(*charge) * float64(*voltage) / 1e9))
	}
	return nil
}
