//go:build linux

package collect

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"time"

	"leaaf.green/scanner/internal/scan"
)

// The password dialog may stay open for a while; the scan waits this long for the helper
// (the 30 s scan target excludes the dialog, feature 007 NFR performance).
const helperTimeout = 3 * time.Minute

// Collect reads the Linux sources as the signed-in user, after asking once for root through
// pkexec for the fields only root can read (feature 007 FR-005, FR-006). Declining, a missing
// pkexec, or a failing helper leave those fields null; the scan always continues.
// progress receives the scan step IDs of shared/src/session.ts, each with the state "running";
// the web app counts a step as done when the next one starts (feature 006 FR-041).
func Collect(progress func(step, state string)) (scan.Reading, []string) {
	progress("started", scan.StepRunning)
	priv, helperNote := privileged()
	raw, notes := scan.ReadLinux(os.DirFS("/"))
	raw.Privileged = priv
	if helperNote != "" {
		notes = append(notes, helperNote)
	}
	// The sources are read in one pass; the remaining steps keep the window and the session
	// tab in step with the other systems.
	progress("cpu_memory", scan.StepRunning)
	progress("storage", scan.StepRunning)
	progress("battery", scan.StepRunning)
	return raw, notes
}

// lookPkexec finds pkexec; tests replace it with a stub.
var lookPkexec = func() (string, error) { return exec.LookPath("pkexec") }

// privileged returns the root helper's readings, running it in-process when the scanner already
// runs as root and through pkexec otherwise.
func privileged() (*scan.Privileged, string) {
	if os.Geteuid() == 0 {
		p := readPrivileged()
		return &p, ""
	}
	pkexec, err := lookPkexec()
	if err != nil {
		return nil, "root helper: pkexec is not installed, so RAM details and drive health are unknown"
	}
	exe, err := os.Executable()
	if err != nil {
		return nil, "root helper: " + err.Error()
	}
	ctx, cancel := context.WithTimeout(context.Background(), helperTimeout)
	defer cancel()
	var out bytes.Buffer
	cmd := exec.CommandContext(ctx, pkexec, exe, HelperFlag)
	cmd.Stdout = &limitedWriter{w: &out, n: 64 << 10}
	if err := cmd.Run(); err != nil {
		var exit *exec.ExitError
		// pkexec exits 126 when the dialog is dismissed and 127 when authorization fails.
		if errors.As(err, &exit) && (exit.ExitCode() == 126 || exit.ExitCode() == 127) {
			return nil, "root helper: root access was not granted, so RAM details and drive health are unknown"
		}
		return nil, "root helper: " + err.Error()
	}
	p, err := decodePrivileged(out.Bytes())
	if err != nil {
		return nil, "root helper: " + err.Error()
	}
	return p, ""
}

// decodePrivileged accepts only the fields of scan.Privileged, so a helper cannot hand over
// anything else (feature 007 FR-008).
func decodePrivileged(data []byte) (*scan.Privileged, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	var p scan.Privileged
	if err := dec.Decode(&p); err != nil {
		return nil, fmt.Errorf("invalid output: %w", err)
	}
	if p.Memory != nil && len(p.Memory.Modules) > 64 {
		return nil, errors.New("invalid output: implausible module count")
	}
	for name := range p.DiskHealth {
		if !scan.HelperDisk.MatchString(name) {
			return nil, fmt.Errorf("invalid output: unexpected disk %q", name)
		}
	}
	return &p, nil
}

// limitedWriter keeps at most n bytes; the helper's output is small, anything larger is cut off
// and then fails to decode.
type limitedWriter struct {
	w io.Writer
	n int
}

func (l *limitedWriter) Write(p []byte) (int, error) {
	if l.n <= 0 {
		return len(p), nil
	}
	k := min(len(p), l.n)
	l.n -= k
	if _, err := l.w.Write(p[:k]); err != nil {
		return 0, err
	}
	return len(p), nil
}
