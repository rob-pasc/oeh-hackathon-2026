package main

import "os"

// saveFailed replaces the default advice to move the scanner, which does not help on macOS.
const saveFailed = "The scanner could not save its results in your home folder. Check that your Mac has free space, then run the scanner again."

// saveDir is the home folder on macOS (feature 007 FR-011). A downloaded app runs from a
// read-only translocated copy, and writing to Downloads or Documents triggers a privacy prompt;
// the home folder itself needs neither.
func saveDir(exe string) string {
	if home, err := os.UserHomeDir(); err == nil {
		return home
	}
	return "."
}
