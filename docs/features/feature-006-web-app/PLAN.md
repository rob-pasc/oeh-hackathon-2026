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
- Use tags: `office`, `study`, `development`, `pass_on` (shown as "Give to a friend"), and `gaming`. The default is `office`. (Fifth amendment: `general` is added and is the default, see FR-023.)
- A mock API with sample data, and a live API client selected by an environment variable.
- English text. Laptop screens only.
- *(amendment 2026-11-20)* The landing button reads "Download and Scan now".
- *(amendment 2026-11-20)* Path tags (Overview, Upgrade, Repair, Pass on, Salvage, Recycle) next to the Use dropdown. Selecting a path shows that path's single steps as blocks in the style of the path cards.
- *(amendment 2026-11-20, second)* A path tag shows the individual actions of that path (for example the SSD, RAM, CPU, and graphics upgrades), each with its own CO₂e figures and its own steps when opened. The toolbar lines up with the two result columns, and the Use dropdown has a larger chevron.

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
- **FR-011** *(clarified 2026-11-20)*: `/d/:deviceId` loads the result screen directly. An unknown device ID, or a `/d/…` link whose ID is malformed, shows "We could not find this scan" and a way back to the home page. Any other path shows a "Page not found" screen. *(Originally a malformed `/d/…` link fell under "any other path".)*
- **FR-012:** Mock mode is the default. It labels the landing page "Sample data" and simulates the scanner steps, the assessment, and the report with short delays. Live mode, selected with `VITE_API_MODE=live`, calls the routes in `shared/src/api.ts` and the session routes in `DESIGN.md`.
- **FR-013:** Colors, type, and spacing follow [`docs/VISUAL_DESIGN.md`](../../VISUAL_DESIGN.md). Text blocks stay short: card summaries are one sentence and no panel needs scrolling to read its main message at 1440 × 900.

