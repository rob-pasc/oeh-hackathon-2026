# Acceptance Criteria: One step list for the plan

- **Feature ID:** `feature-014-plan-step-list`
- **Verification status:** Not started

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001      | Opening the plan card requests its step list once; reopening and reloading make no new provider call; a plan with different steps or order makes its own call. | Server tests with the fake provider, component test | Not run | |
| AC-002 | FR-002      | A plan list of up to 16 steps is accepted and shown numbered with tools, parts, time, safety flags and sources; 17 steps are rejected; single-option plans still allow at most 12. | Shared contract tests, component test | Not run | |
| AC-003 | FR-003      | The plan step request contains the scan, use, the plan's steps in order, the facts and the passages of every option in the plan, and the prompt asks to name shared steps once. | Server unit test | Not run | |
| AC-004 | FR-004      | Unknown citations and uncited technical steps are removed, an empty result shows the empty-plan message, and an answer with a euro or CO₂e figure is rejected. | Server unit tests | Not run | |
| AC-005 | FR-005      | While the list loads, the card shows the thinking line and step placeholders. | Component test | Not run | |
| AC-006 | FR-006      | With the AI unavailable, and for the fallback plan, the card shows the steps' template plans in order without repeated titles, at most 16 steps, with the notice. | Server unit test, component test | Not run | |
| AC-007 | FR-007      | Mock mode shows a sample step list for the sample plan. | Component test in mock mode | Not run | |
| AC-008 | FR-002–FR-004 | Live check with the configured provider on the plans of the three demo models: each list follows the plan's order, names shared steps once, and has no hazardous owner work. | Live run, results recorded | Not run | |
| AC-009 | Review      | Self-review of the final diff against this plan with findings recorded; `npm run typecheck`, `npm test` and `npm run build` pass. | Recorded self-review and check output | Not run | |

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
