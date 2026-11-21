//go:build !windows && !darwin

package main

import "os/exec"

// openBrowser opens url in the default browser on Linux with xdg-open. The window runs as the
// signed-in user, never as root (feature 007 FR-006), so the browser does too.
func openBrowser(url string) error {
	return exec.Command("xdg-open", url).Start()
}
