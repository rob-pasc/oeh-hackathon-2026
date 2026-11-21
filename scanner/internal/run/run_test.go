package run

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"leaaf.green/scanner/internal/scan"
)

// testConfig records the run's progress events in *events. Config has no way to open a browser
// (FR-009: only the window's button does), so no test has to check that one stayed closed.
func testConfig(t *testing.T, backend string, events *[]Event) (Config, *bytes.Buffer) {
	t.Helper()
	out := &bytes.Buffer{}
	model := "20L5CTO1WW"
	return Config{
		BackendURL:     backend,
		ScannerVersion: "0.1.0-test",
		OutDir:         t.TempDir(),
		Collect: func(progress func(string, string)) (scan.Reading, []string) {
			progress("started", scan.StepRunning)
			return scan.Raw{ComputerSystem: &[]scan.ComputerSystem{{Model: &model}}}, []string{"Win32_Tpm: access denied"}
		},
		Now:     func() time.Time { return time.Date(2026, 11, 20, 9, 30, 0, 0, time.UTC) },
		HTTP:    &http.Client{Timeout: 5 * time.Second},
		Out:     out,
		OnEvent: func(e Event) { *events = append(*events, e) },
	}, out
}

func last(t *testing.T, events []Event) Event {
	t.Helper()
	if len(events) == 0 {
		t.Fatal("no events")
	}
	return events[len(events)-1]
}

func savedFile(t *testing.T, dir string) string {
	t.Helper()
	matches, _ := filepath.Glob(filepath.Join(dir, "leaaf-scan-*.json"))
	if len(matches) != 1 {
		t.Fatalf("want one saved scan in %s, found %v", dir, matches)
	}
	return matches[0]
}

// AC-005: with the backend unreachable, the JSON is saved next to the exe, its path and a
// readable error are printed and reported to the window, and the exit code is non-zero.
func TestUnreachableBackend(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := l.Addr().String()
	l.Close() // nothing listens here now

	var events []Event
	cfg, out := testConfig(t, "http://"+addr, &events)
	code := Run(cfg)
	if code == ExitOK {
		t.Fatalf("exit code = 0, want non-zero")
	}
	path := savedFile(t, cfg.OutDir)
	data, err := os.ReadFile(path)
	if err != nil || !json.Valid(data) || !bytes.Contains(data, []byte("20L5CTO1WW")) {
		t.Fatalf("saved file is not the scan: %s", data)
	}
	text := out.String()
	for _, want := range []string{"Upload failed", "could not reach", path} {
		if !strings.Contains(text, want) {
			t.Errorf("output lacks %q:\n%s", want, text)
		}
	}
	e := last(t, events)
	if e.Kind != EventFailed || e.SavedPath != path || e.Message == "" || !strings.Contains(e.Detail, "could not reach") {
		t.Errorf("last event = %+v", e)
	}
}

