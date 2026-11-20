package ui

import (
	"os"
	"regexp"
	"strings"
	"testing"

	"leaaf.green/scanner/internal/run"
)

// AC-014: nothing runs before Start scan; steps advance the bar; the end screens carry what
// they show.
func TestStateFlow(t *testing.T) {
	var s State
	if s.Phase != PhaseIdle || s.Progress() != 0 {
		t.Fatalf("initial state = %+v", s)
	}
	// Run events cannot arrive before Start; if one did, it must not skip the start screen.
	if got := s.Apply(run.Event{Kind: run.EventStep, Step: "storage"}); got.Phase != PhaseIdle {
		t.Errorf("event before Start changed the phase: %+v", got)
	}

	s = s.Start()
	if s.Phase != PhaseRunning || s.StepNumber() != 1 || s.StepLabel() != "Starting the scanner…" {
		t.Errorf("after Start: %+v", s)
	}
	s = s.Apply(run.Event{Kind: run.EventStep, Step: "storage"})
	if s.StepNumber() != 3 || s.Progress() != 0.6 || s.StepLabel() != "Checking storage health…" {
		t.Errorf("storage step: n=%d p=%v %q", s.StepNumber(), s.Progress(), s.StepLabel())
	}
	if again := s.Start(); again != s {
		t.Errorf("a second Start changed the state")
	}

	done := s.Apply(run.Event{Kind: run.EventDone, DeviceURL: "https://leaaf.green/d/x", SavedPath: `C:\scan.json`})
	if done.Phase != PhaseDone || done.DeviceURL != "https://leaaf.green/d/x" || done.SavedPath != `C:\scan.json` || done.Progress() != 1 {
		t.Errorf("done: %+v", done)
	}
	if late := done.Apply(run.Event{Kind: run.EventFailed, Message: "late"}); late != done {
		t.Errorf("event after done changed the state: %+v", late)
	}

	failed := s.Apply(run.Event{Kind: run.EventFailed, Message: "Check the connection.", Detail: "dial tcp", SavedPath: `C:\scan.json`})
	if failed.Phase != PhaseFailed || failed.Message != "Check the connection." || failed.Detail != "dial tcp" || failed.SavedPath == "" {
		t.Errorf("failed: %+v", failed)
	}
}

// The window and the browser's session tab must name the same steps in the same order with the
// same labels (shared/src/session.ts SCAN_STEP_IDS, web/src/api/types.ts SCAN_STEPS).
func TestStepsMatchSharedAndWeb(t *testing.T) {
	read := func(path string) string {
		b, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		return string(b)
	}
	var ids, labels []string
	for _, s := range Steps {
		ids = append(ids, s.ID)
		labels = append(labels, s.ID+"="+s.Label)
	}

	shared := regexp.MustCompile(`SCAN_STEP_IDS = \[([^\]]*)\]`).FindStringSubmatch(read("../../../shared/src/session.ts"))
	if shared == nil {
		t.Fatal("SCAN_STEP_IDS not found in shared/src/session.ts")
	}
	var sharedIDs []string
	for _, m := range regexp.MustCompile(`'([a-z_]+)'`).FindAllStringSubmatch(shared[1], -1) {
		sharedIDs = append(sharedIDs, m[1])
	}
	if strings.Join(sharedIDs, ",") != strings.Join(ids, ",") {
		t.Errorf("shared step IDs %v, window %v", sharedIDs, ids)
	}

	var webLabels []string
	for _, m := range regexp.MustCompile(`\{ id: '([a-z_]+)', running: '([^']*)' \}`).FindAllStringSubmatch(read("../../../web/src/api/types.ts"), -1) {
		webLabels = append(webLabels, m[1]+"="+m[2])
	}
	if strings.Join(webLabels, "|") != strings.Join(labels, "|") {
		t.Errorf("web labels %v, window %v", webLabels, labels)
	}
}
