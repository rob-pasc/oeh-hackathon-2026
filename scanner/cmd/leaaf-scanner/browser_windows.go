package main

import "os/exec"

// openBrowser opens url in the default browser. run.Run only passes http(s) URLs.
//
// The scanner runs elevated (see winres/winres.json), and a browser started directly would
// inherit that. A new explorer.exe hands the URL to the already running shell, which belongs to
// the signed-in user and is not elevated, and then exits. It also avoids cmd.exe, which would
// interpret characters such as & in the URL.
func openBrowser(url string) error {
	return exec.Command("explorer.exe", url).Start()
}