// FR-009, FR-014: the window sees each step, then the device URL and the saved file; the URL is
// printed for the console build.
func TestSuccessfulUploadReportsDevicePage(t *testing.T) {
	var got []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/devices" || r.Header.Get("Content-Type") != "application/json" {
			http.Error(w, "unexpected request", http.StatusBadRequest)
			return
		}
		got, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"device_id":"q3Xk9vT2mB7pLw0cZr1sEa","device_url":"https://leaaf.example/d/q3Xk9vT2mB7pLw0cZr1sEa"}`))
	}))
	defer srv.Close()

	var events []Event
	cfg, out := testConfig(t, srv.URL, &events)
	if code := Run(cfg); code != ExitOK {
		t.Fatalf("exit code = %d\n%s", code, out)
	}
	path := savedFile(t, cfg.OutDir)
	saved, _ := os.ReadFile(path)
	if !bytes.Equal(got, saved) {
		t.Errorf("uploaded body differs from the saved file")
	}
	const url = "https://leaaf.example/d/q3Xk9vT2mB7pLw0cZr1sEa"
	want := []Event{
		{Kind: EventStep, Step: "started"},
		{Kind: EventStep, Step: "upload"},
		{Kind: EventDone, DeviceURL: url, SavedPath: path},
	}
	if len(events) != len(want) {
		t.Fatalf("events = %+v", events)
	}
	for i := range want {
		if events[i] != want[i] {
			t.Errorf("event %d = %+v, want %+v", i, events[i], want[i])
		}
	}
	if !strings.Contains(out.String(), url) {
		t.Errorf("device URL not printed:\n%s", out)
	}
}

func TestRejectedUploadNamesFields(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error":"invalid_payload","message":"the device scan does not match the schema","fields":[{"path":"/memory/total_gb","message":"must be number"}]}`))
	}))
	defer srv.Close()
	var events []Event
	cfg, out := testConfig(t, srv.URL, &events)
	if code := Run(cfg); code != ExitUploadFailed {
		t.Fatalf("exit code = %d", code)
	}
	if !strings.Contains(out.String(), "/memory/total_gb: must be number") {
		t.Errorf("field error not shown:\n%s", out)
	}
	if e := last(t, events); e.Kind != EventFailed || !strings.Contains(e.Detail, "/memory/total_gb: must be number") {
		t.Errorf("last event = %+v", e)
	}
}

