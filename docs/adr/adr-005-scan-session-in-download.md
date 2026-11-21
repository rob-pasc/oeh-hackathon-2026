# ADR-005: The scan session travels inside the scanner download

- **Status:** Accepted
- **Date adopted:** 2026-11-20 for Windows and Linux (user decision); 2026-11-21 for macOS. Recorded as an ADR on 2026-11-21.
- **Related feature(s):** [006](../features/feature-006-web-app/PLAN.md) (owner, FR-002 to FR-004), [007](../features/feature-007-macos-linux-scanner/PLAN.md) (macOS and Linux), [001](../features/feature-001-device-scan-and-upload/PLAN.md) (scanner and upload)
- **Supersedes:** None. Replaces, for downloads that carry a session, feature 001's original design where the scanner opened the device page itself.

## Context

The browser tab that offers the download should show the scanner's live progress and then the result, without accounts and without the owner copying a code. The scanner is a single downloaded program. So the tab and the program need a shared secret that the program learns from the download alone. The program is unsigned on Windows and Linux, and ad hoc signed on macOS.

## Decision

- **Session ID:** **Scan now** asks the server for a session (`POST /api/sessions`), which returns a random 26-character Crockford base32 ID and a download URL carrying it.
- **Windows and Linux:** The server appends the trailer `LEAAFSCAN1:<session_id>` after the unchanged executable. Windows ignores bytes after the last PE section, and the Linux loader ignores bytes after the ELF segments. The scanner reads the trailer from the end of its own file.
- **macOS:** Appending would break the app's signature, so the server renames the bundle inside the zip to `leaaf-scanner-<session>.app`. A signature does not cover the bundle folder's own name, and the scanner reads the ID from it.
- **Progress:** The scanner posts its step and error events to the session and sends the ID with its upload. The server removes the ID before storing the scan. The tab follows the session over Server-Sent Events, with the latest event replayed on connect.
- **Without a session:** A download without a session still works, and the scanner window offers **Show my results**.

## Alternatives considered

| Alternative | Benefits | Why not chosen |
| ----------- | -------- | -------------- |
| Scanner opens the device page in the browser (feature 001's original design) | Simplest | The original tab cannot show progress; kept as the fallback |
| Embed the ID in a PE resource, or re-link per download | Cleaner binary | Needs tooling on the server; the trailer needs none |
| Generate the session ID in the browser | One request fewer | The server would need a second call to embed it; one source of truth is simpler |
| A session file inside the macOS bundle, or the trailer on macOS | Same mechanism everywhere | Invalidates the signature; macOS then calls the app damaged without offering Open Anyway |

## Consequences

- Every download has a different file hash, so Windows SmartScreen cannot build reputation for the scanner. A future Authenticode signature must account for the trailer.
- The session ID is a bearer secret for progress events only and grants no access to device data. It is never stored with the scan or returned by device routes.
- **Open:** The macOS bundle-name mechanism still has to be confirmed on a real Mac (feature 007 T-002). A server-side session timeout is recommended but not implemented.

## Implementation / validation references

- Contract: `shared/src/session.ts`; server: `server/src/app.ts` (session routes, downloads), `server/src/sessions/`, `server/src/downloads/zip.ts`; scanner: `scanner/internal/run/` (`SessionFromBundle`, trailer reading)
- Design detail: [feature 006 DESIGN](../features/feature-006-web-app/DESIGN.md), [feature 007 plan](../features/feature-007-macos-linux-scanner/PLAN.md)
- Tests: `server/test/sessions.test.ts`, `server/test/zip.test.ts`, `scanner/internal/run/run_test.go`

## Supersession notes (if applicable)

None.
