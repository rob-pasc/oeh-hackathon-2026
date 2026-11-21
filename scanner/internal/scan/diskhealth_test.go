package scan

import "testing"

func TestSmartctlHealth(t *testing.T) {
	cases := []struct {
		out, want string
		ok        bool
	}{
		{`{"smart_status":{"passed":true}}`, "healthy", true},
		{`{"smart_status":{"passed":false}}`, "unhealthy", true},
		{`{"smart_status":{"passed":true},"nvme_smart_health_information_log":{"critical_warning":1}}`, "warning", true},
		{`{"smart_status":{"passed":true},"nvme_smart_health_information_log":{"critical_warning":8}}`, "unhealthy", true},
		{`{"smartctl":{"exit_status":2}}`, "", false},
		{`not json`, "", false},
	}
	for _, c := range cases {
		got, ok := SmartctlHealth([]byte(c.out))
		if got != c.want || ok != c.ok {
			t.Errorf("%s: got %q %v, want %q %v", c.out, got, ok, c.want, c.ok)
		}
	}
}

func TestHelperDiskNames(t *testing.T) {
	for _, name := range []string{"sda", "sdab", "nvme0n1", "nvme12n3"} {
		if !HelperDisk.MatchString(name) {
			t.Errorf("rejected %s", name)
		}
	}
	for _, name := range []string{"sda1", "nvme0n1p2", "../sda", "mmcblk0", "loop0", "sda/../../etc/shadow"} {
		if HelperDisk.MatchString(name) {
			t.Errorf("accepted %s", name)
		}
	}
}