func TestRefusesNonWebDeviceLink(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"device_id":"q3Xk9vT2mB7pLw0cZr1sEa","device_url":"file:///C:/Windows/System32/calc.exe"}`))
	}))
	defer srv.Close()
	var events []Event
	cfg, _ := testConfig(t, srv.URL, &events)
	if code := Run(cfg); code == ExitOK || last(t, events).Kind != EventFailed {
		t.Errorf("code %d, events %+v: a non-http link must never reach the window's button", code, events)
	}
}

const testSession = "0123456789ABCDEFGHJKMNPQRS"

func TestReadSessionID(t *testing.T) {
	dir := t.TempDir()
	write := func(name, content string) string {
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
		return p
	}
	exe := "MZ\x90\x00" + strings.Repeat("\x00code", 100)
	cases := map[string]struct{ content, want string }{
		"downloaded copy":  {exe + SessionMarker + testSession, testSession},
		"dev build":        {exe, ""},
		"too short":        {"MZ", ""},
		"old format":       {exe + "LEAAFSCAN0:" + testSession, ""},
		"invalid ID chars": {exe + SessionMarker + "0123456789ABCDEFGHJKMNPQRI", ""},
		"trailer not last": {exe + SessionMarker + testSession + "x", ""},
	}
	for name, c := range cases {
		if got := ReadSessionID(write(name+".exe", c.content)); got != c.want {
			t.Errorf("%s: got %q, want %q", name, got, c.want)
		}
	}
	if got := ReadSessionID(filepath.Join(dir, "missing.exe")); got != "" {
		t.Errorf("missing file: %q", got)
	}
	if len(SessionMarker)+len(testSession) != 37 {
		t.Errorf("trailer is %d bytes, want 37", len(SessionMarker)+len(testSession))
	}
}

// With a session, progress goes to the session and the upload carries the ID.
func TestSessionFromBundle(t *testing.T) {
	cases := map[string]string{
		"/Users/x/Downloads/leaaf-scanner-" + testSession + ".app/Contents/MacOS/leaaf-scanner":                    testSession,
		"/private/var/folders/ab/T/AppTranslocation/1234/d/leaaf-scanner-" + testSession + ".app/Contents/MacOS/x": testSession,
		"/Users/x/Downloads/leaaf-scanner.app/Contents/MacOS/leaaf-scanner":                                        "",
		"/Users/x/Downloads/leaaf-scanner-not-a-session.app/Contents/MacOS/leaaf-scanner":                          "",
		// Only the innermost bundle counts.
		"/Users/x/leaaf-scanner-" + testSession + ".app/Contents/Helpers/other.app/Contents/MacOS/x": "",
		"/home/x/Downloads/leaaf-scanner": "",
	}
	for path, want := range cases {
		if got := SessionFromBundle(path); got != want {
			t.Errorf("%s: got %q, want %q", path, got, want)
		}
	}
}

func TestSessionRunReportsProgress(t *testing.T) {
	var events []map[string]string
	var uploaded map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/sessions/" + testSession + "/events":
			var e map[string]string
			json.NewDecoder(r.Body).Decode(&e)
			events = append(events, e)
			w.WriteHeader(http.StatusNoContent)
		case "/api/devices":
			json.NewDecoder(r.Body).Decode(&uploaded)
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{"device_id":"q3Xk9vT2mB7pLw0cZr1sEa","device_url":"https://leaaf.example/d/q3Xk9vT2mB7pLw0cZr1sEa"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	var local []Event
	cfg, out := testConfig(t, srv.URL, &local)
	cfg.SessionID = testSession
	if code := Run(cfg); code != ExitOK {
		t.Fatalf("exit %d\n%s", code, out)
	}
	var steps []string
	for _, e := range events {
		if e["type"] != "step" || e["state"] != "running" {
			t.Errorf("unexpected event %v", e)
		}
		steps = append(steps, e["step"])
	}
	if strings.Join(steps, ",") != "started,upload" {
		t.Errorf("steps = %v", steps)
	}
	if uploaded["session_id"] != testSession {
		t.Errorf("upload session_id = %v", uploaded["session_id"])
	}
	if e := last(t, local); e.Kind != EventDone {
		t.Errorf("window not told the scan is done: %+v", e)
	}
	saved, _ := os.ReadFile(savedFile(t, cfg.OutDir))
	if !bytes.Contains(saved, []byte(testSession)) {
		t.Errorf("saved file lacks the session ID")
	}
}

func TestSessionRunReportsUploadFailure(t *testing.T) {
	var events []map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/events") {
			var e map[string]string
			json.NewDecoder(r.Body).Decode(&e)
			events = append(events, e)
			w.WriteHeader(http.StatusNoContent)
			return
		}
		http.Error(w, "down", http.StatusServiceUnavailable)
	}))
	defer srv.Close()
	var local []Event
	cfg, _ := testConfig(t, srv.URL, &local)
	cfg.SessionID = testSession
	if code := Run(cfg); code != ExitUploadFailed {
		t.Fatalf("exit %d", code)
	}
	last := events[len(events)-1]
	if last["type"] != "error" || last["code"] != "upload_failed" || last["message"] == "" {
		t.Errorf("last event = %v", last)
	}
}

// Without a session (dev build or plain download) nothing is posted to a session and the payload has no session_id.
func TestPlainRunHasNoSession(t *testing.T) {
	var paths []string
	var uploaded map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		json.NewDecoder(r.Body).Decode(&uploaded)
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"device_id":"q3Xk9vT2mB7pLw0cZr1sEa","device_url":"https://leaaf.example/d/q3Xk9vT2mB7pLw0cZr1sEa"}`))
	}))
	defer srv.Close()
	var events []Event
	cfg, _ := testConfig(t, srv.URL, &events)
	Run(cfg)
	if len(paths) != 1 || paths[0] != "/api/devices" {
		t.Errorf("requests = %v", paths)
	}
	if _, ok := uploaded["session_id"]; ok {
		t.Errorf("payload has session_id without a session")
	}
}

// fakeServer answers uploads with the given statuses in turn (the last one repeats) and records
// uploaded bodies and session events.
type fakeServer struct {
	statuses []int
	uploads  [][]byte
	events   []map[string]string
}

