// Package run is the scanner's end-to-end flow (feature 001 FR-006, FR-007, FR-009): scan,
// save the payload locally, and upload it. It never opens a browser; the caller offers the
// device link (the window's "Show my results" button, or the printed link in the console build).
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
	"sync"
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
	// Collect returns the system's raw readings and notes about sources that failed.
	Collect func(progress func(string)) (scan.Reading, []string)
	Now     func() time.Time
	HTTP    *http.Client
	// Out receives a plain-text log (the console build); io.Discard for the window.
	Out io.Writer
	// OnEvent, if set, receives the progress for the window (FR-014). It is called on Run's
	// goroutine.
	OnEvent func(Event)
	// SessionID comes from the executable's trailer (ReadSessionID); "" for a plain download.
	// With a session, a browser tab follows the progress, so it is also reported there
	// (feature 006 FR-002 to FR-004).
	SessionID string
}

// EventKind is the kind of a progress Event.
type EventKind int

const (
	// EventStep: Step (a scan step ID of shared/src/session.ts) has started.
	EventStep EventKind = iota
	// EventDone: the upload succeeded; DeviceURL is an http(s) link, SavedPath the local JSON.
	EventDone
	// EventFailed: Message says what went wrong and what to do, Detail is the technical cause,
	// and SavedPath is the local JSON if it was written. Retryable marks a temporary upload
	// failure: Runner.Upload may be called again (FR-015).
	EventFailed
)

type Event struct {
	Kind      EventKind
	Step      string
	DeviceURL string
	SavedPath string
	Message   string
	Detail    string
	Retryable bool
}

