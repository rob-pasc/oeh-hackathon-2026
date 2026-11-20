//go:build screenshot

package ui

// Renders every screen to a PNG for a visual check on a development machine, without Windows:
//
//	SCREENSHOT_DIR=/tmp/shots go test -tags screenshot -run TestScreenshots ./internal/ui
//
// It needs cgo and an OpenGL ES/EGL driver (Gio's headless renderer), so it is not part of CI.

import (
	"image"
	"image/png"
	"os"
	"path/filepath"
	"testing"
	"time"

	"gioui.org/gpu/headless"
	"gioui.org/io/input"
	"gioui.org/layout"
	"gioui.org/op"
	"gioui.org/unit"

	"leaaf.green/scanner/internal/run"
)

func runEvent(step string) run.Event { return run.Event{Kind: run.EventStep, Step: step} }

func TestScreenshots(t *testing.T) {
	dir := os.Getenv("SCREENSHOT_DIR")
	if dir == "" {
		t.Skip("set SCREENSHOT_DIR")
	}
	th, err := theme()
	if err != nil {
		t.Fatal(err)
	}
	running := State{}.Start()
	running = running.Apply(runEvent("storage"))
	states := map[string]State{
		"1-start":   {},
		"2-running": running,
		"3-done":    {Phase: PhaseDone, DeviceURL: "https://leaaf.green/d/q3Xk9vT2mB7pLw0cZr1sEa", SavedPath: `C:\Users\Example\Downloads\leaaf-scan-20261120-093000.json`, Session: true},
		"4-failed": {Phase: PhaseFailed, Message: "The scanner could not upload its results. Check the internet connection and run it again.",
			Detail: "could not reach https://leaaf.green (no such host)", SavedPath: `C:\Users\Example\Downloads\leaaf-scan-20261120-093000.json`},
	}
	const scale = 2 // like a 200 % display
	size := image.Pt(windowWidth*scale, windowHeight*scale)
	for name, s := range states {
		win, err := headless.NewWindow(size.X, size.Y)
		if err != nil {
			t.Fatal(err)
		}
		w := &window{opts: Options{Version: "0.1.0"}, th: th, state: s}
		var ops op.Ops
		var router input.Router // without an input source, Gio draws widgets as disabled
		gtx := layout.Context{
			Source:      router.Source(),
			Ops:         &ops,
			Constraints: layout.Exact(size),
			Metric:      unit.Metric{PxPerDp: scale, PxPerSp: scale},
			Now:         time.Now(),
		}
		w.layout(gtx)
		if err := win.Frame(&ops); err != nil {
			t.Fatal(err)
		}
		img := image.NewRGBA(image.Rectangle{Max: size})
		if err := win.Screenshot(img); err != nil {
			t.Fatal(err)
		}
		win.Release()
		f, err := os.Create(filepath.Join(dir, name+".png"))
		if err != nil {
			t.Fatal(err)
		}
		png.Encode(f, img)
		f.Close()
	}
}
