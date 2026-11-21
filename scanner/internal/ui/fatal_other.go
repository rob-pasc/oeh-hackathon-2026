//go:build (darwin || linux) && !console

package ui

import (
	"fmt"
	"os"
)

// fatal reports a window failure on the terminal, for example when no display is available.
func fatal(err error) {
	fmt.Fprintln(os.Stderr, "The scanner window could not be shown:", err)
	os.Exit(1)
}
