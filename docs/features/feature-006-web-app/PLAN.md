# Feature 006: Web app (landing, scan session, results)

- **Feature ID:** `feature-006-web-app`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-20

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

The leaaf web app is a single-page React application in `web/`. A visitor reads a short introduction on the landing page and presses **Scan now**. The page downloads the Windows scanner and opens a new browser tab for this scan. That tab shows the result screen as a shimmering skeleton plus a live status line fed by the scanner. When the scan completes, the same tab becomes the result screen: five ranked path cards on the left, a CO₂e gauge and the scan specs on the right, and a toolbar to choose the use of the computer and the ranking priority.

The web app can run without a backend. In mock mode it serves the fictional fixtures from `shared/fixtures/`, so the screens can be reviewed and the backend team can compare the payloads they need to deliver.

## Problem and desired outcome

- **Problem:** The backend contracts (features 001, 003, 004) describe what is scanned, ranked, and explained, but there is no screen where a person sees it. The team also needs something testable before the scanner and server exist.
- **Desired outcome:** A person understands in a few seconds what leaaf does, starts a scan with one click, sees progress, and then reads a short, ranked result they can act on.
- **Target users / stakeholders:** Owners of old Windows laptops and PCs; the hackathon team, who review and demo the UI.

## Approved scope

### In scope

- A landing page: logo, one-line tagline, three step cards (Scan Device, AI Analysis, Save CO₂ & Money), and a large **Scan now** button.
- **Scan now** creates a scan session, starts the scanner download, and opens a new tab on the session page. The session ID is generated when the button is clicked and is embedded in the downloaded scanner.
- A session page that shows the skeleton of the result screen with loading animation and one status line updated by events the scanner sends.
- A result screen: five path cards (left), CO₂e gauge (right top), scan specs (right bottom), and a toolbar with the **Use** dropdown and the **Environment first / Money first** toggle.
- Use tags: `office`, `study`, `development`, `pass_on` (shown as "Give to a friend"), and `gaming`. The default is `office`.
- A mock API with sample data, and a live API client selected by an environment variable.
- English text. Laptop screens only.

### Out of scope

- The scanner, the backend, and the knowledge base (features 001–005).
- Responsive or phone layouts.
- Other languages, user accounts, history of earlier scans, sharing or export features.
- Hosting and deployment (feature 005).
- The detailed Assumptions, Safety, and Evidence sections of feature 004 FR-003. This feature shows a shorter card (see "Related and superseded features").

## Functional requirements

- **FR-001:** The landing page shows the leaaf logo and name, a one-line tagline, three step cards in the order Scan Device, AI Analysis, Save CO₂ & Money, and a primary **Scan now** button. Each card has at most two short sentences.
- **FR-002:** Pressing **Scan now** creates a scan session whose ID is generated at that moment, starts the download of the scanner built with that ID, and opens a new tab at `/s/:sessionId`. If the browser blocks the new tab, the current tab opens that address instead. If the session cannot be created, the page shows a readable error and stays on the landing page.
- **FR-003:** `/s/:sessionId` shows the skeleton of the result screen with a shimmer animation and one status line. Before the first event the line says that the page is waiting for the scanner. Each scanner event replaces the line with the current step ("Reading CPU & memory…", with "Step n of 5").
- **FR-004:** When the scanner reports completion with a device ID, the same tab becomes the result screen and the address changes to `/d/:deviceId` without a new history entry. When the scanner reports an error, the page shows the message and says to start again from the home page.
- **FR-005:** The result screen has two columns. The left column lists the five paths. The right column shows the CO₂e gauge above the scan specs.
- **FR-006:** Each path card shows its rank, name, status (Viable, Conditional, Not suitable), a one-sentence reason, the cost range, the extra useful life range, and the score where one exists. The first viable path carries the label **Recommended**. A card expands to show "What to do" (the next steps) and "Why", a link to one source passage when the report cites one, and the points that could not be verified. While the report is still loading, the expanded card shows placeholders.
- **FR-007:** The gauge is a half-circle scale from 0 to 100 %. It shows the share of a comparable new laptop's production CO₂e that the selected path avoids (`avoided_vs_baseline` divided by the midpoint of the baseline range, limited to 0–100). The likely range is shaded and written out. The selected path is the card the user last clicked; before any click it is the recommended path. Paths without a CO₂e credit show 0 %.
- **FR-008:** The toolbar has the **Use** dropdown and the **Environment first / Money first** toggle. Changing the dropdown requests the ranking for the new use. Changing the toggle re-orders the cards from the weights already in the assessment, without a new request.
- **FR-009:** The Use dropdown offers exactly the five tags above. `gaming` is not yet part of `INTENDED_USES` in `shared/src/common.ts`; until the backend team adds it, the mock accepts it and the live client sends it unchanged.
- **FR-010:** The scan specs card shows the device name and maker, battery health (with a bar and the cycle count), storage size, type and health, memory size and type, processor, graphics, and the security chip. A value the scan could not read shows "Unknown". A partial scan adds one line saying that results are less certain. The card does not show serial numbers or other identifiers, which the scan does not contain.
- **FR-011:** `/d/:deviceId` loads the result screen directly. An unknown device ID shows "We could not find this scan" and a way back to the home page. Any other path shows a "Page not found" screen.
- **FR-012:** Mock mode is the default. It labels the landing page "Sample data" and simulates the scanner steps, the assessment, and the report with short delays. Live mode, selected with `VITE_API_MODE=live`, calls the routes in `shared/src/api.ts` and the session routes in `DESIGN.md`.
- **FR-013:** Colors, type, and spacing follow [`docs/VISUAL_DESIGN.md`](../../VISUAL_DESIGN.md). Text blocks stay short: card summaries are one sentence and no panel needs scrolling to read its main message at 1440 × 900.

