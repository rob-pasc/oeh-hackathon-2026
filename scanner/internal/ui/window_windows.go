//go:build windows

package ui

import (
	"os"

	"gioui.org/app"
	"gioui.org/io/system"
	"gioui.org/layout"
	"gioui.org/op"
	"golang.org/x/sys/windows"

	"leaaf.green/scanner/internal/run"
)

// Run shows the window and exits the process when it is closed. It must be called from main:
// Gio's event loop needs the main goroutine, and app.Main never returns on Windows.
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

// fatal reports a window failure in a message box, since the release build has no console.
func fatal(err error) {
	title, _ := windows.UTF16PtrFromString("leaaf scanner")
	msg, _ := windows.UTF16PtrFromString("The scanner window could not be shown:\n" + err.Error())
	windows.MessageBox(0, msg, title, windows.MB_OK|windows.MB_ICONERROR)
	os.Exit(1)
}

func (w *window) loop(win *app.Window) error {
	var ops op.Ops
	for {
		switch e := win.Event().(type) {
		case app.DestroyEvent:
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
		go run.Run(cfg)
	}
	if w.results.Clicked(gtx) && w.state.DeviceURL != "" {
		// run only reports http(s) device links, so this cannot launch another URL scheme.
		w.openFailed = w.opts.OpenBrowser(w.state.DeviceURL) != nil
	}
	if w.close.Clicked(gtx) {
		win.Perform(system.ActionClose)
	}
}
