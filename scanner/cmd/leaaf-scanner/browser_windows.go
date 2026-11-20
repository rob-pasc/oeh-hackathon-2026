package main

import "os/exec"

// openBrowser opens url in the default browser. run.Run only passes http(s) URLs.
// rundll32 avoids cmd.exe, which would interpret characters such as & in the URL.
func openBrowser(url string) error {
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}
