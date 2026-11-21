# scanner

Hardware scanner written in Go, with the same small window and no installer on each system:

- **Windows** (x64): a single executable. It asks for administrator rights on start (UAC prompt), so privileged sources such as the TPM can be read; if the user declines, it does not run.
- **macOS** 12 or later (Intel and Apple Silicon): a universal app, zipped. It needs no password: every field comes from the Mac's own tools as the signed-in user.
- **Linux** (x64, X11 or Wayland desktop): a single executable that runs as the signed-in user. After **Start scan** it asks once for root through `pkexec` for the fields only root can read (RAM type, speed and slots, drive health); cancelling leaves those `null`.

After **Start scan** it reads the hardware facts in the `DeviceScan` contract ([`shared/src/device.ts`](../shared/src/device.ts)), saves them as JSON (next to the executable, or in the home folder on macOS), and uploads them to the server. The window then offers **Show my results**, which opens the private device link in the default browser. It never opens the browser by itself.

Owned by [feature 001](../docs/features/feature-001-device-scan-and-upload/PLAN.md) (Windows) and [feature 007](../docs/features/feature-007-macos-linux-scanner/PLAN.md) (macOS and Linux). The release build with the public URL is part of [feature 005](../docs/features/feature-005-public-demo-deployment/PLAN.md).

## Layout

```text
cmd/leaaf-scanner/   entry point (window, or console with -tags console), browser opener, save folder, Windows resources (winres/, generated .syso)
internal/collect/    one collector per system: WMI (queries.go, the privacy allowlist), Linux sysfs plus the pkexec root helper, macOS system tools
internal/scan/       raw readings -> payload per system (pure, fixture-tested): Raw (Windows), RawLinux, RawDarwin, SMBIOS and powercfg parsers
packaging/macos/     Info.plist and build.sh for the zipped, ad-hoc signed universal app (runs on a Mac)
internal/payload/    Go structs for DeviceScan v1
internal/run/        save, upload, session progress, events for the window, exit codes
internal/ui/         the window (Gio): state model, screens, embedded Inter subset
```

Readings per system:

- **Windows:** WMI over COM (`github.com/yusufpapurcu/wmi`), the registry (Windows version, Secure Boot), `GetFirmwareType`, and `powercfg /batteryreport` as a battery fallback.
- **Linux:** named files under `/sys` and `/proc` and `/etc/os-release`, GPU names from the system's `pci.ids`. The root helper (`--privileged-helper`, started by `pkexec`) reads the SMBIOS memory structures from `/sys/firmware/dmi/tables/DMI` and drive health from `smartctl` when installed, or from the NVMe health log.
- **macOS:** `sw_vers`, `sysctl`, `system_profiler -json` and `ioreg` for the battery, by absolute path.

