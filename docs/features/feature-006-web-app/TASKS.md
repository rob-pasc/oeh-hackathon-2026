# Implementation Tasks: Web app (landing, scan session, results)

- **Feature ID:** `feature-006-web-app`
- **Status:** Implemented (verification pending)

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Set up `web/` (Vite, React, TypeScript, Tailwind via PostCSS, Vitest config), add it to the root workspaces, and document the commands (supports `AC-012`)
- [x] **T-002:** Write the pure logic: routes, gauge geometry, impact formatting, path views from `Assessment` and `Report`, scan summary (supports `AC-005`, `AC-006`, `AC-007`, `AC-010`)
- [x] **T-003:** Write the API layer: client interface, mock client on the shared fixtures, live client (supports `AC-002`, `AC-003`, `AC-012`)
- [x] **T-004:** Build the landing page with the Scan now flow (supports `AC-001`, `AC-002`)
- [x] **T-005:** Build the session page: skeleton, status line, completion and error states (supports `AC-003`, `AC-004`)
- [x] **T-006:** Build the result screen: path cards, gauge, specs card, toolbar, not-found states (supports `AC-005` to `AC-011`)
- [x] **T-007:** Add shared visual conventions in `docs/VISUAL_DESIGN.md`, update `README.md`, `web/README.md`, and the feature index (supports `AC-013`)
- [x] **T-008:** Install dependencies and run `npm run typecheck`, `npm test`, and `npm run build -w web`; fix what they report (supports all ACs)
- [ ] **T-009:** Review the screens in a browser at 1440 × 900 and 1280 × 720 with the team; record the findings (supports `AC-013`)
- [x] **T-010:** Agree the session routes and events with the backend team and switch on live mode (supports `AC-014`)
- [x] **T-011:** Fix the gauge arc flag and add regression tests (supports `AC-017`)
- [x] **T-012:** Rename the landing button to "Download and Scan now" (supports `AC-015`)
- [x] **T-013:** Add the path tags to the toolbar and the steps view with step blocks, with tests (supports `AC-016`)
- [x] **T-014:** Add the option cards to the path tabs: types, option view builder, sample data, path tab view, gauge following the option, with tests (supports `AC-018`, `AC-020`)
- [x] **T-015:** Align the toolbar with the result columns and restyle the Use dropdown chevron (supports `AC-019`)
- [ ] **T-016:** Agree the option payload with the backend team (`DESIGN.md`) and show real options in live mode (supports `AC-018`)
- [x] **T-017:** Add the contact footer to every screen and write the header wordmark in capitals (supports `AC-021`)
- [x] **T-018:** Lowercase wordmark in the header; 5 px more space under the scan button (supports `AC-022`)
- [x] **T-019:** Add the `general` use tag (supports `AC-023`)
- [x] **T-020:** Make the path summary block in path tabs visibly non-interactive (supports `AC-024`)
- [x] **T-021:** Make `general` the default use tag (supports `AC-025`)
- [x] **T-022:** Replace the leaf icon logo with the terminal-style logo (supports `AC-026`)
- [x] **T-023:** Replace the terminal-style logo with the "leaaf.green" wordmark; more space under the scan button (supports `AC-027`)
- [x] **T-024:** Live parts list on the scan page with mock lookups (supports `AC-028`)
- [x] **T-025:** Optional laptop view, remembered per browser (supports `AC-029`)
- [x] **T-026:** Animated reordering of the path cards (supports `AC-030`)
- [x] **T-027:** Counting numbers (supports `AC-031`)
- [x] **T-028:** CO₂e equivalents with sourced factors (supports `AC-032`)
- [x] **T-029:** Before/after on action cards (supports `AC-033`)
- [x] **T-030:** Hover lift, sliding highlights, fade-in, reduced-motion handling (supports `AC-034`)
- [x] **T-031:** Show the laptop view by default; remove the "could not be verified" notes from cards (supports `AC-035`, `AC-036`)
- [x] **T-032:** Show what leaaf stands for on the landing page, in the footer, and in the tab title (supports `AC-037`)
- [x] **T-033:** Reword the labels and landing texts (supports `AC-038`, `AC-039`)
- [x] **T-034:** Hover explanations, shorter priority-change line, empty detail sections left out (supports `AC-040` to `AC-042`)
- [x] **T-035:** Derive the zone states from step events (`done`, `skipped`, implicit done) and show skipped zones in amber (supports `AC-043`, `AC-044`)
- [x] **T-036:** Pace the playback of the scan events with the 2 s limit and no pacing for reduced motion (supports `AC-045` to `AC-047`)
- [x] **T-037:** Remove the name from the footer (FR-035 revision) and add the selection colour (supports `AC-037`, `AC-048`)
- [x] **T-038:** Make the landing page and "Page not found" responsive (supports `AC-049`)
- [x] **T-039:** Add the thinking line (leaf glyph SVG, rotating phrases) above the AI placeholders, with tests (supports `AC-050`–`AC-052`)
- [x] **T-040:** Add the imprint and the privacy notice in German and English with a language switch, the footer links, and self-hosted Inter, with tests (supports `AC-053`–`AC-055`)
- [ ] **T-041:** Fill in the bracketed log retention in `web/src/legal/provider.ts` (the address is entered) and have the texts read once (supports `AC-056`)
- [ ] **T-042:** Backend: finish the deletion of scan data after 30 days (being added), set the access-log retention, and decide how the Caddy access log treats `/d/<id>` paths (supports `AC-056`)

