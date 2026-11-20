package ui

import (
	_ "embed"
	"fmt"
	"image"
	"image/color"
	"sync"

	"gioui.org/font"
	"gioui.org/font/opentype"
	"gioui.org/layout"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/text"
	"gioui.org/unit"
	"gioui.org/widget"
	"gioui.org/widget/material"

	"leaaf.green/scanner/internal/run"
)

// Fixed window size in dp.
const (
	windowWidth  = 620
	windowHeight = 340
)

// This file draws the window's screens. It has no platform code, so the screens can also be
// rendered off screen on a development machine (screenshot_test.go); the event loop is in
// window_windows.go.

// Inter, as on the web app, subset to Latin (see fonts/OFL.txt for the licence).
var (
	//go:embed fonts/Inter-Regular.ttf
	interRegular []byte
	//go:embed fonts/Inter-SemiBold.ttf
	interSemiBold []byte
	//go:embed fonts/Inter-ExtraBold.ttf
	interExtraBold []byte
)

// Palette from web/src/index.css (docs/VISUAL_DESIGN.md).
var (
	colPage     = rgb(0xf8faf8)
	colInk      = rgb(0x1f2933)
	colMuted    = rgb(0x5f6b76)
	colLeaf     = rgb(0x2f7d4f)
	colLeafTint = rgb(0xe6f2ea)
	colLine     = rgb(0xe3e9e4)
	colTrack    = rgb(0xe8edea)
	colRoseInk  = rgb(0x8f2f25)
	colWhite    = rgb(0xffffff)
)

func rgb(c uint32) color.NRGBA {
	return color.NRGBA{R: uint8(c >> 16), G: uint8(c >> 8), B: uint8(c), A: 0xff}
}

const (
	regular   = font.Normal
	semiBold  = font.SemiBold
	extraBold = font.ExtraBold
)

type Options struct {
	// Config is the scan to run when Start scan is pressed; Run sets its OnEvent.
	Config  run.Config
	Version string
	// OpenBrowser opens the device page for Show my results.
	OpenBrowser func(url string) error
}

func theme() (*material.Theme, error) {
	var faces []font.FontFace
	for _, f := range []struct {
		data   []byte
		weight font.Weight
	}{{interRegular, regular}, {interSemiBold, semiBold}, {interExtraBold, extraBold}} {
		face, err := opentype.Parse(f.data)
		if err != nil {
			return nil, err
		}
		faces = append(faces, font.FontFace{Font: font.Font{Typeface: "Inter", Weight: f.weight}, Face: face})
	}
	th := material.NewTheme()
	th.Shaper = text.NewShaper(text.NoSystemFonts(), text.WithCollection(faces))
	th.Face = "Inter"
	th.Palette.Fg, th.Palette.Bg = colInk, colPage
	th.Palette.ContrastBg, th.Palette.ContrastFg = colLeaf, colWhite
	return th, nil
}

type window struct {
	opts Options
	th   *material.Theme

	mu     sync.Mutex
	state  State
	events []run.Event // from the scan goroutine, applied on the next frame

	start, results, close widget.Clickable
	// openFailed shows the device link as text when the browser could not be started.
	openFailed bool
}

// layout: the screen's text and controls on the left, the wordmark on a leaf-tinted panel on
// the right.
func (w *window) layout(gtx layout.Context) layout.Dimensions {
	paint.Fill(gtx.Ops, colPage)
	return layout.Flex{}.Layout(gtx,
		layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
			return layout.UniformInset(unit.Dp(32)).Layout(gtx, w.screen)
		}),
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			size := image.Pt(gtx.Dp(unit.Dp(220)), gtx.Constraints.Max.Y)
			paint.FillShape(gtx.Ops, colLeafTint, clip.Rect{Max: size}.Op())
			paint.FillShape(gtx.Ops, colLine, clip.Rect{Max: image.Pt(gtx.Dp(1), size.Y)}.Op())
			gtx.Constraints = layout.Exact(size)
			return layout.Center.Layout(gtx, w.logo)
		}),
	)
}

// logo is the web app's wordmark: "leaaf" in ink with a smaller green ".green" on its baseline.
func (w *window) logo(gtx layout.Context) layout.Dimensions {
	return layout.Flex{Alignment: layout.Baseline}.Layout(gtx,
		layout.Rigid(w.label(36, extraBold, colInk, "leaaf")),
		layout.Rigid(w.label(24, extraBold, colLeaf, ".green")),
	)
}

