// Package ui is the scanner window (feature 001 FR-014): a start screen, step progress, and a
// completion or error screen, drawn with Gio in the web app's style.
//
// This file is the window's state, kept free of Gio so it is tested on every platform; the
// drawing is in window_windows.go.
package ui

import "leaaf.green/scanner/internal/run"

type Phase int

const (
	PhaseIdle Phase = iota
	PhaseRunning
	PhaseDone
	PhaseFailed
)

// Steps are the scan steps in order, with the web app's labels (web/src/api/types.ts SCAN_STEPS),
// so the window and the browser's session tab say the same thing. model_test.go checks both lists.
var Steps = []struct{ ID, Label string }{
	{"started", "Starting the scanner…"},
	{"cpu_memory", "Reading CPU & memory…"},
	{"storage", "Checking storage health…"},
	{"battery", "Reading battery…"},
	{"upload", "Uploading & analysing…"},
}

type State struct {
	Phase Phase
	// Step is the current step ID while running.
	Step      string
	DeviceURL string
	SavedPath string
	Message   string
	Detail    string
	// Retryable: the upload failed temporarily and Try again is offered (FR-015).
	Retryable bool
	// Session is true when a browser tab follows this scan (the exe carries a session ID).
	Session bool
}

// Start is the transition for the Start scan button.
func (s State) Start() State {
	if s.Phase != PhaseIdle {
		return s
	}
	s.Phase = PhaseRunning
	s.Step = Steps[0].ID
	return s
}

// Retry is the transition for Try again: back to the upload step, keeping the saved file.
func (s State) Retry() State {
	if s.Phase != PhaseFailed || !s.Retryable {
		return s
	}
	s.Phase, s.Step = PhaseRunning, "upload"
	s.Message, s.Detail, s.Retryable = "", "", false
	return s
}

// Apply returns the state after a run event. Events after the scan has finished are ignored.
func (s State) Apply(e run.Event) State {
	if s.Phase != PhaseRunning {
		return s
	}
	switch e.Kind {
	case run.EventStep:
		s.Step = e.Step
	case run.EventDone:
		s.Phase = PhaseDone
		s.DeviceURL, s.SavedPath = e.DeviceURL, e.SavedPath
	case run.EventFailed:
		s.Phase = PhaseFailed
		s.Message, s.Detail, s.SavedPath, s.Retryable = e.Message, e.Detail, e.SavedPath, e.Retryable
	}
	return s
}

// StepNumber is the 1-based position of the current step, or 0 when not running.
func (s State) StepNumber() int {
	if s.Phase != PhaseRunning {
		return 0
	}
	for i, st := range Steps {
		if st.ID == s.Step {
			return i + 1
		}
	}
	return 0
}

// StepLabel is the text for the current step.
func (s State) StepLabel() string {
	if n := s.StepNumber(); n > 0 {
		return Steps[n-1].Label
	}
	return "Scanning…"
}

// Progress is the progress bar's fill: the share of steps reached, full when done.
func (s State) Progress() float32 {
	switch s.Phase {
	case PhaseDone:
		return 1
	case PhaseRunning:
		return float32(s.StepNumber()) / float32(len(Steps))
	}
	return 0
}
