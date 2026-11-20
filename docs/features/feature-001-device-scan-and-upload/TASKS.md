# Implementation Tasks: Device scan and upload

- **Feature ID:** `feature-001-device-scan-and-upload`
- **Status:** In progress

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Set up the repository layout (`scanner/`, `server/`, `web/`, `shared/`) with build, test, and type-check commands, and document them in the README (supports all ACs)
- [x] **T-002:** Define the versioned device JSON schema in `shared/`, including nullable fields and `scan_status` (supports `AC-003`, `AC-006`)
- [x] **T-003:** Implement the Go collectors and normalization with fixture-based unit tests, including null handling (supports `AC-002`, `AC-003`)
- [x] **T-004:** Implement the payload builder's privacy allowlist with a planted-identifier test (supports `AC-004`)
- [x] **T-005:** Implement the local JSON write, HTTPS upload, link output, browser open, and failure exit code (supports `AC-005`, `AC-008`)
- [x] **T-006:** Implement the upload endpoint with schema validation, a size limit, SQLite storage, and secure ID generation, with integration tests (supports `AC-006`, `AC-007`)
- [x] **T-007:** Implement `GET /api/devices/:id` and the not-found behavior, with tests (supports `AC-010`)
- [ ] **T-008:** Build the React landing page with the download and data disclosure, and the device page with "Unknown" rendering, with tests (supports `AC-009`, `AC-011`)
- [ ] **T-009:** Run the scanner manually on a real Windows laptop, accepting and declining the elevation prompt, and record the evidence, including which sources still read `null` when elevated (supports `AC-001`, `AC-005`, `AC-008`). *(Revised 2026-11-20; originally run as a non-admin user.)*
- [x] **T-011:** *(amendment)* Implement the FR-013 collectors (RAM slots and type, TPM, Secure Boot, firmware type, battery cycle count, GPU names) with fixture tests, including access-denied cases (supports `AC-013`)
- [x] **T-012:** *(Added 2026-11-20)* Embed a `requireAdministrator` manifest and version info with `go-winres`, commit the generated `.syso` files, open the browser non-elevated, and add a test for the manifest (supports `AC-001`)
- [x] **T-013:** *(Added 2026-11-20)* Build the Gio scanner window (start, progress, completion, and error screens; embedded Inter subset; `-H windowsgui`), report run events through a callback instead of opening the browser, keep a console build for other operating systems, with tests for the state model and the run events (supports `AC-005`, `AC-008`, `AC-014`)
- [x] **T-014:** *(Amendment 2026-11-20)* Add **Try again** for temporary upload failures (re-upload the saved scan; defer the session error until Close), with tests; add the `gui` build tag for a Linux dev window (supports `AC-015`)
- [ ] **T-010:** Run all checks, self-review the diff against the plan, record the findings, and update the README and the feature index (supports `AC-012`)

## Dependencies and blockers

- T-009 needs access to a Windows laptop. Not blocking for the other tasks.

## Progress notes

