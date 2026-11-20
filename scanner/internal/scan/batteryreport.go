package scan

import (
	"encoding/xml"
	"io"
)

// ParseBatteryReport reads the XML written by `powercfg /batteryreport /xml`.
//
// The report also contains the computer name and other identifiers; only the per-battery
// capacity and cycle fields are decoded, so nothing else leaves this function. Several
// batteries are summed (capacities) or the first known value is kept (cycles).
func ParseBatteryReport(r io.Reader) (*BatteryReport, error) {
	var doc struct {
		Batteries []struct {
			DesignCapacity     *int `xml:"DesignCapacity"`
			FullChargeCapacity *int `xml:"FullChargeCapacity"`
			CycleCount         *int `xml:"CycleCount"`
		} `xml:"Batteries>Battery"`
	}
	if err := xml.NewDecoder(r).Decode(&doc); err != nil {
		return nil, err
	}
	if len(doc.Batteries) == 0 {
		return &BatteryReport{}, nil
	}
	var rep BatteryReport
	design, full := 0, 0
	designOK, fullOK := true, true
	for _, b := range doc.Batteries {
		if b.DesignCapacity == nil || *b.DesignCapacity <= 0 {
			designOK = false
		} else {
			design += *b.DesignCapacity
		}
		if b.FullChargeCapacity == nil || *b.FullChargeCapacity <= 0 {
			fullOK = false
		} else {
			full += *b.FullChargeCapacity
		}
		if rep.CycleCount == nil && b.CycleCount != nil && *b.CycleCount > 0 {
			rep.CycleCount = ptr(*b.CycleCount)
		}
	}
	if designOK {
		rep.DesignCapacityMWh = &design
	}
	if fullOK {
		rep.FullChargeCapacityMWh = &full
	}
	return &rep, nil
}
