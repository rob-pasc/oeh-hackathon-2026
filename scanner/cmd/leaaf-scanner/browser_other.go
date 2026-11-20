//go:build !windows

package main

import "os/exec"

// openBrowser opens url with xdg-open for the development window (-tags gui) on Linux.
func openBrowser(url string) error {
	return exec.Command("xdg-open", url).Start()
}