A source that fails (for example a vendor's missing `root\WMI` battery class) becomes `null`, and the scan is `partial`. Fields a system does not have (a Mac's TPM and BIOS date, Apple Silicon's RAM slots, the Windows display version elsewhere) stay `null` without making the scan partial (`payload.NotApplicable`, mirrored in `shared/src/device.ts`).

**Privacy:** each WMI query names the properties it selects, and `scan.Raw` has fields for those properties only. `queries_test.go` fails if a query selects a serial number, UUID, host or user name, or network identifier. On Linux the reader opens only named files, never the DMI serial or UUID files. On macOS the JSON decoders name only allowed keys, so the serial number, hardware UUID and drive, battery and display serials that `system_profiler` and `ioreg` return are dropped while parsing. The SMBIOS parser reads only numeric fields, not the module serials in the string table, and the root helper's output is decoded strictly and rejected if it carries anything else. The tests plant such values in recorded readings for each system and check that none appear in the payload.

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

Linux and macOS (feature 007), against a local server (`npm start -w server`):

```sh
go run ./cmd/leaaf-scanner                  # the window; needs cgo and, on Linux, the X11/Wayland dev libraries (gioui.org/doc/install)
go run -tags console ./cmd/leaaf-scanner    # console: prints the device link and exits with the codes below
go build -o dist/leaaf-scanner-linux ./cmd/leaaf-scanner                     # Linux, served at /downloads/leaaf-scanner-linux
packaging/macos/build.sh http://127.0.0.1:3000 0.1.0-local dist               # on a Mac: dist/leaaf-scanner-macos.zip
```

The release Linux build runs on Ubuntu 22.04 in `server/Dockerfile`, so it needs glibc 2.35 or later; the macOS release comes from CI's `scanner-macos` job (see [the deployment guide](../docs/DEPLOYMENT.md)). Other systems get the console build, which collects nothing (every value is `null`).

The macOS app is signed ad hoc, not with an Apple Developer ID, so macOS asks the user to allow it under System Settings → Privacy & Security → **Open Anyway**. Nothing may change inside the signed bundle afterwards; the server therefore carries the session in the bundle's name instead.

The window does not need the server to start or to scan. Only the upload at the end does.

## Window

The window (`internal/ui`, feature 001 FR-014, feature 007 FR-003) is drawn with [Gio](https://gioui.org). It is pure Go on Windows: no cgo, no WebView2 or other runtime, and it cross-compiles like the rest. On macOS and Linux Gio needs cgo; on Linux it links the system's Wayland, X11, xkbcommon and EGL libraries, and a missing display prints an error on the terminal. Old or unpatched Windows 10 machines were the reason to avoid WebView-based options. It has four screens: start (**Start scan**), progress (step label, bar, "Step n of 5"), completion (**Show my results**), and error (**Close**). When the upload fails temporarily (no connection, timeout, 429 or 5xx), the error screen is "Upload failed" with **Try again**. That uploads the saved scan again without rescanning (`run.Runner`, FR-015). Such a failure is reported to the waiting session only when the window is closed, so a later retry can still complete the browser tab. A rejected scan is final. The colours and step labels come from the web app: `model_test.go` fails if the labels drift from `web/src/api/types.ts` or the step IDs from `shared/src/session.ts`. Text uses Inter, subset to Latin (about 50 KB per weight), in `internal/ui/fonts/` with its OFL licence.

`model.go` holds the state, tested on every platform. `view.go` draws the screens and has no platform code. `window.go` is the event loop, built on every system unless `-tags console` is set. To look at the screens without Windows, render them to PNGs. This needs cgo and an EGL/OpenGL ES driver, so it isn't part of CI:

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

A Windows or Linux copy downloaded through Scan now ends with the 37-byte trailer `LEAAFSCAN1:<session ID>`, appended by the server. Windows ignores bytes after the last PE section, and the Linux loader ignores bytes after the ELF segments. For macOS the server renames the bundle in the zip to `leaaf-scanner-<session ID>.app` instead, because the signature covers everything inside the bundle but not its name. The scanner reads the session from the trailer or the bundle name (`internal/run/session.go`), posts its progress steps to `/api/sessions/<id>/events` (each step as `running` when it starts; on Windows the reading steps also as `done` or `skipped` when they end, per `scan.StepState`), and adds `session_id` to the upload. The waiting browser tab then shows the result by itself. With or without a trailer, the window's **Show my results** button opens the device page. The scanner sends events only after **Start scan** is pressed.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Uploaded; the device link was printed |
| 1 | Upload failed or was rejected; the JSON file is kept and its path printed (and an `upload_failed` event sent to the session) |
| 2 | The JSON file could not be written |

These codes apply to the console build. The window shows the same outcomes as screens: completion, or an error with the saved file's path.

## Windows verification

On 2026-11-20 an elevated run on a Windows 11 laptop (Lenovo, product 83JT) went through Download and Scan now against the local stack. After the UAC prompt was accepted, it stored a `complete` scan with no `null` field, TPM and the `root\WMI` battery classes included (feature 001 T-009). Still to be checked on Windows:

- declining the elevation prompt;
- the window on Windows 10, and on high-DPI displays;
- that **Show my results** opens the browser non-elevated;
- which battery sources read `null` even when elevated on the demo models.

## macOS and Linux verification

Not yet run on real hardware (feature 007 T-011). The Linux reader was tried in a Flatpak sandbox, which hides `/sys/firmware` and `pkexec`; the macOS fixtures are written from the documented output format. To check:

- the window, a scan and the session tab on the team's Apple Silicon MacBook, comparing the values with System Information and searching the saved JSON for the Mac's serial number;
- on a Linux laptop outside any sandbox: the window on Wayland and X11, the password dialog (granted and cancelled), and the values against `lscpu`, `lsblk`, `upower` and `lspci`.