func (w *window) screen(gtx layout.Context) layout.Dimensions {
	w.mu.Lock()
	s, openFailed := w.state, w.openFailed
	w.mu.Unlock()

	var title string
	titleColor := colInk
	var body []layout.FlexChild
	switch s.Phase {
	case PhaseIdle:
		title = "Check this computer"
		body = []layout.FlexChild{
			layout.Rigid(w.label(14, regular, colMuted, "leaaf reads hardware facts only: no serial numbers, names, files, or network addresses. It takes under a minute.")),
			space(24),
			layout.Rigid(w.button(&w.start, "Start scan")),
		}
	case PhaseRunning:
		title = "Scanning…"
		body = []layout.FlexChild{
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				return layout.Flex{Alignment: layout.Middle}.Layout(gtx,
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						gtx.Constraints = layout.Exact(image.Pt(gtx.Dp(18), gtx.Dp(18)))
						l := material.Loader(w.th)
						l.Color = colLeaf
						return l.Layout(gtx)
					}),
					layout.Rigid(layout.Spacer{Width: unit.Dp(12)}.Layout),
					layout.Rigid(w.label(15, semiBold, colInk, s.StepLabel())),
				)
			}),
			space(16),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				bar := material.ProgressBar(w.th, s.Progress())
				bar.Color, bar.TrackColor = colLeaf, colTrack
				bar.Height, bar.Radius = unit.Dp(8), unit.Dp(4)
				return bar.Layout(gtx)
			}),
			space(10),
			layout.Rigid(w.label(13, regular, colMuted, stepCount(s))),
		}
	case PhaseDone:
		title = "Scan complete"
		msg := "Your results are ready. Keep the link private: anyone with it can see this scan."
		if s.Session {
			msg = "Your results are ready and also shown in the browser tab that started the scan. Keep the link private: anyone with it can see this scan."
		}
		body = []layout.FlexChild{
			layout.Rigid(w.label(14, regular, colMuted, msg)),
			space(20),
			layout.Rigid(w.button(&w.results, "Show my results")),
			space(16),
		}
		if openFailed {
			body = append(body, layout.Rigid(w.lines(12, colRoseInk, "The browser could not be opened. Open this link yourself: "+s.DeviceURL, 3)))
		} else {
			body = append(body, layout.Rigid(w.path(s.SavedPath)))
		}
	case PhaseFailed:
		title, titleColor = "Scan failed", colRoseInk
		body = []layout.FlexChild{
			layout.Rigid(w.label(14, regular, colInk, s.Message)),
			space(8),
			layout.Rigid(w.lines(12, colMuted, s.Detail, 3)),
			space(16),
			layout.Rigid(w.button(&w.close, "Close")),
			space(12),
			layout.Rigid(w.path(s.SavedPath)),
		}
	}
	children := append([]layout.FlexChild{
		layout.Rigid(w.label(22, extraBold, titleColor, title)),
		space(10),
	}, body...)
	children = append(children,
		layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
			return layout.Dimensions{Size: image.Pt(0, gtx.Constraints.Max.Y)}
		}),
		layout.Rigid(w.label(11, regular, colMuted, "leaaf scanner "+w.opts.Version)),
	)
	return layout.Flex{Axis: layout.Vertical}.Layout(gtx, children...)
}

func stepCount(s State) string {
	n := s.StepNumber()
	if n == 0 {
		return ""
	}
	return fmt.Sprintf("Step %d of %d", n, len(Steps))
}

func space(dp unit.Dp) layout.FlexChild {
	return layout.Rigid(layout.Spacer{Height: dp}.Layout)
}

func (w *window) label(size unit.Sp, weight font.Weight, c color.NRGBA, txt string) layout.Widget {
	return func(gtx layout.Context) layout.Dimensions {
		l := material.Label(w.th, size, txt)
		l.Font.Weight, l.Color = weight, c
		return l.Layout(gtx)
	}
}

// lines is muted small text cut to max lines, for error details and file paths.
func (w *window) lines(size unit.Sp, c color.NRGBA, txt string, max int) layout.Widget {
	return func(gtx layout.Context) layout.Dimensions {
		if txt == "" {
			return layout.Dimensions{}
		}
		l := material.Label(w.th, size, txt)
		l.Color, l.MaxLines = c, max
		return l.Layout(gtx)
	}
}

// path tells the user where the scan was saved (FR-006). The path may break anywhere, since it
// has no spaces to wrap at.
func (w *window) path(p string) layout.Widget {
	return func(gtx layout.Context) layout.Dimensions {
		if p == "" {
			return layout.Dimensions{}
		}
		return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
			layout.Rigid(w.lines(12, colMuted, "A copy of the scan is saved at:", 1)),
			layout.Rigid(func(gtx layout.Context) layout.Dimensions {
				l := material.Label(w.th, 12, p)
				l.Color, l.MaxLines, l.WrapPolicy = colMuted, 2, text.WrapGraphemes
				return l.Layout(gtx)
			}),
		)
	}
}

// button is the web app's primary button: white text on leaf green, fully rounded.
func (w *window) button(c *widget.Clickable, txt string) layout.Widget {
	return func(gtx layout.Context) layout.Dimensions {
		gtx.Constraints.Min.X = 0 // as wide as its text, like the web button
		b := material.Button(w.th, c, txt)
		b.Background, b.Color = colLeaf, colWhite
		b.Font.Weight, b.TextSize = semiBold, 15
		b.CornerRadius = 24
		b.Inset = layout.Inset{Top: 12, Bottom: 12, Left: 28, Right: 28}
		return b.Layout(gtx)
	}
}
