# Acceptance Criteria: "Your plan" card, a combined top recommendation

- **Feature ID:** `feature-013-combined-plan-card`
- **Verification status:** Not started

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001, FR-002 | Given an AI answer with a plan of two or more Good fit option IDs, the result carries the plan with the steps in the AI's order; with a "Depends" step, an unknown or repeated option ID, or a single step, the result has no plan and the categories are unchanged. | Server unit tests | Not run | |
| AC-002 | FR-003      | A plan with a `salvage` or `recycle` step, two `hand_down` steps, or `hand_down` before the last step is dropped; "SSD → RAM → hand down" is kept. | Server unit tests | Not run | |
| AC-003 | FR-004      | An "SSD + RAM" plan has the same cost, own emissions and baseline credit as feature 003's combined upgrade plan for that device; a plan with a battery step adds the repair's cost and emissions; extra life equals the longest step range; the baseline is credited once. | Server unit tests against the calculator | Not run | |
| AC-004 | FR-005      | A plan ending in `hand_down` has `conditional` displacement and the recipient assumption. | Server unit test | Not run | |
| AC-005 | FR-006      | A plan with a step of kind `other` adds its AI ranges and is marked as an AI estimate. | Server unit test | Not run | |
| AC-006 | FR-007      | With a plan, the Overview shows "Your plan" above the summary and categories, with the summary, step titles in order, combined figures and no score; without a plan, no card appears. | Component tests of the result screen | Not run | |
| AC-007 | FR-008      | On the Overview, the gauge shows the plan (title "Your plan") when there is one, and the first category's best option otherwise; category tabs still follow feature 011. | Component tests of the result screen | Not run | |
| AC-008 | FR-009      | With the AI unavailable, a laptop whose upgrade (SSD and RAM) and battery repair are viable gets the fallback plan in the fixed order; a device with fewer than two viable steps gets none. | Server unit tests with the fake provider | Not run | |
| AC-009 | FR-010      | Mock mode shows a sample plan with an "AI estimate" label. | Component test in mock mode | Not run | |
| AC-010 | Contract    | The extended `CategoryResult` schema validates results with and without a plan, `checkCategoryResult` rejects a plan whose figures break the invariants, and the exported JSON Schemas are current. | Shared contract tests and schema export check | Not run | |
| AC-011 | FR-001–FR-003 | Live check with the configured provider on the three demo models (office use): each answer either has a plan that passes the checks and reads sensibly (steps in a workable order, no hazardous owner work) or has none. | `categories:smoke` or equivalent live run, results recorded | Not run | |
| AC-012 | Review      | Self-review of the final diff against this plan with findings recorded; `npm run typecheck`, `npm test` and `npm run build` pass. | Recorded self-review and check output | Not run | |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review on `feat/combined-plan` (see the [plan](./PLAN.md#review-and-integration)). No review performed yet.

## Verification notes

Not yet verified.
