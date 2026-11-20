//go:build gui && !windows

package ui

import (
	"fmt"
	"os"
)

// fatal reports a window failure of the development build on the terminal.
func fatal(err error) {
	fmt.Fprintln(os.Stderr, "The scanner window could not be shown:", err)
	os.Exit(1)
}
