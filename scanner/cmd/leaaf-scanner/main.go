// Command leaaf-scanner reads an old Windows laptop's hardware facts, saves them next to the
// executable, uploads them to leaaf, and opens the private device page (feature 001).
//
// Build for Windows from any OS (the backend URL is fixed at build time, FR-007):
//
//	GOOS=windows GOARCH=amd64 go build -ldflags "-X main.backendURL=https://leaaf.green -X main.version=0.1.0" -o dist/leaaf-scanner.exe ./cmd/leaaf-scanner
package main

// The Windows resources (manifest requesting administrator rights, version info) live in
// winres/winres.json. The generated rsrc_windows_amd64.syso is committed so a plain go build
// links it; rerun go generate after editing the JSON.
//go:generate go run github.com/tc-hib/go-winres@v0.3.3 make --arch amd64

import (
	"bufio"
	"flag"
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

func main() {
	noWait := flag.Bool("no-wait", false, "exit without waiting for Enter")
	flag.Parse()

	outDir, sessionID := ".", ""
	if exe, err := os.Executable(); err == nil {
		outDir = filepath.Dir(exe)
		sessionID = run.ReadSessionID(exe)
	}
	code := run.Run(run.Config{
		BackendURL:     backendURL,
		ScannerVersion: version,
		OutDir:         outDir,
		Collect:        collect.Collect,
		Now:            time.Now,
		HTTP:           &http.Client{Timeout: 30 * time.Second},
		OpenBrowser:    openBrowser,
		Out:            os.Stdout,
		SessionID:      sessionID,
	})
	// A double-clicked console window closes on exit; keep it open so the link or error stays readable.
	if !*noWait {
		os.Stdout.WriteString("\nPress Enter to close.")
		bufio.NewReader(os.Stdin).ReadString('\n')
	}
	os.Exit(code)
}