## Dependencies and blockers

- T-016 needs the backend team's decision on the option payload and on what avoided CO₂e means for a single action.

## Progress notes

The first version was written without network access. After the merge into `main` (b879a96) the dependencies were installed; the web type-check fix is a846d99. T-008 is done: type check, tests, and build pass (see the verification notes in `ACCEPTANCE_CRITERIA.md`). The browser review (T-009) remains.

2026-11-20: The server's report stream exists (feature 003 T-007) and sends `assessment`, then `end`, with no report until feature 004. The result screen now treats `end` as "no report coming" and shows "No steps available" instead of placeholders (test "stops waiting for the report when the stream ends without one"). In live mode the default `general` tag and `gaming` still get `400` until they are added to the contract. (Resolved later that day: feature 003 FR-015 added them, and the web app's `UseTag` is now the contract's `IntendedUse`.)

2026-11-20: T-010 done. The session routes, events, and executable trailer were decided with the user, then implemented in `shared/src/session.ts`, the server, and the scanner. The web client now takes the session types from `shared/`, routes `/s/` only for 26-character Crockford IDs, and proxies `/api` and `/downloads` in `npm run dev`. The browser journey against the real backend (AC-014) still needs a Windows run of the scanner.

## Lifecycle history

- 2026-11-20: Implemented in a first version on the branch `feat/web-ui`. Required verification (T-008, T-009) is pending, so the feature is not complete.
- 2026-11-20: Scope extended by amendment (FR-014 to FR-016, AC-015 to AC-017, T-011 to T-013); see the plan's scope change log. Implemented the same day; verification pending (T-008, T-009 now also cover the new criteria).
- 2026-11-20: Second scope extension by amendment (FR-017, FR-018, AC-018 to AC-020, T-014 to T-016); see the plan's scope change log. Implemented the same day; verification pending.
- 2026-11-20: Third scope extension by amendment (FR-019, AC-021, T-017); see the plan's scope change log. Implemented the same day; verification pending.
- 2026-11-20: Fourth scope extension by amendment (FR-020 to FR-022, AC-022 to AC-024, T-018 to T-020); see the plan's scope change log. Implemented the same day; verification pending.
- 2026-11-20: Fifth scope extension by amendment (FR-023, AC-025, T-021); see the plan's scope change log. Implemented the same day; verification pending.
- 2026-11-20: Merged into `main` (b879a96). T-008 done; T-009 and T-010 still pending.
- 2026-11-20: Branch `feat/device-scan-and-upload` (T-010, session routes and live mode) merged into `main` together with the amendments above. T-009 and T-016 remain open.
- 2026-11-20: Sixth scope extension by amendment (FR-024, AC-026, T-022); see the plan's scope change log. Implemented the same day; verification pending.
- 2026-11-20: Seventh scope extension by amendment (FR-025, AC-027, T-023); see the plan's scope change log. Implemented the same day; verification pending.
- 2026-11-20: Eighth scope extension by amendment (FR-026 to FR-032, AC-028 to AC-034, T-024 to T-030); see the plan's scope change log. Implemented the same day and looked at in headless Chrome; verification by the team pending.
- 2026-11-20: Ninth scope extension by amendment (FR-033, FR-034, AC-035, AC-036, T-031); see the plan's scope change log. Implemented the same day; verification by the team pending.
- 2026-11-21: Tenth scope extension by amendment (FR-035 to FR-040, AC-037 to AC-042, T-032 to T-034); see the plan's scope change log. Implemented the same day and looked at in headless Chrome; verification by the team pending.
- 2026-11-21: Eleventh scope extension by amendment (FR-041, FR-042, AC-043 to AC-047, T-035, T-036), together with feature 001 FR-017; see the plan's scope change log. Status set from `Implemented (verification pending)` to `In progress` for the implementation.
- 2026-11-21: FR-035 revised (no name in the footer) and twelfth scope extension by amendment (FR-043, AC-048, T-037: selection colour); see the plan's scope change log.
- 2026-11-21: Thirteenth scope extension by amendment (FR-044, AC-049, T-038); see the plan's scope change log. Implemented the same day and looked at in headless Chrome; verification by the team pending.
- 2026-11-21: T-035 to T-037 implemented and verified (AC-043 to AC-048 pass; see the acceptance criteria). Status back to `Implemented (verification pending)`: the team browser review (T-009) and T-016 remain.
- 2026-11-21: Fourteenth scope extension by amendment (FR-045, AC-050 to AC-052, T-039: thinking line while waiting for the AI); see the plan's scope change log. Status set from `Implemented (verification pending)` to `In progress` for the implementation.
- 2026-11-21: T-039 implemented and verified (AC-050 to AC-052 pass; see the acceptance criteria). Status back to `Implemented (verification pending)`: the team browser review (T-009) and T-016 remain.
- 2026-11-21: Fifteenth scope extension by amendment (FR-046, AC-053 to AC-056, T-040 to T-042: imprint, privacy notice, self-hosted Inter); see the plan's scope change log. T-040 implemented and looked at in headless Chrome; T-041 and T-042 are open and block AC-056.