- **FR-014** *(amendment 2026-11-20)*: The primary button on the landing page is labelled "Download and Scan now". Its behavior is unchanged (FR-002). This replaces the label "Scan now" used in FR-001 and FR-002; those requirements otherwise stay in force.
- **FR-015** *(amendment 2026-11-20)*: The toolbar shows the path tags Overview, Upgrade, Repair, Pass on, Salvage, and Recycle next to the Use dropdown. Overview is selected at first and shows the five path cards (FR-005, FR-006). Selecting a path tag replaces the cards in the left column with that path's header (rank, name, status, reason, cost, extra life, score) followed by one block per step, numbered in order, and a "Why" block with the source link and the points that could not be verified. While the report is loading, the step blocks show placeholders; if a path has no steps, the column says so. Selecting a path tag also selects that path for the gauge (FR-007). Changing the Use dropdown or the priority toggle keeps the selected tag. *(Second amendment 2026-11-20: for paths that deliver options, FR-017 replaces the step blocks described here; this requirement stays in force as the fallback when no options arrive.)*
- **FR-016** *(amendment 2026-11-20)*: The gauge arcs (value and likely range) follow the half-circle scale for every value from 0 to 100 %. This restates FR-007 after a defect fix: arcs above 50 % had been drawn around the wrong centre.
- **FR-017** *(amendment 2026-11-20, second)*: When a path tag is selected and the server has sent options for that path, the left column shows the path summary and then one card per option (for example SSD upgrade, RAM upgrade, CPU upgrade, Graphics upgrade). An option card looks like a path card in the overview: icon, name, status (Viable, Conditional, Not suitable), one-sentence reason, and the figures cost, extra life, and CO₂e added by the action. Opening a card shows "What to do" with its steps and a "Why" text with the points that could not be verified. Options are listed suitable first, then conditional, then not suitable; options that are not suitable carry a reason and no figures. The gauge follows the option the user last opened and shows the share of a new laptop's production CO₂e that this option avoids; before any option is opened, it shows the path. While the report is loading the column shows placeholders. If the server sends no options for a path, FR-015 applies.
- **FR-018** *(amendment 2026-11-20, second)*: The toolbar uses the same two columns as the result screen. The Use dropdown and the path tags fill the left column, so the tag bar ends exactly where the cards end, and the priority toggle fills the right column. The Use dropdown shows a chevron that is clearly visible and sits close to the text.
- **FR-019** *(amendment 2026-11-20, third)*: Every screen ends with a footer line "Questions? contact@leaaf.green" where the address is a `mailto:` link. In the page header of the screens after the landing page, the wordmark next to the logo is written in capital letters (LEAAF); the large wordmark on the landing page keeps its lowercase spelling.
- **FR-020** *(amendment 2026-11-20, fourth)*: The wordmark "leaaf" is written in lowercase everywhere, including the page header. This replaces the capital-letter sentence of FR-019; the contact footer of FR-019 stays.
- **FR-021** *(amendment 2026-11-20, fourth)*: The Use dropdown offers a sixth tag, `general` (label "General"), listed first, for an everyday computer without a specific purpose. The default stays `office`. This extends the list in FR-009; `general` is not yet part of `INTENDED_USES` in `shared/src/common.ts` and has to be added by the backend team like `gaming`.
- **FR-022** *(amendment 2026-11-20, fourth)*: In a path tab, the block that summarizes the path above its options is visibly not clickable: a flat, light-green block without shadow and chevron, followed by the hint "Select an action to see its steps." The option cards below keep the white card style with a chevron. The same flat block heads the fallback steps view (FR-015).
- **FR-023** *(amendment 2026-11-20, fifth)*: The Use dropdown starts on `general` instead of `office`. This replaces the default named in FR-009 and FR-021 ("the default stays `office`"); the list and order of tags are unchanged. The backend does not evaluate the use tags yet, so the choice has no effect on the ranking there; the tag is only sent along in live mode.
- **FR-024** *(amendment 2026-11-20, sixth)*: The logo is a terminal-style wordmark in a monospace font: a prompt `>`, the lowercase name "leaaf", and a green underscore cursor that pulses. It replaces the leaf icon tile plus wordmark on the landing page (large) and in the page header (compact). On hover, the cursor stops pulsing and the prompt turns green and moves 2 px to the right. The pulse and the movement are skipped when the system asks for reduced motion. Screen readers read only "leaaf". This changes the logo part of FR-001 and keeps FR-020 (lowercase).
- **FR-025** *(amendment 2026-11-20, seventh)*: The logo is the lowercase wordmark "leaaf" in the dark text color followed by ".green" in the brand green and a smaller size, in the page font with heavy weight and tight tracking. It is large on the landing page and slightly smaller in the page header, has no icon, and has no animation or hover effect. This replaces the terminal-style logo of FR-024 in full; FR-020 (lowercase) stays.
- **FR-026** *(amendment 2026-11-20, eighth)*: While the scan runs, a card "Found so far" lists each hardware part as the scanner finds it (processor, memory, graphics, storage, battery), with the value read. Each part then shows what the server learned about it: "Parts list" when it matched the team's parts list, "AI search · check" when an AI web search found it, "No match", or "Looking up…" while pending, plus one short sentence and, for AI findings, a source link. The card sits at the top of the right column. The parts and lookups come from a proposed `part` session event (DESIGN.md); mock mode shows fictional sample lookups.
- **FR-027** *(amendment 2026-11-20, eighth)*: The parts card has an optional laptop view: a small schematic laptop whose zones (CPU, GPU, RAM, drive, battery) turn green as parts are found and pulse while they are read. It is hidden by default, opened with "Show laptop view", and the choice is remembered in the browser.
- **FR-028** *(amendment 2026-11-20, eighth)*: When the ranking changes (priority toggle or use tag), the path cards slide to their new places instead of jumping.
- **FR-029** *(amendment 2026-11-20, eighth)*: Numbers on the result screen (card figures, gauge percentage, equivalents) count up when they first appear and glide to new values when they change. The final value is the same as before; only the way it appears changes.
- **FR-030** *(amendment 2026-11-20, eighth)*: Under the gauge, the avoided CO₂e of the selected path or action is shown as everyday equivalents: kilometres by car and flights Vienna → London, as ranges ("up to" when the range starts at 0), with the source of the factors (Umweltbundesamt) linked. Nothing is shown when no CO₂e is credited. For conditional credit the note "Only if the receiver would otherwise buy new" is added.
- **FR-031** *(amendment 2026-11-20, eighth)*: An opened action card shows "Before → after" for each spec it changes (for example Storage 500 GB HDD → 500 GB SSD), when the server sends these changes (proposed optional `changes` field on the option, DESIGN.md).
- **FR-032** *(amendment 2026-11-20, eighth)*: Small motion details: cards lift slightly on hover, the highlight of the path tags and of the priority toggle slides to the chosen button, and new content (results, path tabs, opened cards, found parts) fades in. Every animation of FR-027 to FR-032 is off when the system asks for reduced motion.
- **FR-033** *(amendment 2026-11-20, ninth)*: The laptop view of the parts card (FR-027) is shown when the scan page opens. "Hide laptop view" still hides it, and the choice is remembered in the browser. This replaces "hidden by default" in FR-027.
- **FR-034** *(amendment 2026-11-20, ninth)*: Opened cards and the steps view no longer show the amber notes about points that could not be verified. This replaces "and the points that could not be verified" in FR-006 and removes the same notes on option cards (FR-017). The server may still send them (`unverified` in the report and on options); the page ignores them. The amber notice for a standard-text report (AI explanation unavailable) stays.

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

