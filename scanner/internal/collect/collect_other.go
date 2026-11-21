//go:build !windows && !linux

package collect

import "leaaf.green/scanner/internal/scan"

// Collect is only implemented on Windows (the MVP's only scan target). Elsewhere it returns no
// readings, which normalizes to a payload of nulls; it exists so the module builds and tests
// on the development machines.
func Collect(progress func(step string)) (scan.Reading, []string) {
	return scan.Raw{}, []string{"hardware collection is only supported on Windows"}
}
