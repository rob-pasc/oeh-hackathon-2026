//go:build windows || ((darwin || linux) && !console)

// The window (feature 001 FR-014, feature 007 FR-003): on Windows always, on macOS and Linux unless
// built with -tags console.
package main

import (
	"io"

	"leaaf.green/scanner/internal/ui"
)

func main() {
	ui.Run(ui.Options{Config: config(io.Discard), Version: version, OpenBrowser: openBrowser})
}
