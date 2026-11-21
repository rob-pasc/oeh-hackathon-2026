// Command leaaf-scanner reads an old Windows laptop's hardware facts, saves them next to the
// executable, and uploads them to leaaf (feature 001). On Windows it is a small window
// (main_gui.go, FR-014). Elsewhere it is a console program for development (main_other.go), or
// the same window with -tags gui.
//
// Build for Windows from any OS (the backend URL is fixed at build time, FR-007; -H windowsgui
// stops a console window from opening behind the scanner window):
//
//	GOOS=windows GOARCH=amd64 go build -ldflags "-H windowsgui -X main.backendURL=https://leaaf.green -X main.version=0.1.0" -o dist/leaaf-scanner.exe ./cmd/leaaf-scanner
package main

// The Windows resources (manifest requesting administrator rights, version info) live in
// winres/winres.json. The generated rsrc_windows_amd64.syso is committed so a plain go build
// links it; rerun go generate after editing the JSON.
//go:generate go run github.com/tc-hib/go-winres@v0.3.3 make --arch amd64

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"leaaf.green/scanner/internal/collect"
	"leaaf.green/scanner/internal/run"
)

// Set with -ldflags "-X main.backendURL=... -X main.version=...".
var (
	backendURL = "http://127.0.0.1:3000"
	version    = "0.1.0-dev"
)

// init starts the Linux root helper instead of the scanner when pkexec runs the executable with
// HelperFlag (feature 007 FR-006). It runs before the window code, so the helper never touches
// the display, and it accepts no other arguments.
func init() {
	if len(os.Args) == 2 && os.Args[1] == collect.HelperFlag {
		os.Exit(collect.RunHelper(os.Stdout))
	}
}

// config is the scan configuration shared by the window and the console build. The JSON is
// saved next to the executable, and a session ID is read from its trailer (feature 006).
func config(out io.Writer) run.Config {
	outDir, sessionID := ".", ""
	if exe, err := os.Executable(); err == nil {
		outDir = filepath.Dir(exe)
		sessionID = run.ReadSessionID(exe)
	}
	return run.Config{
		BackendURL:     backendURL,
		ScannerVersion: version,
		OutDir:         outDir,
		Collect:        collect.Collect,
		Now:            time.Now,
		HTTP:           &http.Client{Timeout: 30 * time.Second},
		Out:            out,
		SessionID:      sessionID,
	}
}
