//go:build linux

package collect

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"runtime"
	"time"
	"unsafe"

	"golang.org/x/sys/unix"

	"leaaf.green/scanner/internal/scan"
)

// RunHelper is the root helper (feature 007 FR-006), started as `pkexec <scanner> --privileged-helper`.
// It reads only the root-only sources — the SMBIOS memory structures and each internal drive's
// health — and writes them as one JSON object. It takes no other input, writes no files and
// opens no network connection.
func RunHelper(w io.Writer) int {
	p := readPrivileged()
	if err := json.NewEncoder(w).Encode(p); err != nil {
		return 1
	}
	return 0
}

func readPrivileged() scan.Privileged {
	var p scan.Privileged
	if table, err := os.ReadFile("/sys/firmware/dmi/tables/DMI"); err == nil {
		if mem, err := scan.ParseSMBIOS(table); err == nil {
			p.Memory = &mem
		}
	}
	raw, _ := scan.ReadLinux(os.DirFS("/"))
	if raw.Disks != nil {
		p.DiskHealth = map[string]string{}
		for _, d := range *raw.Disks {
			if !scan.HelperDisk.MatchString(d.Name) {
				continue
			}
			if h, ok := diskHealth(d.Name, d.Bus); ok {
				p.DiskHealth[d.Name] = h
			}
		}
	}
	return p
}

// Absolute paths only: the helper runs as root and must not pick up a program from PATH.
var smartctlPaths = []string{"/usr/sbin/smartctl", "/usr/bin/smartctl", "/sbin/smartctl", "/usr/local/sbin/smartctl"}

// diskHealth asks smartctl when installed. Without it, NVMe drives are asked directly for their
// SMART / Health log; SATA drives stay unknown.
func diskHealth(name, bus string) (string, bool) {
	for _, path := range smartctlPaths {
		if _, err := os.Stat(path); err != nil {
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		out, _ := exec.CommandContext(ctx, path, "--json=c", "-H", "/dev/"+name).Output()
		cancel()
		if h, ok := scan.SmartctlHealth(out); ok {
			return h, true
		}
		break
	}
	if bus == "nvme" {
		return nvmeHealth(name)
	}
	return "", false
}

// nvme_admin_cmd from linux/nvme_ioctl.h (72 bytes).
type nvmeAdminCmd struct {
	Opcode, Flags                            uint8
	Rsvd1                                    uint16
	NSID, CDW2, CDW3                         uint32
	Metadata, Addr                           uint64
	MetadataLen, DataLen                     uint32
	CDW10, CDW11, CDW12, CDW13, CDW14, CDW15 uint32
	TimeoutMs, Result                        uint32
}

const nvmeIoctlAdminCmd = 0xC0484E41 // _IOWR('N', 0x41, struct nvme_admin_cmd)

// nvmeHealth reads the SMART / Health Information log page (02h) from the drive's controller.
func nvmeHealth(namespace string) (string, bool) {
	ctrl := namespace
	for i := len(ctrl) - 1; i > 0; i-- {
		if ctrl[i] == 'n' {
			ctrl = ctrl[:i] // nvme0n1 -> nvme0
			break
		}
	}
	f, err := os.Open("/dev/" + ctrl)
	if err != nil {
		return "", false
	}
	defer f.Close()
	buf := make([]byte, 512)
	cmd := nvmeAdminCmd{
		Opcode:  0x02,
		NSID:    0xFFFFFFFF,
		Addr:    uint64(uintptr(unsafe.Pointer(&buf[0]))),
		DataLen: uint32(len(buf)),
		CDW10:   0x02 | (uint32(len(buf)/4-1) << 16), // log page 02h, number of dwords - 1
	}
	_, _, errno := unix.Syscall(unix.SYS_IOCTL, f.Fd(), nvmeIoctlAdminCmd, uintptr(unsafe.Pointer(&cmd)))
	runtime.KeepAlive(buf)
	if errno != 0 {
		return "", false
	}
	return scan.NVMeHealth(buf[0]), true
}
