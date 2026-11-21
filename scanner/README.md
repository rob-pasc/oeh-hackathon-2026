# scanner

Windows hardware scanner written in Go: a single x64 executable with a small window, no installer. It asks for administrator rights on start (UAC prompt), so privileged sources such as the TPM can be read; if the user declines, it does not run. After **Start scan** it reads the hardware facts in the `DeviceScan` contract ([`shared/src/device.ts`](../shared/src/device.ts)), saves them as JSON next to the executable, and uploads them to the server. The window then offers **Show my results**, which opens the private device link in the default browser. It never opens the browser by itself.

Owned by [feature 001](../docs/features/feature-001-device-scan-and-upload/PLAN.md). The release build with the public URL is part of [feature 005](../docs/features/feature-005-public-demo-deployment/PLAN.md).

## Layout

```text
cmd/leaaf-scanner/   entry point (window on Windows, console elsewhere), browser opener, Windows resources (winres/, generated .syso)
internal/collect/    WMI queries (queries.go, the privacy allowlist) and the Windows collector
internal/scan/       raw readings -> payload (pure, fixture-tested), powercfg battery report parser
internal/payload/    Go structs for DeviceScan v1
internal/run/        save, upload, session progress, events for the window, exit codes
internal/ui/         the window (Gio): state model, screens, embedded Inter subset
```

Readings come from WMI over COM (`github.com/yusufpapurcu/wmi`), the registry (Windows version, Secure Boot), `GetFirmwareType`, and `powercfg /batteryreport` as a battery fallback. A source that fails (for example a vendor's missing `root\WMI` battery class) becomes `null`, and the scan is `partial`.

**Privacy:** each WMI query names the properties it selects, and `scan.Raw` has fields for those properties only. `queries_test.go` fails if a query selects a serial number, UUID, host or user name, or network identifier. `normalize_test.go` plants such values in the raw readings and checks that none appear in the payload.

## Commands

Requires Go 1.26. From `scanner/`:

```sh
go test ./...        # unit tests on recorded readings, run flow, and a schema check against shared/schemas
go vet ./... && GOOS=windows go vet ./...

# Windows build. The backend URL is fixed at build time (default http://127.0.0.1:3000).
GOOS=windows GOARCH=amd64 go build -ldflags "-s -w -H windowsgui -X main.backendURL=https://leaaf.green -X main.version=0.1.0" \
  -o dist/leaaf-scanner.exe ./cmd/leaaf-scanner
```

`dist/` is gitignored. The server serves `dist/leaaf-scanner.exe` at `/downloads/leaaf-scanner.exe` by default. The server image builds its own copy for `https://leaaf.green` (`server/Dockerfile`), and CI runs `go vet` and `go test` on every push.

`-H windowsgui` keeps a console window from opening behind the scanner window. The release exe is about 12 MB.

On other operating systems the scanner collects nothing (every value is `null`), which is enough to try the upload and session flow against a local server (`npm start -w server`):

```sh
go run -tags gui ./cmd/leaaf-scanner   # the real window (needs cgo and the X11/Wayland dev libraries, see gioui.org/doc/install)
go run ./cmd/leaaf-scanner             # console: prints the device link and exits with the codes below
```

The window does not need the server to start or to scan. Only the upload at the end does.

## Window

The window (`internal/ui`, feature 001 FR-014) is drawn with [Gio](https://gioui.org). It is pure Go on Windows: no cgo, no WebView2 or other runtime, and it cross-compiles like the rest. Old or unpatched Windows 10 machines were the reason to avoid WebView-based options. It has four screens: start (**Start scan**), progress (step label, bar, "Step n of 5"), completion (**Show my results**), and error (**Close**). When the upload fails temporarily (no connection, timeout, 429 or 5xx), the error screen is "Upload failed" with **Try again**. That uploads the saved scan again without rescanning (`run.Runner`, FR-015). Such a failure is reported to the waiting session only when the window is closed, so a later retry can still complete the browser tab. A rejected scan is final. The colours and step labels come from the web app: `model_test.go` fails if the labels drift from `web/src/api/types.ts` or the step IDs from `shared/src/session.ts`. Text uses Inter, subset to Latin (about 50 KB per weight), in `internal/ui/fonts/` with its OFL licence.

`model.go` holds the state, tested on every platform. `view.go` draws the screens and has no platform code. `window.go` is the event loop, built on Windows or with `-tags gui`. To look at the screens without Windows, render them to PNGs. This needs cgo and an EGL/OpenGL ES driver, so it isn't part of CI:

```sh
SCREENSHOT_DIR=/tmp/shots go test -tags screenshot -run TestScreenshots ./internal/ui
```

## Administrator rights

`cmd/leaaf-scanner/winres/winres.json` defines a manifest with `requireAdministrator` and the file's version info. [go-winres](https://github.com/tc-hib/go-winres) turns it into `rsrc_windows_amd64.syso`. That file is committed, so a plain `go build` for Windows links it, with no extra tool in CI or the server image. After editing the JSON:

```sh
go generate ./cmd/leaaf-scanner   # runs go-winres; commit the updated .syso
```

The JSON also holds the icon (FR-016): `RT_GROUP_ICON` `#1`, which Gio also uses for the title bar and taskbar, made from `winres/icon-*.png`. Those PNGs are rendered by `winres/make_icon.py` (needs Pillow; only to change the icon). After changing them, run `go generate` as above.

`TestManifestRequiresAdministrator` fails if the JSON or the `.syso` stops requesting elevation. `TestIconResource` fails if the icon group is missing or the `.syso` is stale. Because the scanner runs elevated, it opens the device link through `explorer.exe`, which hands the URL to the signed-in user's shell, so the browser does not run as admin. On Windows, `go run ./cmd/leaaf-scanner` from a terminal that is not elevated fails with "requires elevation". Build the exe and start it, or use an elevated terminal.

## Scan sessions

A copy downloaded through Scan now ends with the 37-byte trailer `LEAAFSCAN1:<session ID>`, appended by the server. Windows ignores bytes after the last PE section. The scanner reads the trailer from its own file (`internal/run/session.go`), posts its progress steps to `/api/sessions/<id>/events`, and adds `session_id` to the upload. The waiting browser tab then shows the result by itself. With or without a trailer, the window's **Show my results** button opens the device page. The scanner sends events only after **Start scan** is pressed.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Uploaded; the device link was printed |
| 1 | Upload failed or was rejected; the JSON file is kept and its path printed (and an `upload_failed` event sent to the session) |
| 2 | The JSON file could not be written |

These codes apply to the console build. The Windows window shows the same outcomes as screens: completion, or an error with the saved file's path.

## Windows verification

On 2026-11-20 an elevated run on a Windows 11 laptop (Lenovo, product 83JT) went through Download and Scan now against the local stack. After the UAC prompt was accepted, it stored a `complete` scan with no `null` field, TPM and the `root\WMI` battery classes included (feature 001 T-009). Still to be checked on Windows:

- declining the elevation prompt;
- the window on Windows 10, and on high-DPI displays;
- that **Show my results** opens the browser non-elevated;
- which battery sources read `null` even when elevated on the demo models.
