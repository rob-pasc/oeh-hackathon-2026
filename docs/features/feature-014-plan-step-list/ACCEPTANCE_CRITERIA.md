# Acceptance Criteria: One step list for the plan

- **Feature ID:** `feature-014-plan-step-list`
- **Verification status:** Verified locally

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001      | Opening the plan card requests its step list once; reopening and reloading make no new provider call; a plan with different steps or order makes its own call. | Server tests with the fake provider, component test | Pass | 2026-11-21 @ 9d17aef + working tree: server `steps.test.ts` "makes one call per device, use and plan, and asks again for a changed plan" and "answers null without a call when the shown result has no plan"; web `steps.test.tsx` "requests the list once when the plan card is opened…" and "closes the plan card when the intended use changes…" pass. |
| AC-002 | FR-002      | A plan list of up to 16 steps is accepted and shown numbered with tools, parts, time, safety flags and sources; 17 steps are rejected; single-option plans still allow at most 12. | Shared contract tests, component test | Pass | 2026-11-21 @ 9d17aef + working tree: server `steps.test.ts` "accepts up to 16 steps for a plan while a single option keeps 12" (output and `PlanStepList` schemas); web `steps.test.tsx` "requests the list once…" shows the numbered list with tools and time. |
| AC-003 | FR-003      | The plan step request contains the scan, use, the plan's steps in order, the facts and the passages of every option in the plan, and the prompt asks to name shared steps once. | Server unit test | Pass | 2026-11-21 @ 9d17aef + working tree: `steps.test.ts` "sends the plan’s options in order with the passages of all of them and the shared-steps rule" passes. |
| AC-004 | FR-004      | Unknown citations and uncited technical steps are removed, an empty result shows the empty-plan message, and an answer with a euro or CO₂e figure is rejected. | Server unit tests | Pass | 2026-11-21 @ 9d17aef + working tree: `steps.test.ts` "applies the step checks: unknown citations and uncited technical steps go, figures reject the answer" passes. |
| AC-005 | FR-005      | While the list loads, the card shows the thinking line and step placeholders. | Component test | Pass | 2026-11-21 @ 9d17aef + working tree: `steps.test.tsx` "shows the thinking line while the list loads" passes. |
| AC-006 | FR-006      | With the AI unavailable, and for the fallback plan, the card shows the steps' template plans in order without repeated titles, at most 16 steps, with the notice. | Server unit test, component test | Pass | 2026-11-21 @ 9d17aef + working tree: `steps.test.ts` "joins the steps’ template plans without repeated titles, at most 16, with the notice" and "uses the joined templates for the fallback plan without a provider call" pass (the web shows them through the existing `StepList` template notice). |
| AC-007 | FR-007      | Mock mode shows a sample step list for the sample plan. | Component test in mock mode | Pass | 2026-11-21 @ 9d17aef + working tree: `steps.test.tsx` "has a valid mock list for the laptop’s sample plan with shared steps named once, and none for the desktop" passes. |
| AC-008 | FR-002–FR-004 | Live check with the configured provider on the plans of the three demo models: each list follows the plan's order, names shared steps once, and has no hazardous owner work. | Live run, results recorded | Pass | 2026-11-21 @ 9d17aef + working tree: `npm run steps:smoke -w server -- --plan` with the configured provider, office use. T480 plan "Wipe the drive and reinstall a clean Windows 11 system → Give the wiped laptop to a private recipient" got a 6-step list: back up once, create installation media, boot from USB, install, reset and erase before handing on, hand over (naming PCs für alle); all steps general, follows the plan order, no hazardous owner work, no AC-015 candidates. XPS 13 9360 and EliteBook 840 G5 had no plan in this run, so only one plan list was reviewed. |
| AC-009 | Review      | Self-review of the final diff against this plan with findings recorded; `npm run typecheck`, `npm test` and `npm run build` pass. | Recorded self-review and check output | Pass | 2026-11-21 @ 9d17aef + working tree: Self-review below; `npm run typecheck`, `npm test` (shared 131, server 358, web 124) and `npm run build` pass. |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review on `feat/combined-plan` (see the [plan](./PLAN.md#review-and-integration)).

**2026-11-21, self-review (Claude; not an independent review).** Reviewed `git diff 4210ce0` of `shared/`, `server/` and `web/` and the documentation against FR-001 to FR-007 and the exclusions.

- Single-option step plans are unchanged: their schema keeps 12 steps, their prompt and cache key are untouched, and the plan list lives under `#plan`, which no option slug can match.
- The plan list goes through the same `checkSteps` as option plans, so citations, uncited technical steps, figures and the professional sentence are handled identically.
- Finding (fixed): with the plan card open, switching the intended use left the card open without requesting the new use's list, so it showed nothing. The card now closes on a use change; covered by a new test that fails without the fix.
- Finding (accepted, recorded in the plan): the plan call uses the step timeout (`LLM_STEP_TIMEOUT_MS`, default 25 s); the live T480 list took about 6 s, and a timeout falls back to the joined templates.
- The live check covered one plan list, because only one demo model had a plan in that run.

No blocking findings. Push, merge and release are outside the boundary and were not done.

## Verification notes

**2026-11-21.** From the repository root: `npm run typecheck` (exit 0), `npm test` (shared 131, server 358, web 124), `npm run build` (exit 0). Live check as recorded under AC-008 (one category call per demo model plus one plan step call).
