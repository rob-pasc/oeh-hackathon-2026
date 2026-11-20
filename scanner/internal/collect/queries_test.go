package collect

import (
	"reflect"
	"regexp"
	"strings"
	"testing"
)

// AC-004 (source side): no query selects an identifying property.
func TestQueriesSelectNoIdentifiers(t *testing.T) {
	forbidden := []string{
		"serialnumber", "identifyingnumber", "uuid", "username", "registereduser", "dnshostname",
		"csname", "systemname", "domain", "macaddress", "ipaddress", "processorid", "uniqueid",
		"deviceid", "pnpdeviceid", "assettag", "partnumber", "*",
	}
	selectRe := regexp.MustCompile(`(?i)^SELECT (.+) FROM (\w+)$`)
	v := reflect.ValueOf(queries)
	for i := 0; i < v.NumField(); i++ {
		q := v.Field(i).Interface().(query)
		m := selectRe.FindStringSubmatch(q.wql)
		if m == nil {
			t.Errorf("%s: not a plain SELECT with a property list: %q", v.Type().Field(i).Name, q.wql)
			continue
		}
		for _, prop := range strings.Split(m[1], ",") {
			p := strings.ToLower(strings.TrimSpace(prop))
			for _, f := range forbidden {
				if strings.Contains(p, f) {
					t.Errorf("%s selects forbidden property %q", m[2], prop)
				}
			}
			// Win32_ComputerSystem.Name is the host name; Name is fine on processors and GPUs.
			if p == "name" && m[2] != "Win32_Processor" && m[2] != "Win32_VideoController" {
				t.Errorf("%s selects Name, which may identify the device", m[2])
			}
		}
	}
}