func (f *fakeServer) handler(w http.ResponseWriter, r *http.Request) {
	if strings.HasSuffix(r.URL.Path, "/events") {
		var e map[string]string
		json.NewDecoder(r.Body).Decode(&e)
		f.events = append(f.events, e)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	body, _ := io.ReadAll(r.Body)
	f.uploads = append(f.uploads, body)
	status := f.statuses[min(len(f.uploads), len(f.statuses))-1]
	w.WriteHeader(status)
	if status == http.StatusCreated {
		w.Write([]byte(`{"device_id":"q3Xk9vT2mB7pLw0cZr1sEa","device_url":"https://leaaf.example/d/q3Xk9vT2mB7pLw0cZr1sEa"}`))
	} else if status == http.StatusBadRequest {
		w.Write([]byte(`{"error":"invalid_payload","message":"the device scan does not match the schema"}`))
	}
}

func (f *fakeServer) eventTypes() string {
	var types []string
	for _, e := range f.events {
		types = append(types, e["type"]+":"+e["step"]+e["code"])
	}
	return strings.Join(types, ",")
}

// AC-015: a temporary failure offers a retry, keeps the session open, and the retry uploads the
// same saved scan without scanning again.
func TestRetryAfterTemporaryFailure(t *testing.T) {
	f := &fakeServer{statuses: []int{http.StatusServiceUnavailable, http.StatusCreated}}
	srv := httptest.NewServer(http.HandlerFunc(f.handler))
	defer srv.Close()
	var events []Event
	cfg, _ := testConfig(t, srv.URL, &events)
	cfg.SessionID = testSession
	scans := 0
	collect := cfg.Collect
	cfg.Collect = func(p func(string, string)) (scan.Reading, []string) { scans++; return collect(p) }

	r := NewRunner(cfg)
	if code := r.Scan(); code != ExitOK {
		t.Fatalf("scan: %d", code)
	}
	if code := r.Upload(); code != ExitUploadFailed {
		t.Fatalf("first upload: %d", code)
	}
	if e := last(t, events); e.Kind != EventFailed || !e.Retryable || e.SavedPath == "" {
		t.Errorf("after 503: %+v", e)
	}
	if got := f.eventTypes(); got != "step:started,step:upload" {
		t.Errorf("session got %s; a temporary failure must not end it", got)
	}

	if code := r.Upload(); code != ExitOK {
		t.Fatalf("retry: %d", code)
	}
	if e := last(t, events); e.Kind != EventDone {
		t.Errorf("after retry: %+v", e)
	}
	r.Finish() // nothing pending after success
	if scans != 1 || len(f.uploads) != 2 || !bytes.Equal(f.uploads[0], f.uploads[1]) {
		t.Errorf("scans %d, uploads %d, same body %v", scans, len(f.uploads), len(f.uploads) == 2 && bytes.Equal(f.uploads[0], f.uploads[1]))
	}
	if got := f.eventTypes(); got != "step:started,step:upload,step:upload" {
		t.Errorf("session events %s", got)
	}
}

// Closing the window after a temporary failure tells the session once.
func TestFinishReportsPendingFailure(t *testing.T) {
	f := &fakeServer{statuses: []int{http.StatusBadGateway}}
	srv := httptest.NewServer(http.HandlerFunc(f.handler))
	defer srv.Close()
	var events []Event
	cfg, _ := testConfig(t, srv.URL, &events)
	cfg.SessionID = testSession
	r := NewRunner(cfg)
	r.Scan()
	r.Upload()
	r.Finish()
	r.Finish()
	if got := f.eventTypes(); got != "step:started,step:upload,error:upload_failed" {
		t.Errorf("session events %s", got)
	}
}

// A rejection would fail again, so it is final: no retry, and the session is told at once.
func TestRejectionIsFinal(t *testing.T) {
	f := &fakeServer{statuses: []int{http.StatusBadRequest}}
	srv := httptest.NewServer(http.HandlerFunc(f.handler))
	defer srv.Close()
	var events []Event
	cfg, _ := testConfig(t, srv.URL, &events)
	cfg.SessionID = testSession
	r := NewRunner(cfg)
	r.Scan()
	r.Upload()
	if e := last(t, events); e.Kind != EventFailed || e.Retryable {
		t.Errorf("after 400: %+v", e)
	}
	if got := f.eventTypes(); got != "step:started,step:upload,error:upload_failed" {
		t.Errorf("session events %s", got)
	}
	r.Finish()
	if n := len(f.events); n != 3 {
		t.Errorf("Finish sent another event: %d events", n)
	}
}

func TestUnreachableIsRetryable(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := l.Addr().String()
	l.Close()
	var events []Event
	cfg, _ := testConfig(t, "http://"+addr, &events)
	r := NewRunner(cfg)
	r.Scan()
	r.Upload()
	if e := last(t, events); !e.Retryable {
		t.Errorf("unreachable server should be retryable: %+v", e)
	}
}

// AC-017 (feature 001 FR-017): the session receives each reading step's outcome after its start,
// in step order; the window and the console still show only the starting steps.
func TestSessionReceivesStepOutcomes(t *testing.T) {
	var events []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/sessions/" + testSession + "/events":
			var e map[string]string
			json.NewDecoder(r.Body).Decode(&e)
			events = append(events, e["step"]+":"+e["state"])
			w.WriteHeader(http.StatusNoContent)
		case "/api/devices":
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{"device_id":"q3Xk9vT2mB7pLw0cZr1sEa","device_url":"https://leaaf.example/d/q3Xk9vT2mB7pLw0cZr1sEa"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	var local []Event
	cfg, out := testConfig(t, srv.URL, &local)
	cfg.SessionID = testSession
	// The order the Windows collector reports in, on readings with CPU, memory and a disk but
	// no battery (a desktop).
	raw := scan.Raw{Processors: &[]scan.Processor{{}}, Memory: &[]scan.PhysicalMemory{{}}, Disks: &[]scan.PhysicalDisk{{}}, Batteries: &[]scan.Battery{}}
	cfg.Collect = func(progress func(string, string)) (scan.Reading, []string) {
		progress("started", scan.StepRunning)
		for _, step := range []string{"cpu_memory", "storage", "battery"} {
			progress(step, scan.StepRunning)
			progress(step, scan.StepState(step, raw))
		}
		return raw, nil
	}
	if code := Run(cfg); code != ExitOK {
		t.Fatalf("exit %d\n%s", code, out)
	}
	want := "started:running,cpu_memory:running,cpu_memory:done,storage:running,storage:done,battery:running,battery:skipped,upload:running"
	if got := strings.Join(events, ","); got != want {
		t.Errorf("session events\n got %s\nwant %s", got, want)
	}
	var windowSteps []string
	for _, e := range local {
		if e.Kind == EventStep {
			windowSteps = append(windowSteps, e.Step)
		}
	}
	if got := strings.Join(windowSteps, ","); got != "started,cpu_memory,storage,battery,upload" {
		t.Errorf("window steps = %s", got)
	}
	if n := strings.Count(out.String(), "Reading storage"); n != 1 {
		t.Errorf("console logs storage %d times, want once", n)
	}
}

func TestSaveFailureUsesTheConfiguredMessage(t *testing.T) {
	for _, custom := range []string{"", "The scanner could not save its results in your home folder."} {
		var events []Event
		cfg, _ := testConfig(t, "http://127.0.0.1:1", &events)
		cfg.OutDir = filepath.Join(t.TempDir(), "missing", "folder")
		cfg.SaveFailed = custom
		if code := NewRunner(cfg).Scan(); code != ExitSaveFailed {
			t.Fatalf("scan: %d", code)
		}
		e := last(t, events)
		want := custom
		if want == "" {
			want = "The scanner could not save its results next to itself. Move it to another folder, such as Downloads, and run it again."
		}
		if e.Kind != EventFailed || e.Message != want {
			t.Errorf("got %q, want %q", e.Message, want)
		}
	}
}
