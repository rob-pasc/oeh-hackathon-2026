package main

import "os/exec"

// openBrowser opens url in the default browser with macOS's open command, as the signed-in user.
func openBrowser(url string) error {
	return exec.Command("/usr/bin/open", url).Start()
}
