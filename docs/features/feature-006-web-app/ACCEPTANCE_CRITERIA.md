# Acceptance Criteria: Web app (landing, scan session, results)

- **Feature ID:** `feature-006-web-app`
- **Verification status:** Not started (first version written; partial checks only, see verification notes)

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome                                                                                                                                      | Verification method                                                                              | Result  | Evidence                                                                                      |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------- |
| AC-001 | FR-001      | Given the landing page, then logo, tagline, three step cards in the stated order, and a Scan now button are visible without scrolling at 1440 × 900.             | `app.test.tsx` "Landing shows the three steps…"; manual check in a browser                       | Not run | Test file written; not executed (see notes). Server-render smoke test produced the markup.    |
| AC-002 | FR-002      | When Scan now is pressed, a session is created, the download starts (live mode), and a new tab opens at `/s/<22-char id>`. A blocked tab falls back to the same tab. A failed session shows an error. | `app.test.tsx` "opens a new tab on the session route…"; manual check with a pop-up blocker       | Not run | Test file written; not executed.                                                              |
| AC-003 | FR-003      | The session page shows the result skeleton with shimmer and a status line. It says it is waiting before the first event and shows the step text with "Step n of 5" afterwards. | `app.test.tsx` "ScanSession shows the skeleton and a live status…"; manual check                 | Not run | Test file written; not executed.                                                              |
| AC-004 | FR-004      | On a `complete` event the tab shows the result screen at `/d/<deviceId>` without a new history entry. On an `error` event the message is shown with a way back.  | `app.test.tsx` (completion); manual check of the error state with a mock error event             | Not run | Completion test written; error state not yet covered by a test.                               |
| AC-005 | FR-005, FR-006 | The result screen lists five cards, ranked, with exactly one Recommended label on the first viable path; gauge and specs sit in the right column.             | `app.test.tsx` "renders five path cards…"; `lib.test.ts` "path views"; manual check             | Not run | `lib.test.ts` "path views" passed under an ad-hoc runner (see notes); Vitest not run.          |
| AC-006 | FR-006      | Expanding a card shows What to do and Why once the report has arrived, and placeholders before. Sources link to the cited passage URL.                          | `app.test.tsx` "expands a card…"; manual check                                                   | Not run | Test file written; not executed.                                                              |
| AC-007 | FR-007      | The gauge value equals avoided CO₂e divided by the baseline midpoint, limited to 0–100; the needle and the shaded range follow the selected card.               | `lib.test.ts` "gauge geometry", "impact formatting"; manual check by clicking cards              | Not run | Same tests passed under an ad-hoc runner (see notes). Selection behavior not yet checked.     |
| AC-008 | FR-008      | Changing the Use dropdown requests a new ranking. Changing the priority toggle re-orders the cards without a new request.                                       | `app.test.tsx` "switches the priority toggle"; manual check                                      | Not run | Toggle test written; dropdown re-request not yet covered by a test.                           |
| AC-009 | FR-009      | The dropdown offers office, study, development, pass_on (Give to a friend), gaming, in that order, and defaults to office.                                       | `app.test.tsx` "offers the five use tags…"                                                       | Not run | Test file written; not executed.                                                              |
| AC-010 | FR-010      | The specs card shows battery, storage, memory, processor, graphics, and security chip. Unreadable values show "Unknown"; a partial scan shows the note.          | `lib.test.ts` "scan summary"; manual check with the desktop fixture                              | Not run | `lib.test.ts` "scan summary" passed under an ad-hoc runner (see notes); the note is unchecked. |
| AC-011 | FR-011      | An unknown `/d/<id>` shows "We could not find this scan" with a way home. A path that is not a route shows "Page not found".                                    | `app.test.tsx` "explains an unknown device…"; `lib.test.ts` "router"                             | Not run | `lib.test.ts` "router" passed under an ad-hoc runner; Vitest not run.                         |
| AC-012 | FR-012      | With no backend, `npm run dev -w web` serves the full journey from the fixtures, and the landing page shows the Sample data label.                                | Manual: start the dev server and walk the journey                                                | Not run | Production bundle built with an ad-hoc esbuild command only (see notes).                      |
| AC-013 | FR-013      | Screens use the palette and type from `docs/VISUAL_DESIGN.md`; at 1440 × 900 and 1280 × 720 each main message is readable without scrolling.                     | Manual review with the team                                                                      | Not run | Not reviewed in a browser yet.                                                                |
| AC-014 | FR-012      | In live mode, the journey works against the real backend: session, scanner events, device, assessment and report streams.                                       | Manual end-to-end run with scanner and server                                                    | Blocked | Waits for the backend session routes (TASKS T-010).                                           |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

## Review and integration evidence

The agreed completion boundary is a locally verified handoff with self-review (see the plan). No independent review has taken place. Required checks (`npm run typecheck`, `npm test`, `npm run build -w web`) are Not run.

## Verification notes

**2026-11-20, first version, environment without network access.** Packages could not be installed, so Vite, Vitest, jsdom, Testing Library, the React type packages, and `typebox` were not available. What was run instead:

- `esbuild` bundled `web/src/main.tsx` (including the shared contracts and fixtures through aliases) without errors. `typebox` was replaced by an inert stand-in for this check, because the web app imports only types and the ranking helpers from `shared/`.
- The 12 tests in `web/src/test/lib.test.ts` ran under a small ad-hoc runner that mimics `describe`/`it`/`expect`. All 12 passed. This is not a Vitest run.
- The landing page, not-found page, skeleton, status line, toolbar, gauge, specs card, and all five path cards were server-rendered with `react-dom/server` from the laptop fixtures without errors. Effects do not run in server rendering, so interaction is not covered.
- `app.test.tsx` (component tests) has not been executed. `npm run typecheck`, `npm test`, `npm run build -w web`, and the browser review have not been run.

No criterion is marked `Pass` on this basis.
