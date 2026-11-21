package scan

import (
	"encoding/json"
	"regexp"
)

// HelperDisk matches the kernel names of drives whose health the Linux root helper may query.
// The helper only opens /dev nodes with these names, so a crafted sysfs entry cannot point it
// at another file.
var HelperDisk = regexp.MustCompile(`^(sd[a-z]{1,3}|nvme[0-9]{1,3}n[0-9]{1,3})$`)

// NVMeHealth maps the critical warning byte of the NVMe SMART / Health log: bits 2 (reliability
// degraded) and 3 (media read-only) mean the drive is failing; other bits (spare capacity low,
// temperature, backup device, persistent memory) are warnings.
func NVMeHealth(criticalWarning byte) string {
	switch {
	case criticalWarning&0x0C != 0:
		return "unhealthy"
	case criticalWarning != 0:
		return "warning"
	}
	return "healthy"
}

// SmartctlHealth reads the overall verdict from `smartctl --json -H`. smartctl sets non-zero exit
// bits for a failing drive, so the JSON is read whatever the exit status was. ok is false when
// the output holds no verdict.
func SmartctlHealth(output []byte) (health string, ok bool) {
	var r struct {
		SmartStatus *struct {
			Passed *bool `json:"passed"`
		} `json:"smart_status"`
		NVMe *struct {
			CriticalWarning *int `json:"critical_warning"`
		} `json:"nvme_smart_health_information_log"`
	}
	if json.Unmarshal(output, &r) != nil {
		return "", false
	}
	if r.SmartStatus != nil && r.SmartStatus.Passed != nil && !*r.SmartStatus.Passed {
		return "unhealthy", true
	}
	if r.NVMe != nil && r.NVMe.CriticalWarning != nil {
		return NVMeHealth(byte(*r.NVMe.CriticalWarning)), true
	}
	if r.SmartStatus != nil && r.SmartStatus.Passed != nil {
		return "healthy", true
	}
	return "", false
}
