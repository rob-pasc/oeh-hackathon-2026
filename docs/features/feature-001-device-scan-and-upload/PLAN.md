# Feature 001: Device scan and upload

- **Feature ID:** `feature-001-device-scan-and-upload`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-20

## Summary

A small Windows scanner, written in Go and downloaded from the leaaf website, reads the hardware facts needed to judge a laptop's next life. It uploads them as a minimal JSON inventory to the central platform. The platform stores one device record per upload and returns an unguessable link. The owner opens that link to see the device page.

This is the first slice of the leaaf (Lifecycle Evaluation and Action Finder) MVP and the data foundation for retrieval (feature 002), ranking (feature 003), and the explained report (feature 004).

## Problem and desired outcome

- **Problem:** Owners rarely know what is in their old laptop (disk type, RAM, battery wear), and checking takes time and know-how. Without that data, no sensible next-life recommendation is possible.
- **Desired outcome:** An owner runs one executable, without installing anything, and within a minute sees their device's key specs on a private web page.
- **Target users / stakeholders:** Individual owners of an old Windows laptop or PC (primary); the hackathon team and judges (live demo).

## Approved scope

### In scope

- Windows scanner as a single Go executable, downloadable from the website.
- Collection of manufacturer, model, CPU, RAM, storage, and (when accessible) disk health, battery health, OS version, and a BIOS date as an age hint.
- Graceful handling of fields that cannot be read.
- Upload to a TypeScript/Node backend; validation and storage of one device record per upload.
- An unguessable device link (no accounts) and a device page in the React website that shows the scanned specs.
- A website landing page with the scanner download.
- Privacy by data minimization: no serial numbers or personal content.

### Out of scope

- macOS, Linux, or bootable-USB scanning; diagnostics for devices that do not boot.
- User accounts, logins, PINs, or a list of all devices.
- Deduplicating repeated scans of the same device (each upload is a new record).
- Manual JSON upload through the website.
- Retrieval, ranking, and explanations (features 002–004).
- Public hosting, seeding of demo devices, and abuse protection for a public endpoint (feature 005).
- Multi-device or fleet dashboard (deferred; to be specified later).

## Functional requirements

