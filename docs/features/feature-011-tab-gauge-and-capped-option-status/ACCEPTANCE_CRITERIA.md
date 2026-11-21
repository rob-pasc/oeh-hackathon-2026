# Acceptance Criteria: Gauge follows the tab, and option statuses capped by the rules

- **Feature ID:** `feature-011-tab-gauge-and-capped-option-status`
- **Verification status:** Verified locally

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001      | Given the Overview with no option opened, when the owner selects a category tab, then the gauge title and value are those of that category's best option. | Component test of the result screen | Pass | 2026-11-21 @ 3d3dd74 + working tree: `app.test.tsx` "moves the gauge with the selected tab and remembers the option opened in each tab" passes; it fails against the previous `ResultsView` (checked by stashing the component change). |
| AC-002 | FR-001      | Given an option opened in a category tab, when the owner switches to another tab and back, then the gauge shows the option opened in that tab again. | Component test of the result screen | Pass | 2026-11-21 @ 3d3dd74 + working tree: `app.test.tsx` "moves the gauge with the selected tab and remembers the option opened in each tab" passes; it fails against the previous `ResultsView` (checked by stashing the component change). |
| AC-003 | FR-002      | Opening an option in any tab moves the gauge to that option. | Component test of the result screen | Pass | 2026-11-21 @ 3d3dd74 + working tree: `app.test.tsx` "moves the gauge with the selected tab and remembers the option opened in each tab" passes; it fails against the previous `ResultsView` (checked by stashing the component change). |
| AC-004 | FR-003      | Given no option was opened on the Overview, when the owner returns to Overview from a category tab, then the gauge shows the best option of the first category; given one was, it shows that option. | Component test of the result screen | Pass | 2026-11-21 @ 3d3dd74 + working tree: `app.test.tsx` "moves the gauge with the selected tab and remembers the option opened in each tab" passes; it fails against the previous `ResultsView` (checked by stashing the component change). |
| AC-005 | FR-004      | Given an AI option of kind `ssd` marked `viable` and an `upgrade` gate that is `conditional`, the finished option is `conditional`; with a `viable` gate it stays `viable`; an AI `conditional` option with a `viable` gate stays `conditional`. | Server unit test | Pass | 2026-11-21 @ de28363 + working tree: `categories.test.ts` "lowers a Good fit SSD option…" and "never raises an option…" pass; server suite 326/326. |
| AC-006 | FR-004      | Given an AI option of kind `battery` marked `viable` on a desktop (repair gate `not_suitable`), the finished option is `not_suitable`. Options of kind `hand_down`, `salvage`, `recycle` and `other` keep the AI's status. | Server unit test | Pass | 2026-11-21 @ de28363 + working tree: `categories.test.ts` "makes a battery option Not a fit on a desktop…" pass; server suite 326/326. |
| AC-007 | FR-005      | A lowered option carries the gate's first limiting reason instead of the AI's; a `not_suitable` result has no figures and no score. | Server unit test | Pass | 2026-11-21 @ de28363 + working tree: `categories.test.ts` "makes a battery option Not a fit…" and "replaces the reason of a lowered option…" pass; server suite 326/326. |
| AC-008 | FR-006      | A cached AI answer that rated an `ssd` option `viable` is served capped (`conditional` with a `conditional` gate), and no provider call is made. | Server unit test with the fake provider | Pass | 2026-11-21 @ de28363 + working tree: `categories.test.ts` "caps a cached answer as well, without another call" pass; server suite 326/326. |
| AC-009 | FR-004, FR-005 | The gaming scan of the tested mini PC (4 GB DDR3, i3-5005U, no recognized graphics) with an AI answer rating the SSD option `viable` yields no Good fit SSD option, so it cannot be Recommended. | Server test with a fixture derived from the scan | Pass | 2026-11-21 @ de28363 + working tree: `categories.test.ts` "does not recommend an SSD upgrade for gaming on the tested 4 GB / i3 mini PC" pass; server suite 326/326. |
| AC-010 | Review      | Self-review of the final diff against this plan, with findings and their resolution recorded below; `npm run typecheck`, `npm test` and `npm run build` pass. | Recorded self-review and check output | Pass | 2026-11-21 @ 3d3dd74 + working tree: self-review below; `npm run typecheck` passes, `npm test` passes (shared 117, server 326, web 118 on rerun), `npm run build` passes. |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review (see the [plan](./PLAN.md#review-and-integration)).

**2026-11-21, self-review (Claude; not an independent review).** Reviewed `git diff de28363` of `server/src`, `web/src` and the tests, plus the documentation changes, against FR-001 to FR-006 and the exclusions.

- Only `ssd`, `ram` and `battery` are capped; `hand_down`, `salvage`, `recycle` and `other` keep the AI's status (exclusion respected, AC-006).
- The cap never raises a status (`atMost`), and a `not_suitable` result goes through the existing unscored branch, so it has no figures and no score.
- The cap runs in `finishOption`, which both fresh and cached answers pass through; the fallback path is unaffected because it already uses the gate statuses.
- Web: closing an opened option keeps it as the tab's gauge option, as before ("last opened"). A tab's opened option that disappears after a use or mode change falls back to the category's best option. The five-path view without categories is unchanged.
- Finding (non-blocking, not fixed): FR-005 originally said "first reason"; the first gate reason is often enabling, so the implementation uses the first limiting reason. FR-005 and AC-007 were clarified accordingly (scope change log).
- Finding (non-blocking, outside scope): `steps.test.tsx` "shows the template plan with its notice for a fallback option" failed once in a full `npm test` run and passed in three isolated runs and two further full web runs; it looks like a timing flake (default 1 s `findBy` timeout under load), not related to this change.

No blocking findings. Push, merge and release are outside the boundary and were not done.

## Verification notes

**2026-11-21, server cap (T-001).** `npx vitest run` in `server/`: 326 passed; `npm run typecheck -w server` passes. Mutation check: with `capDraft` bypassed, the five tests for AC-005 to AC-009 that expect a lowered status fail ("never raises…" passes either way, as expected). The shared category fixture is unchanged because the sample answer already agrees with the office gates.

**2026-11-21, gauge (T-002) and close-out.** `npm run typecheck`, `npm test` and `npm run build` from the repository root. The first full `npm test` had one failure in `steps.test.tsx` (see the self-review); the web suite then passed 118/118 twice. No browser check; the gauge behaviour is covered by the component test and joins the team browser review of feature 006 (T-009).
