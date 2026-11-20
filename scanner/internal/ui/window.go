//go:build windows || gui

// The event loop. It is built on Windows and, with -tags gui, on Linux and macOS for development
// (that needs cgo and the platform's windowing libraries).

package ui

import (
	"os"

	"gioui.org/app"
	"gioui.org/io/system"
	"gioui.org/layout"
	"gioui.org/op"

	"leaaf.green/scanner/internal/run"
)

// Run shows the window and exits the process when it is closed. It must be called from main:
// Gio's event loop needs the main goroutine, and app.Main never returns on desktop platforms.
func Run(opts Options) {
	th, err := theme()
	if err != nil {
		fatal(err)
	}
	w := &window{opts: opts, th: th, state: State{Session: opts.Config.SessionID != ""}}
	go func() {
		win := new(app.Window)
		win.Option(
			app.Title("leaaf scanner"),
			app.Size(windowWidth, windowHeight),
			app.MinSize(windowWidth, windowHeight),
			app.MaxSize(windowWidth, windowHeight),
		)
		if err := w.loop(win); err != nil {
			fatal(err)
		}
		os.Exit(0)
	}()
	app.Main()
}

func (w *window) loop(win *app.Window) error {
	var ops op.Ops
	for {
		switch e := win.Event().(type) {
		case app.DestroyEvent:
			// Closed with Close or the title bar: a temporary upload failure the user did not
			// retry is now final, so tell the waiting session (FR-015).
			w.mu.Lock()
			runner := w.runner
			w.mu.Unlock()
			if runner != nil {
				runner.Finish()
			}
			return e.Err
		case app.FrameEvent:
			gtx := app.NewContext(&ops, e)
			w.update(gtx, win)
			w.layout(gtx)
			e.Frame(gtx.Ops)
		}
	}
}

// update applies button clicks and the scan's events to the state.
func (w *window) update(gtx layout.Context, win *app.Window) {
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, e := range w.events {
		w.state = w.state.Apply(e)
	}
	w.events = nil

	if w.start.Clicked(gtx) && w.state.Phase == PhaseIdle {
		w.state = w.state.Start()
		cfg := w.opts.Config
		cfg.OnEvent = func(e run.Event) {
			w.mu.Lock()
			w.events = append(w.events, e)
			w.mu.Unlock()
			win.Invalidate()
		}
		w.runner = run.NewRunner(cfg)
		go func(r *run.Runner) {
			if r.Scan() == run.ExitOK {
				r.Upload()
			}
		}(w.runner)
	}
	if w.retry.Clicked(gtx) && w.state.Phase == PhaseFailed && w.state.Retryable {
		// Uploads the saved scan again; the scan itself is not repeated.
		w.state = w.state.Retry()
		go w.runner.Upload()
	}
	if w.results.Clicked(gtx) && w.state.DeviceURL != "" {
		// run only reports http(s) device links, so this cannot launch another URL scheme.
		w.openFailed = w.opts.OpenBrowser(w.state.DeviceURL) != nil
	}
	if w.close.Clicked(gtx) {
		win.Perform(system.ActionClose)
	}
}