- 2026-11-20: At the user's request, the top-level folders (`scanner/`, `server/`, `web/`, `shared/`, `corpus/`, `data/`, `demo/`) were created with README placeholders only. T-001 remains open: there are no build, test, or type-check commands yet, and implementation of this feature had not started at that point.
- 2026-11-20: T-002 done. The versioned device schema and the cross-feature contracts are in `shared/` (`npm test -w shared` passes; see the [shared README](../../../shared/README.md)). T-001 is partly done: the npm workspace and the `shared` package have build, test, and type-check scripts, while `scanner/`, `server/`, and `web/` are not set up yet.
- 2026-11-20: The `server` workspace exists (TypeScript run natively by Node 24, Vitest) but so far contains only the LLM adapter; the HTTP API (T-006, T-007) is not started.
- 2026-11-20 (later): The `server` workspace now also holds fact extraction and the impact table loader (feature 003), and the `web` workspace exists with test, type-check, and build scripts (feature 006). Only `scanner/` still lacks a module and commands, so T-001 stays open. Feature 006 built a landing page and a result screen at `/d/:id`; T-008 is checked against it when this feature's device page and download are done.
- 2026-11-20: T-006 and T-007 done: Fastify upload and lookup API with SQLite storage and the scanner download route; 11 tests in `server/test/devices.test.ts`. Live smoke run: a fixture upload returned 201 with a device URL, the lookup returned the record, and the log contained neither the device ID nor a client IP.
- 2026-11-20: T-001, T-003, T-004, T-005, and T-011 done: the Go module in `scanner/` with `go test`, `go vet`, and the Windows build documented in `scanner/README.md` and the root README. Tests: normalization fixtures (complete laptop, partial, desktop, planted identifiers), a query allowlist check, battery report parsing, the run flow against unreachable, rejecting, and accepting test servers, and a schema check against `shared/schemas/DeviceScan.schema.json`. A Linux build of the scanner uploaded to the local server and received a device link, so the Go payload passes the server's validation. The Windows `.exe` cross-compiles (PE32+, about 6.9 MB). Nothing has run on Windows yet (T-009).
- 2026-11-20: For feature 006 T-010, the scanner reads a session ID from a `LEAAFSCAN1:` trailer appended to its downloaded file, reports its progress to that session, and sends `session_id` with the upload. Without a trailer it behaves as before. See the [feature 006 design](../feature-006-web-app/DESIGN.md).
- 2026-11-20: T-012 done. `cmd/leaaf-scanner/winres/winres.json` with `execution-level: administrator` and version info; the generated `rsrc_windows_amd64.syso` (go-winres v0.3.3) is committed. The browser opens through `explorer.exe`. `TestManifestRequiresAdministrator` passes, `go vet` passes (Linux and `GOOS=windows`), and `go test ./...` passes. The cross-compiled exe contains `level="requireAdministrator"`. The prompt itself and the non-elevated browser are still unverified on Windows (T-009).
- 2026-11-20: T-013 done. The window is in `scanner/internal/ui`: the state model in `model.go`, the screens in `view.go`, and the event loop in `window_windows.go`. It is drawn with Gio v0.10.3 using an embedded Inter subset (about 50 KB per weight, OFL). `run.Run` now reports `Event`s through `OnEvent` and has no browser opener. Non-Windows builds are a console program. The web's waiting line now says to press **Start scan**. Checks:
  - `go vet` (Linux and `GOOS=windows`) and `go test ./...` pass. `TestStateFlow` and `TestStepsMatchSharedAndWeb` (labels match `web/src/api/types.ts`, IDs match `shared/src/session.ts`) are new, and the run tests were adapted to events.
  - The web type check and tests pass (37).
  - The release exe cross-compiles as a PE32+ GUI binary of about 12.1 MB (7.7 MB before).
  - All four screens were rendered off screen with `go test -tags screenshot` and checked visually.
  - Nothing has run on Windows yet (T-009).
- 2026-11-20: T-014 done. `run.Runner` splits the flow into Scan, Upload (repeatable), and Finish (sends a pending temporary failure to the session). Failures are classified as retryable (no connection, timeout, 429, 5xx) or final. The window's failed screen shows **Try again** and a text **Close** button. The window also builds on Linux with `-tags gui`. Checks:
  - New tests: `TestRetryAfterTemporaryFailure` (same body uploaded again, one scan, session not ended), `TestFinishReportsPendingFailure`, `TestRejectionIsFinal`, `TestUnreachableIsRetryable`, and `TestRetry` (state). They pass, also with `-race`.
  - `go vet` passes for Linux, `GOOS=windows`, `-tags gui`, and `-tags screenshot`.
  - The Linux `-tags gui` build compiles. It was not opened on screen.
  - The "Upload failed" screen was rendered off screen and checked visually.
- Unverified assumption for T-003/T-011: whether `root\WMI` battery classes and `Win32_Tpm` can be read without admin rights. Test this early on a real laptop; the schema already allows `null`. *(2026-11-20: moot for TPM once T-012 elevates the scanner; whether the battery classes work elevated is still checked in T-009.)*

## Lifecycle history

- 2026-11-20: Scope extended by an amendment (FR-013, AC-013, T-011); see the [scope change log](./PLAN.md#scope-change-log).
- 2026-11-20: Implementation started (T-002, shared contracts).
- 2026-11-20: FR-001 replaced (administrator rights required) and T-012 added; see the [scope change log](./PLAN.md#scope-change-log). Implementation authorized in the same conversation.
- 2026-11-20: FR-009 replaced (no automatic browser opening) and FR-014 added (scanner window); T-013 added. See the [scope change log](./PLAN.md#scope-change-log). Implementation authorized in the same conversation.
- 2026-11-20: Scope extended by an amendment (FR-015, AC-015, T-014); see the [scope change log](./PLAN.md#scope-change-log). Implementation authorized in the same conversation.