- **Backend team (resolved 2026-11-20):** The session routes, the events, and embedding the session ID as a trailer after the executable were decided with the user and implemented (see `DESIGN.md`). Consequence: each download has a different file hash, so SmartScreen cannot build reputation for the scanner.
- **Contract gap (options):** `shared/` delivers one combined result per path. For the upgrade path the sample impact adds the SSD and the RAM module together (60–110 €, 8–20 kg CO₂e added). There are no figures per single action, and none for CPU or graphics upgrades. The web app therefore shows options only when the server sends them (proposal in `DESIGN.md`) and uses clearly labelled sample data in mock mode.
- **Contract gap:** ~~`gaming` and `general` are missing in `shared/src/common.ts` (FR-009, FR-021).~~ Resolved 2026-11-20 by feature 003 FR-015. Storage fill level is not in `DeviceScan`, so the specs card cannot show "used space".
- **Contract gap:** the `part` session event and the optional `changes` field on options are proposals (FR-026, FR-031); the parts list (Excel) and the AI part search belong to the backend team.
- **Tooling (resolved 2026-11-20):** Dependencies could not be installed while the first version was written. They are installed now, and the type check, Vitest suite, and build pass (see `ACCEPTANCE_CRITERIA.md`).

## Review and integration

The completion boundary is a locally verified handoff with self-review, per the repository default. The change was prepared on the branch `feat/web-ui` and has been merged into `main` (b879a96) by the team; merging was not part of this feature's completion. Required checks once dependencies are installed: `npm run typecheck`, `npm test`, and `npm run build -w web`.

## Assumptions and open questions