var stepLabels = map[string]string{
	"started":    "Reading device identity",
	"cpu_memory": "Reading CPU and memory",
	"storage":    "Reading storage",
	"battery":    "Reading battery",
	"upload":     "Uploading",
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

// Run performs one scan and upload and returns the process exit code (the console build). A
// failed upload is final here, so it is reported to the session at once.
func Run(cfg Config) int {
	r := NewRunner(cfg)
	if code := r.Scan(); code != ExitOK {
		return code
	}
	code := r.Upload()
	r.Finish()
	return code
}

// Runner keeps the saved scan, so the window can upload it again after a temporary failure
// (FR-015) without scanning again. Scan runs once; Upload may run several times; Finish reports
// a failure that is still pending to the session.
type Runner struct {
	cfg  Config
	body []byte
	path string

	mu sync.Mutex
	// pending is a temporary upload failure that the session has not been told about, because
	// the user may still retry.
	pending bool
}

func NewRunner(cfg Config) *Runner { return &Runner{cfg: cfg} }

func (r *Runner) emit(e Event) {
	if r.cfg.OnEvent != nil {
		r.cfg.OnEvent(e)
	}
}

func (r *Runner) step(id string) {
	fmt.Fprintf(r.cfg.Out, "  %s...\n", stepLabels[id])
	r.emit(Event{Kind: EventStep, Step: id})
	r.cfg.report(map[string]string{"type": "step", "step": id, "state": "running"})
}

// fail reports a final failure to the window and the session.
func (r *Runner) fail(code, message, detail string) {
	r.emit(Event{Kind: EventFailed, Message: message, Detail: detail, SavedPath: r.path})
	r.cfg.report(map[string]string{"type": "error", "code": code, "message": message})
}

// Scan reads the hardware and saves the payload next to the executable.
func (r *Runner) Scan() int {
	cfg, out := r.cfg, r.cfg.Out
	fmt.Fprintln(out, "leaaf scanner "+cfg.ScannerVersion)
	fmt.Fprintln(out, "Reads hardware facts only: no serial numbers, names, files, or network addresses.")
	fmt.Fprintln(out)

	raw, notes := cfg.Collect(r.step)
	device := raw.Payload(scan.Meta{ScannerVersion: cfg.ScannerVersion, ScannedAt: cfg.Now()})
	if cfg.SessionID != "" {
		device.SessionID = &cfg.SessionID
	}
	if device.ScanStatus == "partial" {
		fmt.Fprintln(out, "Some values could not be read and are reported as unknown:")
		for _, n := range notes {
			fmt.Fprintf(out, "  - %s\n", n)
		}
	}

	body, err := json.MarshalIndent(device, "", "  ")
	if err != nil {
		fmt.Fprintf(out, "Error: could not encode the scan: %v\n", err)
		r.fail("scanner_failed", "The scanner could not prepare its results. Run it again.", err.Error())
		return ExitSaveFailed
	}
	path := filepath.Join(cfg.OutDir, "leaaf-scan-"+cfg.Now().UTC().Format("20060102-150405")+".json")
	if err := os.WriteFile(path, body, 0o644); err != nil {
		fmt.Fprintf(out, "Error: could not save the scan to %s: %v\n", path, err)
		r.fail("scanner_failed", "The scanner could not save its results next to itself. Move it to another folder, such as Downloads, and run it again.", err.Error())
		return ExitSaveFailed
	}
	fmt.Fprintf(out, "Saved the scan to %s\n", path)
	r.body, r.path = body, path
	return ExitOK
}

// Upload sends the saved scan. After a temporary failure it can be called again.
func (r *Runner) Upload() int {
	out := r.cfg.Out
	r.mu.Lock()
	r.pending = false
	r.mu.Unlock()

	r.step("upload")
	res, err := upload(r.cfg, r.body)
	if err != nil {
		fmt.Fprintf(out, "\nUpload failed: %v\n", err)
		fmt.Fprintf(out, "Your scan is saved at %s. Run the scanner again when you are online.\n", r.path)
		var uerr *uploadError
		if errors.As(err, &uerr) && uerr.retryable {
			r.mu.Lock()
			r.pending = true
			r.mu.Unlock()
			r.emit(Event{Kind: EventFailed, Retryable: true, SavedPath: r.path, Detail: err.Error(),
				Message: "The scanner could not reach leaaf to upload its results. Your scan is saved, so check the internet connection and try again."})
		} else {
			r.fail("upload_failed", "The server did not accept the scan. Run the scanner again; if this keeps happening, the saved file shows what was sent.", err.Error())
		}
		return ExitUploadFailed
	}

	fmt.Fprintf(out, "\nDone. Your device page:\n  %s\n", res.DeviceURL)
	fmt.Fprintln(out, "Keep this link private: anyone with it can see this scan.")
	if r.cfg.SessionID != "" {
		fmt.Fprintln(out, "Your results are now shown in the browser tab that started this scan.")
	}
	r.emit(Event{Kind: EventDone, DeviceURL: res.DeviceURL, SavedPath: r.path})
	return ExitOK
}

// Finish tells the session about a temporary failure the user did not retry (the window was
// closed). Best effort, like all session reports.
func (r *Runner) Finish() {
	r.mu.Lock()
	pending := r.pending
	r.pending = false
	r.mu.Unlock()
	if pending {
		r.cfg.report(map[string]string{"type": "error", "code": "upload_failed",
			"message": "The scanner could not upload its results. Check the internet connection and run it again."})
	}
}

// report posts a progress event to the scan session. It is best effort: the scan and upload
// matter more than the progress display, so failures are ignored and the wait is short.
func (cfg Config) report(event map[string]string) {
	if cfg.SessionID == "" {
		return
	}
	endpoint, err := url.JoinPath(cfg.BackendURL, "/api/sessions", cfg.SessionID, "events")
	if err != nil {
		return
	}
	body, _ := json.Marshal(event)
	client := *cfg.HTTP
	client.Timeout = 3 * time.Second
	if resp, err := client.Post(endpoint, "application/json", bytes.NewReader(body)); err == nil {
		resp.Body.Close()
	}
}

// uploadError is an upload failure. retryable marks failures that may pass on a later attempt
// with the same body: no connection, a timeout, 429, or 5xx (FR-015). Rejections and invalid
// answers would fail again.
type uploadError struct {
	msg       string
	retryable bool
}

func (e *uploadError) Error() string { return e.msg }

func upload(cfg Config, body []byte) (*uploadResponse, error) {
	endpoint, err := url.JoinPath(cfg.BackendURL, "/api/devices")
	if err != nil {
		return nil, fmt.Errorf("invalid server address %q", cfg.BackendURL)
	}
	resp, err := cfg.HTTP.Post(endpoint, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, &uploadError{fmt.Sprintf("could not reach %s (%v)", cfg.BackendURL, rootCause(err)), true}
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
		return nil, &uploadError{fmt.Sprintf("the server answered HTTP %d", resp.StatusCode), true}
	}
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
