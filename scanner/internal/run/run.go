// Package run is the scanner's end-to-end flow (feature 001 FR-006, FR-007, FR-009): scan,
// save the payload locally, upload it, and open the device page.
package run

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"leaaf.green/scanner/internal/scan"
)

// Exit codes.
const (
	ExitOK           = 0
	ExitUploadFailed = 1
	ExitSaveFailed   = 2
)

type Config struct {
	// BackendURL is the API origin, fixed at build time (FR-007).
	BackendURL     string
	ScannerVersion string
	// OutDir receives the JSON file; the directory of the executable in production.
	OutDir string
	// Collect returns raw readings and notes about sources that failed.
	Collect     func(progress func(string)) (scan.Raw, []string)
	Now         func() time.Time
	HTTP        *http.Client
	OpenBrowser func(url string) error
	Out         io.Writer
}

type uploadResponse struct {
	DeviceID  string `json:"device_id"`
	DeviceURL string `json:"device_url"`
}

type apiError struct {
	Message string `json:"message"`
	Fields  []struct {
		Path    string `json:"path"`
		Message string `json:"message"`
	} `json:"fields"`
}

// Run performs one scan and returns the process exit code.
func Run(cfg Config) int {
	out := cfg.Out
	fmt.Fprintln(out, "leaaf scanner "+cfg.ScannerVersion)
	fmt.Fprintln(out, "Reads hardware facts only: no serial numbers, names, files, or network addresses.")
	fmt.Fprintln(out)

	raw, notes := cfg.Collect(func(step string) { fmt.Fprintf(out, "  %s...\n", step) })
	device := scan.Normalize(raw, scan.Meta{ScannerVersion: cfg.ScannerVersion, ScannedAt: cfg.Now()})
	if device.ScanStatus == "partial" {
		fmt.Fprintln(out, "Some values could not be read and are reported as unknown:")
		for _, n := range notes {
			fmt.Fprintf(out, "  - %s\n", n)
		}
	}

	body, err := json.MarshalIndent(device, "", "  ")
	if err != nil {
		fmt.Fprintf(out, "Error: could not encode the scan: %v\n", err)
		return ExitSaveFailed
	}
	path := filepath.Join(cfg.OutDir, "leaaf-scan-"+cfg.Now().UTC().Format("20060102-150405")+".json")
	if err := os.WriteFile(path, body, 0o644); err != nil {
		fmt.Fprintf(out, "Error: could not save the scan to %s: %v\n", path, err)
		return ExitSaveFailed
	}
	fmt.Fprintf(out, "Saved the scan to %s\n", path)

	fmt.Fprintln(out, "  Uploading...")
	res, err := upload(cfg, body)
	if err != nil {
		fmt.Fprintf(out, "\nUpload failed: %v\n", err)
		fmt.Fprintf(out, "Your scan is saved at %s. Run the scanner again when you are online.\n", path)
		return ExitUploadFailed
	}

	fmt.Fprintf(out, "\nDone. Your device page:\n  %s\n", res.DeviceURL)
	fmt.Fprintln(out, "Keep this link private: anyone with it can see this scan.")
	if err := cfg.OpenBrowser(res.DeviceURL); err != nil {
		fmt.Fprintf(out, "Could not open the browser (%v). Open the link above yourself.\n", err)
	}
	return ExitOK
}

func upload(cfg Config, body []byte) (*uploadResponse, error) {
	endpoint, err := url.JoinPath(cfg.BackendURL, "/api/devices")
	if err != nil {
		return nil, fmt.Errorf("invalid server address %q", cfg.BackendURL)
	}
	resp, err := cfg.HTTP.Post(endpoint, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("could not reach %s (%v)", cfg.BackendURL, rootCause(err))
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode != http.StatusCreated {
		var e apiError
		if json.Unmarshal(data, &e) == nil && e.Message != "" {
			msg := fmt.Sprintf("the server rejected the scan (HTTP %d): %s", resp.StatusCode, e.Message)
			for _, f := range e.Fields {
				msg += fmt.Sprintf("\n  %s: %s", f.Path, f.Message)
			}
			return nil, errors.New(msg)
		}
		return nil, fmt.Errorf("the server answered HTTP %d", resp.StatusCode)
	}
	var r uploadResponse
	if err := json.Unmarshal(data, &r); err != nil || r.DeviceID == "" {
		return nil, errors.New("the server sent an unexpected answer")
	}
	// Only ever open a web page: a compromised or misconfigured server must not be able to make
	// the scanner launch another URL scheme.
	u, err := url.Parse(r.DeviceURL)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		return nil, errors.New("the server sent an invalid device link")
	}
	return &r, nil
}

// rootCause shortens net/http errors such as `Post "...": dial tcp ...: connection refused`.
func rootCause(err error) string {
	var uerr *url.Error
	if errors.As(err, &uerr) {
		err = uerr.Err
	}
	s := err.Error()
	if i := strings.LastIndex(s, ": "); i >= 0 {
		return s[i+2:]
	}
	return s
}