- **Resolved (2026-11-20, user decision):** session ID format (26 Crockford base32 characters), the `LEAAFSCAN1:` trailer, and the session routes and events (`DESIGN.md`).
- **Resolved 2026-11-20:** `gaming` and `general` were added to `INTENDED_USES` and the scoring rubrics by feature 003's amendment (FR-015 to FR-018).
- **Non-blocking:** What "avoided CO₂e" means for a single option, for example the SSD upgrade alone, is a decision for the backend team (feature 003). The sample data credits each option the share of the avoided production that its extra life justifies.
- **Non-blocking:** The gauge definition (share of a new laptop's production CO₂e) was chosen by the team on 2026-11-20 and is easy to change.

## Scope change log

| Date       | Change                 | User approval                                                                                                                |
| ---------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Initial approved scope | User, in the planning conversation on 2026-11-20 ("accept und lets go, erstelle uns die Seite bitte"), after the design review |
| 2026-11-20 | Amendment: added FR-014 (button label "Download and Scan now"), FR-015 (path tags and step blocks), FR-016 (gauge arc defect fix), AC-015 to AC-017, and T-011 to T-013. Existing requirements and exclusions are unchanged. | User, 2026-11-20, 16:18 Vienna time ("bug fixing next: Das Tacho ist überall kaputt … Download and Scan now … neues feature … tags repair, upgrade") |
| 2026-11-20 | Second amendment: added FR-017 (individual actions per path as option cards, replacing the step blocks of FR-015 where options exist), FR-018 (toolbar alignment and dropdown chevron), AC-018 to AC-020, and T-014 to T-016. Existing requirements and exclusions are unchanged. | User, 2026-11-20, 16:53 Vienna time ("Der Plan war dass … nicht die einzelnen steps … sondern die einzelnen upgrades die alle ihren eigenen co2 score haben … Probiers mal so bitte") |
| 2026-11-20 | Third amendment: added FR-019 (contact address in a footer on every screen, capital-letter wordmark in the page header), AC-021, and T-017. Existing requirements and exclusions are unchanged. | User, 2026-11-20, 17:02 Vienna time ("wir haben noch eine mail adresse: contact@leaaf.green … oben neben dem logo das leaaf groß schreiben"), clarified as capital letters in the follow-up question |
| 2026-11-20 | Fourth amendment: added FR-020 (lowercase wordmark everywhere, replacing the capital-letter part of FR-019), FR-021 (`general` use tag), FR-022 (non-clickable path summary block in path tabs), AC-022 to AC-024, and T-018 to T-020. The scan button spacing was a visual fix and needs no requirement. Existing requirements and exclusions are unchanged. | User, 2026-11-20, 17:20 Vienna time ("mach leaaf doch wieder kleingeschrieben … scan button … general tag … oberstes item … anders aussieht") |
| 2026-11-20 | Fifth amendment: added FR-023 (`general` is the default use tag, replacing `office` as default), AC-025, and T-021. The list of tags is unchanged. Existing requirements and exclusions are unchanged. | User, 2026-11-20, 17:24 Vienna time ("das backend nutzt noch nicht die tags … füge den general tag hinzu und mache ihn den standard wert statt office") |
| 2026-11-20 | Sixth amendment: added FR-024 (terminal-style logo with pulsing cursor and hover effect, replacing the leaf icon tile plus wordmark), AC-026, and T-022. Existing requirements and exclusions are unchanged. | User, 2026-11-20, 17:34 Vienna time (code snippet "> leaaf_" with the request to add it and look at it) |
| 2026-11-20 | Seventh amendment: added FR-025 (wordmark "leaaf.green" with green ".green", replacing the terminal-style logo of FR-024), AC-027, and T-023. The extra space under the scan button on the landing page was a visual fix and needs no requirement. Existing requirements and exclusions are unchanged. | User, 2026-11-20, 17:38 Vienna time ("das code logo ist ganz falsch … hier ein anderer code") |
| 2026-11-20 | Eighth amendment: added FR-026 (live parts list during the scan), FR-027 (optional laptop view), FR-028 (animated reordering), FR-029 (counting numbers), FR-030 (CO₂e equivalents), FR-031 (before/after on action cards), FR-032 (motion details), AC-028 to AC-034, and T-024 to T-030. The arrow cursor on the landing page logo was a visual fix and needs no requirement. Existing requirements and exclusions are unchanged. | User, 2026-11-20, 17:47 Vienna time ("Live hardware liste … Laptop grafik … optional … animiertes umsortieren ja … hochzählende zahlen ja … Co2 greifbar machen … vorher nachher ja … kleine feinheiten ja") |
| 2026-11-20 | Ninth amendment: added FR-033 (laptop view shown by default, replacing "hidden by default" in FR-027), FR-034 (no "could not be verified" notes on cards, replacing that part of FR-006), AC-035, AC-036, and T-031. Existing requirements and exclusions are unchanged. | User, 2026-11-20, 18:08 Vienna time ("du kannst die laptop view doch standardmäßig anzeigen lassen … die texte bruachts echt nicht, die kann man rausnehmen") |
| 2026-11-20 | Clarification of FR-011: a malformed `/d/…` link shows "We could not find this scan" like an unknown ID, to meet feature 001 FR-011/AC-010 ("device not found" for both). AC-011 updated. | User chose "Device wording for /d/" when asked about feature 001 AC-010, 2026-11-20 |

## Related and superseded features

This feature builds the web surface that features 001, 003, and 004 describe and reuses their contracts unchanged. Requirement IDs are local to each feature.

**Implemented here (no change in intent):**

- `feature-001-device-scan-and-upload` / FR-010, FR-011, FR-012 (device page, not-found page, landing page and download), task T-008. *(2026-11-20: feature 001 FR-010 was narrowed from "all scanned fields" to this feature's FR-010 field set, so the specs card is now its effective contract.)*
- `feature-003-five-path-ranking` / FR-001 (picker), FR-012 (ranked view), and the Environment first / Money first toggle.
- `feature-004-explained-report` / FR-001, FR-003 (cards with Recommended label, reason, expandable details).

**Replacement history and effective behavior**

- `feature-001-device-scan-and-upload` / FR-009 (scanner opens the device page in the default browser): replaced by FR-002 to FR-004 here **for downloads that carry a session**. The browser tab is opened before the download, and the scanner reports progress and the final device ID to it. A download without a session (or a dev build) keeps FR-009 unchanged. Implemented 2026-11-20 on the branch `feat/device-scan-and-upload` (commit "feat(sessions): link scanner runs to the browser tab") and merged into `main` the same day, so it is effective. *(2026-11-20: feature 001 later revised FR-009 itself. The scanner now never opens the browser and offers a **Show my results** button in its window instead. It sends session events only after the user presses **Start scan**. FR-002 to FR-004 here are unchanged.)*
- `feature-003-five-path-ranking` / FR-001 (four options, ranking only after a choice): planned to be replaced by FR-008 and FR-009 here (five options including `gaming`, default `office`, ranking shown at once). Feature 003's amendment of 2026-11-20 (FR-015 to FR-018) adds `general` and `gaming` to the contract and their assessment rules; implemented 2026-11-20 on `main`, so this replacement is effective, and the live client now sends all six tags to a server that assesses them.
- `feature-004-explained-report` / FR-002 (impact summary above the cards) and FR-003 (sections Evidence, Assumptions, Safety and feasibility): planned to be replaced by the gauge (FR-007) and the shorter card (FR-006). Feature 004 subsequently implemented a compact impact summary and disclosed evidence alongside this layout. Its requirements remain effective at the local handoff.
- `feature-004-explained-report` / Responsiveness (readable at 360 px): originally planned to be dropped for the laptop-only version. On 2026-11-20 the user explicitly allowed responsive report styling. Feature 004 verified the result journey at 360 px.

When a replacement is implemented and merged, record the date and implementing commit here and add a reciprocal note to the earlier plans, as described in `docs/workflow/CHANGE_HISTORY.md`.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Design and proposed session events: [`DESIGN.md`](./DESIGN.md)
- Shared visual conventions: [`docs/VISUAL_DESIGN.md`](../../VISUAL_DESIGN.md)
- Contracts: [`shared/src/api.ts`](../../../shared/src/api.ts), [`shared/src/assessment.ts`](../../../shared/src/assessment.ts), [`shared/src/report.ts`](../../../shared/src/report.ts)