## Non-functional requirements and constraints

- **Layout:** Designed for laptop screens (1280 px and wider). There is no responsive behavior.
- **Accessibility:** Interactive elements are reachable by keyboard and show a visible focus ring. Expandable cards use `aria-expanded`. Progress text is in an `aria-live` region. The gauge has a text alternative. Animations stop when the user prefers reduced motion.
- **Honesty:** Ranges stay ranges. The web app shows only figures that arrive in the assessment; it derives only the gauge percentage and savings from them (feature 003, Honesty).
- **Privacy:** The page never shows or stores more than the contract delivers. The session ID is not the device ID.
- **No backend needed to review:** `npm run dev -w web` works with the fixtures alone.

## User journeys and edge cases

- **Happy path:** Landing → Scan now → new tab with skeleton and status → result screen → switch Use or priority → expand a card.
- **Scanner never starts:** The status line keeps saying that it is waiting for the scanner. The page does not time out by itself in this version.
- **Scanner error:** FR-004 error state.
- **Report slower than assessment:** The cards and the gauge appear with the assessment; the expanded sections show placeholders until the report arrives.
- **Template report:** When the server falls back to template text (feature 004 FR-009), the page shows the server's notice under the cards.
- **Partial scan:** Unknown values are shown as "Unknown" with the note from FR-010.

## Proposed technical approach

Vite, React 19, and TypeScript, styled with Tailwind CSS v4 through PostCSS. The three screens are small enough for a minimal History-API router. The shared contracts and fixtures are imported straight from `shared/` through path aliases, so the web app always sees the current contract. Details, the proposed session events, and the open questions for the backend team are in [`DESIGN.md`](./DESIGN.md). The user approved the scope above, not automatically this approach.

## Dependencies and risks

- **Backend team:** The session routes and events in `DESIGN.md` are a proposal. Embedding the session ID in the downloaded scanner needs a decision from the scanner and server owners. Until agreed, only mock mode is supported.
- **Contract gap:** `gaming` is missing in `shared/src/common.ts` (FR-009). Storage fill level is not in `DeviceScan`, so the specs card cannot show "used space".
- **Tooling (resolved 2026-11-20):** Dependencies could not be installed while the first version was written. They are installed now, and the type check, Vitest suite, and build pass (see `ACCEPTANCE_CRITERIA.md`).

## Review and integration

The completion boundary is a locally verified handoff with self-review, per the repository default. The change was prepared on the branch `feat/web-ui` and has been merged into `main` (b879a96) by the team; merging was not part of this feature's completion. Required checks once dependencies are installed: `npm run typecheck`, `npm test`, and `npm run build -w web`.

## Assumptions and open questions

- **Non-blocking:** The backend accepts the proposed session routes and events (`DESIGN.md`), or proposes its own.
- **Non-blocking:** Adding `gaming` to `INTENDED_USES` and to the scoring rubrics (feature 003) is the backend team's decision.
- **Non-blocking:** The gauge definition (share of a new laptop's production CO₂e) was chosen by the team on 2026-11-20 and is easy to change.

## Scope change log

| Date       | Change                 | User approval                                                                                                                |
| ---------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Initial approved scope | User, in the planning conversation on 2026-11-20 ("accept und lets go, erstelle uns die Seite bitte"), after the design review |

## Related and superseded features

This feature builds the web surface that features 001, 003, and 004 describe and reuses their contracts unchanged. Requirement IDs are local to each feature.

**Implemented here (no change in intent):**

- `feature-001-device-scan-and-upload` / FR-010, FR-011, FR-012 (device page, not-found page, landing page and download), task T-008.
- `feature-003-five-path-ranking` / FR-001 (picker), FR-012 (ranked view), and the Environment first / Money first toggle.
- `feature-004-explained-report` / FR-001, FR-003 (cards with Recommended label, reason, expandable details).

**Planned replacements (not yet effective; the earlier plans stay in force until then):**

- `feature-001-device-scan-and-upload` / FR-009 (scanner opens the device page in the default browser): planned to be replaced by FR-002 to FR-004 here, where the browser tab is opened before the download and the scanner only reports progress and the final device ID. Needs backend confirmation.
- `feature-003-five-path-ranking` / FR-001 (four options, ranking only after a choice): planned to be replaced by FR-008 and FR-009 here (five options including `gaming`, default `office`, ranking shown at once).
- `feature-004-explained-report` / FR-002 (impact summary above the cards) and FR-003 (sections Evidence, Assumptions, Safety and feasibility): planned to be replaced by the gauge (FR-007) and the shorter card (FR-006). The report payload still carries these sections; the web app does not show them yet.
- `feature-004-explained-report` / Responsiveness (readable at 360 px): planned to be dropped for this version (laptop screens only).

When a replacement is implemented and merged, record the date and implementing commit here and add a reciprocal note to the earlier plans, as described in `docs/workflow/CHANGE_HISTORY.md`.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Design and proposed session events: [`DESIGN.md`](./DESIGN.md)
- Shared visual conventions: [`docs/VISUAL_DESIGN.md`](../../VISUAL_DESIGN.md)
- Contracts: [`shared/src/api.ts`](../../../shared/src/api.ts), [`shared/src/assessment.ts`](../../../shared/src/assessment.ts), [`shared/src/report.ts`](../../../shared/src/report.ts)
