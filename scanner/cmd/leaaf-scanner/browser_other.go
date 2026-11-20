//go:build !windows

package main

import "os/exec"

// openBrowser opens url with xdg-open, so the flow can be tried on a development machine.
func openBrowser(url string) error {
	return exec.Command("xdg-open", url).Start()
}