- **FR-001** *(revised 2026-11-20)*: The scanner is a single Windows executable that runs on Windows 10 and 11 without installation. It requires administrator rights: Windows asks for elevation (UAC) before it starts, so privileged sources such as the TPM can be read. If the user declines, the scanner does not run. It opens the device page in the browser as the signed-in user, not elevated. *(Originally: runs without administrator rights for its core fields.)*
- **FR-002:** The scanner collects manufacturer, model, CPU model name, CPU core count, total RAM in GB, and for each internal storage device its type (HDD, SATA SSD, NVMe SSD, or unknown) and capacity in GB.
- **FR-003:** When available, the scanner also collects storage health status, battery design capacity and full-charge capacity (giving a battery health percentage), the Windows version, and the BIOS release date as an age hint.
- **FR-004:** Any field that cannot be read is reported as `null`. The payload's `scan_status` is `partial` when at least one field is `null` and `complete` otherwise. A single unreadable field never aborts the scan.
- **FR-005:** The payload contains no serial numbers, UUIDs, user names, host names, network identifiers (MAC or IP), or file contents.
- **FR-006:** The scanner writes the payload to a local JSON file next to the executable before uploading, and tells the user where that file is.
- **FR-007:** The scanner uploads the payload over HTTPS to a backend URL fixed at build time. The backend accepts payloads that match the versioned device schema and rejects others with an error message naming the invalid fields.
- **FR-008:** For each accepted upload, the backend stores one device record. It returns a device ID made from at least 128 bits of cryptographically secure randomness, together with the device page URL.
- **FR-009** *(revised 2026-11-20)*: After a successful upload, the scanner window says that the scan is complete and offers a **Show my results** button. The button opens the device page in the default browser as the signed-in user, not elevated. The scanner never opens the browser by itself. If the upload fails, the window shows a readable error and the local JSON path. *(Originally: the scanner printed the URL and opened it in the browser automatically, and exited non-zero on failure. The exit codes remain only in the console build for other operating systems, which is used for development.)*
- **FR-010** *(revised 2026-11-20)*: The device page at the device URL shows the scanned fields listed in [feature 006](../feature-006-web-app/PLAN.md) FR-010 in plain language: device name and maker, battery health and cycle count, storage, memory, processor, graphics, and the security chip. Shown fields whose value is `null` appear as "Unknown". *(Originally: "all scanned fields". Fields such as Secure Boot, firmware type, OS build, and RAM speed stay in the stored record and feed the assessment, but are not listed on the page.)*
- **FR-011:** Requesting a device URL with an unknown or malformed ID shows a "device not found" page. No endpoint lists or enumerates devices.
- **FR-012:** The website landing page explains what the scanner does and what data it collects, and offers the scanner executable for download. A disclosure beside the download explains elevation, the hardware and Windows readings, local save and upload, and excluded personal data.
- **FR-014** *(added 2026-11-20)*: On Windows the scanner is a small fixed-size window in the web app's visual style (colours, Inter font, the `leaaf.green` wordmark on the right). It opens on a start screen that says what is collected, with a **Start scan** button. Nothing is read or sent before the button is pressed. During the scan the window shows the current step (the same step labels as the web app), a progress bar, and "Step n of 5". It ends on the completion screen (FR-009) or an error screen with a **Close** button. The window needs no WebView or other runtime beyond Windows 10 or 11 itself. Progress reporting to a scan session is unchanged (feature 006 FR-003): the same step and error events, sent only after **Start scan**.
- **FR-015** *(amendment 2026-11-20)*: When the upload fails temporarily (the server is unreachable, times out, or answers 429 or 5xx), the error screen offers **Try again** next to **Close**. Try again uploads the already saved scan again without rescanning, as often as needed. A temporary failure is not reported to a waiting scan session, so a later successful retry still completes it. The failure is reported when the user closes the window instead. A rejected scan (other 4xx answers) and an invalid server answer are not retryable and are reported as before.
- **FR-016** *(amendment 2026-11-20, revised the same day)*: The scanner executable, its window title bar, and its taskbar button use the web app's leaf favicon (`web/public/favicon.svg`: a green outlined leaf on a transparent background). Windows still adds its administrator shield to the file icon (FR-001). *(Originally: an "l." monogram on a light green tile.)*
- **FR-013** *(amendment 2026-11-20)*: When available, the scanner also collects: RAM type, configured speed, and total and used slot counts; Windows 11 readiness indicators (TPM presence and spec version, Secure Boot state, and firmware type UEFI or legacy BIOS); the battery cycle count; and the names of the graphics adapters. Unreadable values are `null`, as in FR-004. The field list and its Windows data sources are defined in [`shared/src/device.ts`](../../../shared/src/device.ts).

## Non-functional requirements and constraints

- **Privacy:** Collect only the fields above. The device link is the only access control, so the ID must be unguessable; never log full device IDs together with request IPs.
- **Performance:** A scan on typical demo hardware should finish in under 30 seconds, excluding upload time.
- **Compatibility:** Windows 10 and 11, x64. Users need administrator credentials to run the scanner *(revised 2026-11-20; originally it degraded to `null` rather than requesting elevation)*. A source that still fails while elevated, such as a vendor-specific battery class, degrades to `null` (FR-004).
- **Security:** The scanner contains no secrets (in particular, no LLM API key). The backend validates and size-limits input before storing it.
- **Schema:** The device JSON schema is versioned (`schema_version`) so features 002–005 can rely on it. It is defined once in `shared/` with TypeBox and exported as JSON Schema 2020-12 files; see [ADR-001](../../adr/adr-001-shared-contracts-typebox.md).

