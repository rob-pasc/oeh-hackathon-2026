package collect

import "fmt"

// guarded runs one source read and turns a panic into an error. The wmi package panics on some
// type mismatches between a WMI property and the target field instead of returning an error;
// one bad source must leave its field null, not end the scan (feature 001 FR-004).
func guarded(read func() error) (err error) {
	defer func() {
		if p := recover(); p != nil {
			err = fmt.Errorf("read failed: %v", p)
		}
	}()
	return read()
}
