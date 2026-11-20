# Feature Design: Web app (landing, scan session, results)

- **Feature ID:** `feature-006-web-app`
- **Design status:** Proposed; the scan-session design below was adopted with the user on 2026-11-20

## Design goals and constraints

- Show the backend payloads (`Assessment`, `Report`, `DeviceRecord`) as they are defined in `shared/`; never compute rankings or figures the server owns (FR-006, FR-007).
- Work without a backend (FR-012) and switch to the real one without code changes in the screens.
- Few dependencies: React, Tailwind, and a tiny router. Laptop screens only (FR-013).

## Proposed solution

```text
web/src
  main.tsx, index.css        entry and design tokens (Tailwind @theme)
  app/                       App (route switch), router (History API)
  pages/                     Landing, ScanSession, DevicePage, NotFound
  components/                PathCard, PathTabView, StepsView, Gauge, SpecsCard, Toolbar, ResultsView, skeletons, status
  lib/                       labels, impact formatting, gauge geometry, path and option views, scan summary
  api/                       ApiClient interface, mock client (fixtures), live client, sample options
  test/                      Vitest setup and tests
```

`ResultsView` is shared by the session tab (after completion) and the device page. It loads the device once, restarts the assessment/report stream whenever the Use tag changes, and re-ranks locally with `rankPaths` from `shared/` whenever the priority toggle changes.

## User experience and states

| Screen          | Route         | States                                                                                          |
| --------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| Landing         | `/`           | idle, starting (button disabled), error                                                         |
| Scan session    | `/s/:id`      | waiting for the scanner, step n of 5, failed                                                    |
| Device / result | `/d/:id`      | skeleton, ranked cards with report pending, report ready, template-report notice, not found     |
| Not found       | anything else | static                                                                                          |

Opening the new tab happens inside the click handler (`window.open('', '_blank')`) and the tab is pointed at the session page after the session exists. This keeps pop-up blockers quiet. If the tab is blocked, the current tab navigates.

## Data flow and interfaces

Existing routes (see `shared/src/api.ts`): `GET /api/devices/:id`, `GET /api/devices/:id/report?intended_use=` (Server-Sent Events `assessment`, `report`, `end`, `error`).

**Scan sessions (adopted 2026-11-20 with the user, implemented):** contract in [`shared/src/session.ts`](../../../shared/src/session.ts), server in `server/src/app.ts` and `server/src/sessions/`, scanner in `scanner/internal/run/`.

- `POST /api/sessions` → `{ "session_id": "<26 Crockford base32 chars>", "download_url": "/downloads/leaaf-scanner.exe?session=<session_id>" }`. The ID is 130 bits from the OS random source and is created when Scan now is pressed.
- `GET /downloads/leaaf-scanner.exe?session=<id>` sends the unchanged executable followed by the 37-byte trailer `LEAAFSCAN1:<session_id>`. Windows never loads bytes after the last PE section (an overlay, as self-extracting archives use), so the program is unaffected. The scanner reads the last 37 bytes of its own file and accepts the ID only after the exact marker. A build or plain download without the trailer behaves as feature 001 describes: it opens the device page itself. The `1` versions the trailer format.
- The scanner posts `POST /api/sessions/:id/events` with `step` or `error` events (best effort, 3 s timeout) and puts `session_id` into its upload. The server removes `session_id` from the stored scan and emits `complete` with the device ID. Scanners cannot post `complete`.
- `GET /api/sessions/:id/events` (Server-Sent Events, event name = `type`) replays the latest event on connect and ends after `complete` or `error`:

`step` is one of `started`, `cpu_memory`, `storage`, `battery`, `upload`; `state` is `running`, `done`, or `skipped`. Error `code` is `scanner_failed`, `upload_failed`, `timeout`, or `unknown`. The TypeScript form is in `web/src/api/types.ts`. The session ID is a separate secret from the device ID and is not returned by any device route.

### Proposed option payload (not yet agreed with the backend team)

The result contract has one combined impact per path. For the upgrade path that is "SSD and RAM together". People ask what each single action brings, including actions that are not possible (CPU, graphics in a laptop). The proposal is one more event after `report`:

```json
event: options
data: { "options": [
  { "option_id": "ssd", "path": "upgrade", "title": "SSD upgrade", "status": "viable",
    "summary": "Swap the old hard disk for a 500 GB NVMe SSD.",
    "impact": { "cost_eur": {…}, "useful_life_years": {…}, "co2e_kg": { "path": {…}, "baseline": {…}, "avoided_vs_baseline": {…} }, "displacement": "assumed", "assumptions": [{…}] },
    "steps": ["Buy a 500 GB M.2 2280 NVMe SSD.", "Back up your data, then install the SSD and clone the old drive."],
    "why": "The old drive is a slow hard disk.", "unverified": [] },
  { "option_id": "cpu", "path": "upgrade", "title": "CPU upgrade", "status": "not_suitable",
    "summary": "The processor is soldered to the board and cannot be replaced.",
    "impact": null, "steps": [], "why": "…", "unverified": [] }
] }
```

`impact` has exactly the shape of `Impact` in `shared/src/assessment.ts` (same calculator, same ranges), `null` for options that are not suitable, like `PathAssessment`. The TypeScript form is `PathOption` in `web/src/api/types.ts`. Until the server sends this event, the path tab shows the path's own steps (FR-015).

Open for the backend team: (1) where the options come from (the calculator for figures, the explanation step for steps and reasons); (2) what `avoided_vs_baseline` means for one action alone: the sample data credits the share of the avoided production that the action's extra life justifies, which is an assumption to confirm in feature 003; (3) whether options need a place in `shared/` (this feature did not edit `shared/`).

## Failure modes and operational considerations

- A scanner that never starts keeps the page waiting; a server-side session timeout that sends `error/timeout` is recommended but not implemented.
- The session ID is a bearer secret for progress events only; it grants no access to device data.
- Server-Sent Events reconnect automatically in the browser; the server replays the latest event on connect (implemented).

## Alternatives and tradeoffs

- **Scanner opens the browser (feature 001 FR-009):** simpler, but the original tab cannot show progress, and the team asked for the live status page. It remains the fallback for a download without a session.
- **Embedding the ID in a PE resource or by re-linking per download:** heavier on the server. The trailer needs no tooling. Consequence: every download has a different hash, so Windows SmartScreen cannot build reputation for the file, and a future Authenticode signature would have to be applied with the trailer in mind.
- **Generate the session ID in the browser:** avoids one request, but then the server cannot embed it in the download without a second call; the server-generated ID keeps one source of truth.
- **Routing library:** not worth the dependency for three routes.

## Open technical decisions

- ~~How the session ID is embedded~~ and ~~how the scanner reports progress~~: resolved 2026-11-20 (overlay trailer, direct HTTP POST; see above).
- Adding `gaming` to `INTENDED_USES` and the scoring rubrics (backend owners).
- A storage fill level in `DeviceScan` if the specs card should show used space (scanner owners).

## References

- Approved scope: [`PLAN.md`](./PLAN.md)
- Requirements and checks: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Shared visual design reference: [`docs/VISUAL_DESIGN.md`](../../VISUAL_DESIGN.md)
- Contracts: [`shared/src/api.ts`](../../../shared/src/api.ts), [`shared/src/report.ts`](../../../shared/src/report.ts)