## User journeys and edge cases

1. **Happy path:** The owner opens the website, reads what is collected, downloads the exe, and runs it. Windows asks for administrator rights. The scanner window opens; the owner presses **Start scan**, watches the steps, and on the completion screen presses **Show my results**, which opens the device page in the browser. *(Revised 2026-11-20; originally a console window showed progress and the browser opened by itself.)*
2. **Partial scan:** On a desktop PC there is no battery, so battery fields are `null`, `scan_status` is `partial`, and the page shows "Unknown" for battery.
3. **Offline / backend down:** The upload fails. The scanner prints the error and the path of the saved JSON and exits non-zero; the owner can rerun it later.
4. **Rescan:** Running the scanner again creates a new record and a new link; the old link keeps working.
5. **Link guessing:** A visitor changes characters in a device URL and gets "device not found", with no hint that other IDs exist.
6. **SmartScreen:** An unsigned exe may trigger a Windows SmartScreen warning. The landing page explains how to proceed. Code signing is out of scope.

## Proposed technical approach

Partly adopted during implementation (marked below); the rest is still a proposal.

- **Adopted decisions (2026-11-20, user choice):** the scanner reads WMI over COM with the Go modules `github.com/yusufpapurcu/wmi` and `github.com/go-ole/go-ole`, not by running PowerShell. The server uses Fastify.
- **Repository layout (folders created 2026-11-20 at the user's request):** `scanner/` (Go), `server/` (TypeScript, Node), `web/` (React + TypeScript, proposed Vite build), and `shared/` for the device JSON schema, which both the server and the web app use. `corpus/`, `data/`, and `demo/` hold data for features 002, 003, and 005.
- **Scanner (implemented, T-003/T-004/T-005/T-011; see [`scanner/README.md`](../../../scanner/README.md)):** the WMI queries in `scanner/internal/collect/queries.go` name each selected property and are the privacy allowlist, together with `scan.Raw`. Normalization (`internal/scan`) is pure and tested on recorded readings. `MSFT_PhysicalDisk` drives on USB, SD, or virtual buses are excluded. Battery values come from `root\WMI`, with `powercfg /batteryreport /xml` as a fallback (only its battery section is parsed, and the temp file is deleted). The Windows version comes from the registry, the firmware type from `GetFirmwareType`, and Secure Boot from the `SecureBoot\State` registry key. Each source has a 10 s timeout. The scanner refuses to open a device link that is not http(s). *(2026-11-20)* A `requireAdministrator` manifest and version info are embedded with `go-winres`. The generated `.syso` files are committed so a plain `go build` includes them. The link opens through `explorer.exe`, which runs as the signed-in user, so the browser does not inherit the elevation. It waits for Enter before closing (`-no-wait` skips this). Output is validated against `DeviceScan.schema.json` in a Go test (ADR-001).
- **Scanner (original proposal):** Go querying WMI/CIM (`Win32_ComputerSystem`, `Win32_Processor`, `Win32_PhysicalMemory`, `MSFT_PhysicalDisk` for media and bus type and health, `Win32_Battery` / `BatteryFullChargedCapacity` / `BatteryStaticData` for capacities, `Win32_BIOS` for the release date), with `powercfg /batteryreport` as a fallback for battery capacity. Each collector is isolated so a failure yields `null`. Parsing and normalization are pure functions with unit tests on recorded WMI output fixtures. The backend URL is injected via `-ldflags` at build time.
- **Backend (implemented, T-006/T-007):** Fastify in `server/src/app.ts`, started by `server/src/main.ts` (`npm start -w server`). Uploads are validated with the shared TypeBox schema (`server/src/devices/validate.ts`, one error per field as a JSON Pointer) and with `checkDeviceScan` from `shared/src/invariants.ts` (for example, `scan_status` must match the null fields). Records are stored in SQLite through the built-in `node:sqlite` (table `devices`, `server/src/devices/store.ts`), the same as the fact cache, so `better-sqlite3` is not needed. Device IDs are `crypto.randomBytes(16)` as base64url (22 characters). The body limit is `MAX_UPLOAD_BYTES` (32 KiB), answered with 413. Unknown and malformed IDs get the same 404 body. Request logs carry only the method and route pattern, never the URL or the client IP. The server also serves `/downloads/leaaf-scanner.exe` from `SCANNER_EXE_PATH` (404 until a build exists).
- **Web:** React routes `/` (landing and download) and `/d/:id` (device page) fetching `GET /api/devices/:id`.
- **Tests:** Go unit tests for the parsers and the privacy filter; backend integration tests for upload, validation, ID format, and not-found; a component test for the device page's rendering of "Unknown".

## Dependencies and risks

- **Dependency:** Access to at least one Windows laptop for manual verification for the real scan (see feature 002 for the three selected models).
- **Risk:** WMI battery and disk-health classes vary by vendor, so those fields may often be `null` even when elevated. Mitigation: graceful `null` handling, and the ranking in feature 003 treats unknowns as lower confidence.
- **Risk** *(added 2026-11-20)*: The elevation prompt for an unsigned exe shows "Publisher: Unknown", which adds friction on top of SmartScreen. Users without administrator credentials cannot scan at all. Accepted by the user with the FR-001 revision.
- **Risk:** Antivirus or SmartScreen may flag an unsigned Go exe. Mitigation: guidance on the landing page; signing deferred.
- **Risk:** The schema may need fields that features 002–003 discover later. Mitigation: `schema_version` and additive changes.

## Review and integration

- **Completion boundary:** Locally verified handoff with self-review. Public deployment of this functionality is owned by feature 005.
- **Review:** Self-review of the final diff against this plan (privacy fields in particular), recorded in `ACCEPTANCE_CRITERIA.md`. No independent reviewer is required by repository policy; the team may review informally.
- **CI/merge:** CI ([`.github/workflows/ci.yaml`](../../../.github/workflows/ci.yaml), added by feature 005 on 2026-11-20) runs the workspace checks and the scanner's Go checks on pull requests and pushes to `main`. The required local checks are Go tests, server tests, web tests, and type checks. Pushing and merging need user authorization.

## Release and recovery (when applicable)

Not applicable to this feature: release and hosting are owned by feature 005 (`feature-005-public-demo-deployment`).

## Assumptions and open questions

- The scanner only needs to support x64 Windows 10/11; ARM Windows is out of scope.
- **Open:** Exact WMI sources for battery and disk health on the demo models; decided during implementation and recorded here.
- **Decided 2026-11-20:** The scanner shows a minimal GUI (FR-014), built with Gio. It was chosen over Wails (needs the WebView2 runtime, which old or unpatched Windows 10 machines may lack) and native Win32 controls (cannot match the web design). *(Originally open, with the console UI as the default.)*
- **Development (2026-11-20):** `go run -tags gui ./cmd/leaaf-scanner` opens the same window on Linux. It needs cgo and the X11/Wayland development libraries. Without the tag, other operating systems get the console build, so CI needs neither.
- **Deferred (2026-11-20):** Scanning on macOS and Linux (collectors, per-OS builds and downloads, elevation, signing) was discussed and deferred until after the hackathon at the user's request. It would be a new feature and would change the product's Windows-only decision. Gio already covers the window on all three systems.
- Feature 002 selected the ThinkPad T480, XPS 13 9360 and EliteBook 840 G5.

## Scope change log

| Date       | Change                 | User approval                                                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Initial approved scope | User replied "accept" to the five-feature MVP proposal in the specification conversation, 2026-11-20 |
| 2026-11-20 | Amendment: added FR-013 (extra scan fields: RAM slots and type, Windows 11 readiness, battery cycle count, GPU names), AC-013, and T-011. Existing requirements and exclusions are unchanged. | The user selected these fields when the shared contracts were defined together, 2026-11-20 |
| 2026-11-20 | Behavioral replacement before verification: FR-009 no longer opens the browser automatically; a **Show my results** button on a completion screen does. FR-014 adds the scanner window (start screen, step progress, completion and error screens) and resolves the console-or-GUI question. AC-005 and AC-008 are revised, AC-014 and T-013 are added. FR-009 had not been verified on Windows (AC-008 Not run); AC-005's automated evidence describes the console flow and is kept as history. | User chose "Accept and implement" in the scanner conversation, 2026-11-20, and chose Gio after comparing it with Wails and native Win32 |
| 2026-11-20 | Amendment: added FR-015 (**Try again** after a temporary upload failure, re-uploading the saved scan; the session is not ended by a temporary failure), AC-015, and T-014. Existing requirements and exclusions remain valid; the FR-009 error screen gains a button. | User chose "Accept and implement" after asking what happens when a laptop temporarily cannot reach the server, 2026-11-20 |
| 2026-11-20 | Behavioral replacement before verification: FR-010 narrowed from "all scanned fields" to the field set of feature 006 FR-010, which implements this page. AC-009 revised to match. AC-009 had not been verified, so no passing evidence is replaced. | User chose "Narrow 001 FR-010" when asked how to resolve the conflict with feature 006 FR-010, 2026-11-20 |
| 2026-11-20 | Amendment: added FR-016 (custom "l." monogram icon for the exe, title bar, and taskbar), AC-016, and T-015. Existing requirements and exclusions are unchanged. | User asked for a custom exe icon and chose "Yes, \"l.\" monogram", 2026-11-20 |
| 2026-11-20 | Behavioral replacement before verification: FR-016's icon changed from the "l." monogram to the web app's leaf favicon. AC-016 and T-015 updated; AC-016 had not passed. | User, 2026-11-20 ("actually, please use the favicon for the .exe instead") |
| 2026-11-20 | Behavioral replacement before verification: FR-001 now requires administrator rights (UAC prompt on start) instead of running without them. The compatibility constraint and AC-001 change accordingly, and T-012 is added. The browser is opened non-elevated. FR-001 had not been verified yet (AC-001 Not run), so there was no earlier evidence to preserve. | User chose "Accept and implement" in the scanner conversation, 2026-11-20, and chose to commit the generated `.syso` files |

## Related and superseded features

Features 002–005 depend on its device schema and device page.

- **FR-009 partly replaced by [feature 006](../feature-006-web-app/PLAN.md#related-and-superseded-features) FR-002 to FR-004** (implemented on the branch `feat/device-scan-and-upload`, merged into `main` 2026-11-20). A scanner downloaded through Scan now carries a session ID. It reports its progress to the browser tab that started it instead of opening the device page itself. A download without a session, including the plain `/downloads/leaaf-scanner.exe` link, keeps FR-009 as written. AC-008 still applies to that case. *(2026-11-20: FR-009 itself was revised so that no download opens the browser automatically. A session tab still updates by itself, and the window's **Show my results** button works with and without a session.)*
- **FR-010 narrowed to [feature 006](../feature-006-web-app/PLAN.md#related-and-superseded-features) FR-010** (2026-11-20, effective; the specs card was already implemented that way on `main`). See the scope change log.
- The payload gained an optional `session_id` (additive, `schema_version` stays 1). The server removes it before storing, so FR-005 and FR-011 are unaffected.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: None yet
- Product context: [`docs/PRODUCT.md`](../../PRODUCT.md); terms: [`docs/GLOSSARY.md`](../../GLOSSARY.md)
- Next features: [002](../feature-002-knowledge-base-retrieval/PLAN.md), [003](../feature-003-five-path-ranking/PLAN.md), [004](../feature-004-explained-report/PLAN.md), [005](../feature-005-public-demo-deployment/PLAN.md)
