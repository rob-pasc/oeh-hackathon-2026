//go:build !windows && (console || !(darwin || linux))

package main

import (
	"os"

	"leaaf.green/scanner/internal/run"
)

// main is the console build: on macOS and Linux with -tags console for development and CI
// machines without the windowing libraries, and on other systems, where it collects nothing
// (every value is null). It runs the save, upload, and session flow and prints the device link.
func main() {
	os.Exit(run.Run(config(os.Stdout)))
}
