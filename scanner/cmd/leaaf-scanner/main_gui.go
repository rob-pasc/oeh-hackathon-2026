//go:build windows || gui

// The window: always on Windows; on other systems with -tags gui for development.
package main

import (
	"io"

	"leaaf.green/scanner/internal/ui"
)

func main() {
	ui.Run(ui.Options{Config: config(io.Discard), Version: version, OpenBrowser: openBrowser})
}
