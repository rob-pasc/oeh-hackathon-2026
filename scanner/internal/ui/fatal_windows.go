package ui

import (
	"os"

	"golang.org/x/sys/windows"
)

// fatal reports a window failure in a message box, since the release build has no console.
func fatal(err error) {
	title, _ := windows.UTF16PtrFromString("leaaf scanner")
	msg, _ := windows.UTF16PtrFromString("The scanner window could not be shown:\n" + err.Error())
	windows.MessageBox(0, msg, title, windows.MB_OK|windows.MB_ICONERROR)
	os.Exit(1)
}
