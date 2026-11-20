# scanner

Windows hardware scanner written in Go: a single x64 console executable, no installer, no admin rights. It reads the hardware facts in the `DeviceScan` contract ([`shared/src/device.ts`](../shared/src/device.ts)), saves them as JSON next to the executable, uploads them to the server, and opens the private device link in the default browser.

Owned by [feature 001](../docs/features/feature-001-device-scan-and-upload/PLAN.md). The release build with the public URL is part of [feature 005](../docs/features/feature-005-public-demo-deployment/PLAN.md).

## Layout

```text
cmd/leaaf-scanner/   entry point, browser opener
internal/collect/    WMI queries (queries.go, the privacy allowlist) and the Windows collector
internal/scan/       raw readings -> payload (pure, fixture-tested), powercfg battery report parser
internal/payload/    Go structs for DeviceScan v1
internal/run/        save, upload, open link, exit codes
```

Readings come from WMI over COM (`github.com/yusufpapurcu/wmi`), the registry (Windows version, Secure Boot), `GetFirmwareType`, and `powercfg /batteryreport` as a battery fallback. A source that fails or needs admin rights (often `Win32_Tpm` and the `root\WMI` battery classes) becomes `null`, and the scan is `partial`.

**Privacy:** each WMI query names the properties it selects, and `scan.Raw` has fields for those properties only. `queries_test.go` fails if a query selects a serial number, UUID, host or user name, or network identifier. `normalize_test.go` plants such values in the raw readings and checks that none appear in the payload.

## Commands

Requires Go 1.26. From `scanner/`:

```sh
go test ./...        # unit tests on recorded readings, run flow, and a schema check against shared/schemas
go vet ./... && GOOS=windows go vet ./...

# Windows build. The backend URL is fixed at build time (default http://127.0.0.1:3000).
GOOS=windows GOARCH=amd64 go build -ldflags "-s -w -X main.backendURL=https://leaaf.green -X main.version=0.1.0" \
  -o dist/leaaf-scanner.exe ./cmd/leaaf-scanner
```

`dist/` is gitignored. The server serves `dist/leaaf-scanner.exe` at `/downloads/leaaf-scanner.exe` by default. The server image builds its own copy for `https://leaaf.green` (`server/Dockerfile`), and CI runs `go vet` and `go test` on every push.

On other operating systems the scanner builds and runs, but it collects nothing (every value is `null`). That is enough to try the upload flow against a local server: `go run ./cmd/leaaf-scanner -no-wait`.

## Scan sessions

A copy downloaded through Scan now ends with the 37-byte trailer `LEAAFSCAN1:<session ID>`, appended by the server. Windows ignores bytes after the last PE section. The scanner reads the trailer from its own file (`internal/run/session.go`), posts its progress steps to `/api/sessions/<id>/events`, and adds `session_id` to the upload. The waiting browser tab then shows the result, so the scanner does not open a second one. Without the trailer (dev builds, the plain download) it opens the device page itself.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Uploaded; the device link was printed, and opened unless a session tab is waiting |
| 1 | Upload failed or was rejected; the JSON file is kept and its path printed (and an `upload_failed` event sent to the session) |
| 2 | The JSON file could not be written |

The window waits for Enter before closing unless `-no-wait` is passed, so a double-clicked scanner stays readable.

## Not verified yet

No run on a real Windows laptop has happened (feature 001 T-009). It is unknown which battery and TPM sources work without admin rights on the demo models.
