//go:build !windows

package main

import (
	"os"

	"leaaf.green/scanner/internal/run"
)

// main is the development build for other operating systems: it collects nothing (every value
// is null) but runs the save, upload, and session flow and prints the device link.
func main() {
	os.Exit(run.Run(config(os.Stdout)))
}
