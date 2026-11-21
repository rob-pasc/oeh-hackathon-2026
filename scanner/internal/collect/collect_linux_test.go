//go:build linux

package collect

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDecodePrivileged(t *testing.T) {
	p, err := decodePrivileged([]byte(`{"memory":{"slots_total":2,"modules":[{"size_mib":8192,"type":34,"speed_mts":5600,"config_mts":5600}]},"disk_health":{"nvme0n1":"healthy"}}`))
	if err != nil || len(p.Memory.Modules) != 1 || p.DiskHealth["nvme0n1"] != "healthy" {
		t.Fatalf("got %+v, %v", p, err)
	}
	// Anything outside the allowlist is refused rather than ignored (feature 007 FR-008).
	for _, bad := range []string{
		`{"memory":{"modules":[{"size_mib":8192,"serial":"PLANTED"}]}}`,
		`{"host_name":"laptop"}`,
		`{"disk_health":{"../../etc/shadow":"healthy"}}`,
		`not json`,
	} {
		if _, err := decodePrivileged([]byte(bad)); err == nil {
			t.Errorf("accepted %s", bad)
		}
	}
}

// stubPkexec makes privileged() run script instead of pkexec.
func stubPkexec(t *testing.T, script string) {
	t.Helper()
	if os.Geteuid() == 0 {
		t.Skip("running as root takes the in-process path")
	}
	path := filepath.Join(t.TempDir(), "pkexec")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+script+"\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	old := lookPkexec
	lookPkexec = func() (string, error) { return path, nil }
	t.Cleanup(func() { lookPkexec = old })
}

func TestPrivilegedDeclined(t *testing.T) {
	stubPkexec(t, "exit 126")
	p, note := privileged()
	if p != nil || !strings.Contains(note, "not granted") {
		t.Fatalf("got %+v, %q", p, note)
	}
}

func TestPrivilegedMissingPkexec(t *testing.T) {
	old := lookPkexec
	lookPkexec = func() (string, error) { return "", errors.New("not found") }
	t.Cleanup(func() { lookPkexec = old })
	if p, note := privileged(); p != nil || !strings.Contains(note, "not installed") {
		t.Fatalf("got %+v, %q", p, note)
	}
}

func TestPrivilegedPassesOnlyTheFlag(t *testing.T) {
	// The stub prints what the helper would; it also checks that the flag is the only argument.
	stubPkexec(t, `[ "$#" -eq 2 ] && [ "$2" = "--privileged-helper" ] || exit 3
echo '{"disk_health":{"sda":"unhealthy"}}'`)
	p, note := privileged()
	if p == nil || p.DiskHealth["sda"] != "unhealthy" || note != "" {
		t.Fatalf("got %+v, %q", p, note)
	}
}

func TestPrivilegedRejectsBadOutput(t *testing.T) {
	stubPkexec(t, `echo '{"serial_number":"PLANTED"}'`)
	if p, note := privileged(); p != nil || !strings.Contains(note, "invalid output") {
		t.Fatalf("got %+v, %q", p, note)
	}
}
