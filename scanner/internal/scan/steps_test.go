package scan

import "testing"

// AC-017 (feature 001 FR-017): a step is done when at least one of its readings found a part.
func TestStepState(t *testing.T) {
	name := "Intel(R) UHD Graphics 620"
	capacity := uint32(57000)
	cycles := 85
	cases := []struct {
		name string
		step string
		raw  Raw
		want string
	}{
		{"cpu_memory with only a video controller", "cpu_memory", Raw{Video: &[]VideoController{{Name: &name}}}, StepDone},
		{"cpu_memory with every source failed", "cpu_memory", Raw{}, StepSkipped},
		{"cpu_memory with empty results", "cpu_memory", Raw{Processors: &[]Processor{}, Memory: &[]PhysicalMemory{}}, StepSkipped},
		{"storage with a disk", "storage", Raw{Disks: &[]PhysicalDisk{{}}}, StepDone},
		{"storage with the query failed", "storage", Raw{}, StepSkipped},
		{"battery from Win32_Battery", "battery", Raw{Batteries: &[]Battery{{}}}, StepDone},
		{"battery only from root\\WMI", "battery", Raw{BatteryStatic: &[]BatteryStaticData{{DesignedCapacity: &capacity}}}, StepDone},
		{"battery only from the battery report", "battery", Raw{BatteryReport: &BatteryReport{CycleCount: &cycles, DesignCapacityMWh: ptr(57000)}}, StepDone},
		{"desktop without a battery", "battery", Raw{Batteries: &[]Battery{}}, StepSkipped},
		{"battery sources all failed", "battery", Raw{}, StepSkipped},
		{"started has no parts", "started", Raw{}, StepDone},
	}
	for _, c := range cases {
		if got := StepState(c.step, c.raw); got != c.want {
			t.Errorf("%s: StepState(%q) = %q, want %q", c.name, c.step, got, c.want)
		}
	}
}
