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

func testConfig(t *testing.T, backend string, opened *[]string) (Config, *bytes.Buffer) {
	t.Helper()
	out := &bytes.Buffer{}
	model := "20L5CTO1WW"
	return Config{
		BackendURL:     backend,
		ScannerVersion: "0.1.0-test",
		OutDir:         t.TempDir(),
		Collect: func(progress func(string)) (scan.Raw, []string) {
			progress("Reading device identity")
			return scan.Raw{ComputerSystem: &[]scan.ComputerSystem{{Model: &model}}}, []string{"Win32_Tpm: access denied"}
		},
		Now:  func() time.Time { return time.Date(2026, 11, 20, 9, 30, 0, 0, time.UTC) },
		HTTP: &http.Client{Timeout: 5 * time.Second},
		OpenBrowser: func(url string) error {
			*opened = append(*opened, url)
			return nil
		},
		Out: out,
	}, out
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
// readable error are printed, and the exit code is non-zero.
func TestUnreachableBackend(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := l.Addr().String()
	l.Close() // nothing listens here now

	var opened []string
	cfg, out := testConfig(t, "http://"+addr, &opened)
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
	if len(opened) != 0 {
		t.Errorf("browser opened after a failed upload: %v", opened)
	}
}

// FR-009: after a successful upload the device URL is printed and opened.
func TestSuccessfulUploadOpensDevicePage(t *testing.T) {
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

	var opened []string
	cfg, out := testConfig(t, srv.URL, &opened)
	if code := Run(cfg); code != ExitOK {
		t.Fatalf("exit code = %d\n%s", code, out)
	}
	saved, _ := os.ReadFile(savedFile(t, cfg.OutDir))
	if !bytes.Equal(got, saved) {
		t.Errorf("uploaded body differs from the saved file")
	}
	const url = "https://leaaf.example/d/q3Xk9vT2mB7pLw0cZr1sEa"
	if len(opened) != 1 || opened[0] != url {
		t.Errorf("opened = %v", opened)
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
	var opened []string
	cfg, out := testConfig(t, srv.URL, &opened)
	if code := Run(cfg); code != ExitUploadFailed {
		t.Fatalf("exit code = %d", code)
	}
	if !strings.Contains(out.String(), "/memory/total_gb: must be number") {
		t.Errorf("field error not shown:\n%s", out)
	}
}

func TestRefusesNonWebDeviceLink(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"device_id":"q3Xk9vT2mB7pLw0cZr1sEa","device_url":"file:///C:/Windows/System32/calc.exe"}`))
	}))
	defer srv.Close()
	var opened []string
	cfg, _ := testConfig(t, srv.URL, &opened)
	if code := Run(cfg); code == ExitOK || len(opened) != 0 {
		t.Errorf("code %d, opened %v: a non-http link must not be opened", code, opened)
	}
}
