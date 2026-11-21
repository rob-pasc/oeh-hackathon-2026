package main

import "os"

// saveDir is the home folder on macOS (feature 007 FR-011). A downloaded app runs from a
// read-only translocated copy, and writing to Downloads or Documents triggers a privacy prompt;
// the home folder itself needs neither.
func saveDir(exe string) string {
	if home, err := os.UserHomeDir(); err == nil {
		return home
	}
	return "."
}
