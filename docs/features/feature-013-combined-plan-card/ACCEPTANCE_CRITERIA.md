# Acceptance Criteria: "Your plan" card, a combined top recommendation

- **Feature ID:** `feature-013-combined-plan-card`
- **Verification status:** Verified locally

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001, FR-002 | Given an AI answer with a plan of two or more Good fit option IDs, the result carries the plan with the steps in the AI's order; with a "Depends" step, an unknown or repeated option ID, or a single step, the result has no plan and the categories are unchanged. | Server unit tests | Pass | 2026-11-21 @ ed06786 + working tree: `categories.test.ts` "keeps a plan of Good fit options in the AI’s order", "drops a plan with … (5 cases)" and "has no plan when the AI returns none" pass. |
| AC-002 | FR-003      | A plan with a `salvage` or `recycle` step, two `hand_down` steps, or `hand_down` before the last step is dropped; "SSD → RAM → hand down" is kept. | Server unit tests | Pass | 2026-11-21 @ ed06786 + working tree: `categories.test.ts` "drops a plan with … (4 cases)" and "keeps upgrade steps followed by handing the computer down" pass. |
| AC-003 | FR-004      | An "SSD + RAM" plan has the same cost, own emissions and baseline credit as feature 003's combined upgrade plan for that device; a plan with a battery step adds the repair's cost and emissions; extra life equals the longest step range; the baseline is credited once. | Server unit tests against the calculator | Pass | 2026-11-21 @ ed06786 + working tree: `categories.test.ts` "prices SSD and RAM steps exactly like the combined upgrade plan" and "adds a battery repair and credits the baseline once…" pass. |
| AC-004 | FR-005      | A plan ending in `hand_down` has `conditional` displacement and the recipient assumption. | Server unit test | Pass | 2026-11-21 @ ed06786 + working tree: `categories.test.ts` "prices a plan ending in hand_down like an upgrade for passing it on…" passes. |
| AC-005 | FR-006      | A plan with a step of kind `other` adds its AI ranges and is marked as an AI estimate. | Server unit test | Pass | 2026-11-21 @ ed06786 + working tree: `categories.test.ts` "adds an AI-estimated step’s ranges and marks the plan as an AI estimate" passes. |
| AC-006 | FR-007      | With a plan, the Overview shows "Your plan" above the summary and categories, with the summary, step titles in order, combined figures and no score; without a plan, no card appears. | Component tests of the result screen | Pass | 2026-11-21 @ ed06786 + working tree: `app.test.tsx` "shows \"Your plan\" above the summary with its steps in order, figures and no score" and "shows the plan on the Overview gauge, and the first category without a plan" pass. |
| AC-007 | FR-008      | On the Overview, the gauge shows the plan (title "Your plan") when there is one, and the first category's best option otherwise; category tabs still follow feature 011. | Component tests of the result screen | Pass | 2026-11-21 @ ed06786 + working tree: `app.test.tsx` "shows the plan on the Overview gauge, and the first category without a plan" and the updated feature 011 gauge test pass. |
| AC-008 | FR-009      | With the AI unavailable, a laptop whose upgrade (SSD and RAM) and battery repair are viable gets the fallback plan in the fixed order; a device with fewer than two viable steps gets none. | Server unit tests with the fake provider | Pass | 2026-11-21 @ ed06786 + working tree: `categories.test.ts` "builds the fallback plan from the gates in the fixed order, or none with fewer than two steps" passes. |
| AC-009 | FR-010      | Mock mode shows a sample plan with an "AI estimate" label. | Component test in mock mode | Pass | 2026-11-21 @ ed06786 + working tree: `app.test.tsx` "shows \"Your plan\"…" in mock mode, including the "AI estimate" label, passes. |
| AC-010 | Contract    | The extended `CategoryResult` schema validates results with and without a plan, `checkCategoryResult` rejects a plan whose figures break the invariants, and the exported JSON Schemas are current. | Shared contract tests and schema export check | Pass | 2026-11-21 @ ed06786 + working tree: `contracts.test.ts` "CategoryResult plan (feature 013 AC-010)" (with and without a plan, 4 schema rejections, 8 invariant cases) passes; `schemas.test.ts` confirms the exported schemas are current. |
| AC-011 | FR-001–FR-003 | Live check with the configured provider on the three demo models (office use): each answer either has a plan that passes the checks and reads sensibly (steps in a workable order, no hazardous owner work) or has none. | `categories:smoke` or equivalent live run, results recorded | Pass | 2026-11-21 @ ed06786 + working tree: `npm run categories:smoke -w server` with the configured provider, office use, two runs. Second run: T480 and XPS 13 9360 proposed plans that the server dropped because they included the professional battery replacement, which the feature 011 cap lowers to Depends; EliteBook 840 G5 got "Replace the worn battery with a matching HP spare → Reinstall Windows with a clean reset → Stay on Windows 10 with extended security updates → Erase data and give the laptop to a new owner" (battery step professional per the AC-016 check, which found no owner battery work), priced conditional. Workable order, no hazardous owner work. First run: all three dropped for the same reason or had none. |
| AC-012 | Review      | Self-review of the final diff against this plan with findings recorded; `npm run typecheck`, `npm test` and `npm run build` pass. | Recorded self-review and check output | Pass | 2026-11-21 @ ed06786 + working tree: Self-review below; `npm run typecheck`, `npm test` (shared 130, server 350, web 120) and `npm run build` pass. |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review on `feat/combined-plan` (see the [plan](./PLAN.md#review-and-integration)).

**2026-11-21, self-review (Claude; not an independent review).** Reviewed `git diff 66020e5` of `shared/`, `server/` and `web/` and the documentation against FR-001 to FR-010 and the exclusions.

- Plans are built only from the result's own options after the gate cap; salvage and recycle are rejected both when resolving and in `planProblems`, and `checkCategoryResult` re-checks the finished plan.
- The baseline is credited once (`avoided()` over the summed own emissions); alternatives and categories are never summed. The plan has no score.
- Finding (fixed): plan step list items were keyed by title; two AI options can share a title, so the key now includes the position.
- Finding (accepted, recorded in the plan's assumptions): an AI option of kind `other` that ends the owner's use (for example "Donate it to a charity", seen in the live run) is not detectable by kind and could join a plan; this relies on the prompt.
- Finding (observation, not a defect): in the live check two of three proposed plans were dropped because the AI included a battery replacement that needs a repair shop, which is Depends after the feature 011 cap. Plans may therefore appear rarely on devices with worn, non-user-replaceable batteries. Reported to the user; changing the drop rule (for example removing such steps instead of the whole plan) would change FR-002 and needs their approval.

No blocking findings. Push, merge and release are outside the boundary and were not done.

## Verification notes

**2026-11-21.** From the repository root: `npm run typecheck` (exit 0), `npm test` (shared 130, server 350, web 120), `npm run build` (exit 0). Live check as recorded under AC-011, with the provider configured in `server/.env`; each run made one fact extraction and one category call per demo model. The smoke script now prints each plan or why the server dropped it.
