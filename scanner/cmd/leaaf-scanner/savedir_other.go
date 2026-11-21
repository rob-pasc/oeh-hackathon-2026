//go:build !darwin

package main

import "path/filepath"

// saveFailed is empty: the run flow's default message (move the scanner elsewhere) fits.
const saveFailed = ""

// saveDir is the folder of the executable (feature 001 FR-006, feature 007 FR-011).
func saveDir(exe string) string { return filepath.Dir(exe) }
