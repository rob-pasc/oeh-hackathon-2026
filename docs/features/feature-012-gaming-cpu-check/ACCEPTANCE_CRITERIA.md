# Acceptance Criteria: Processor check for gaming

- **Feature ID:** `feature-012-gaming-cpu-check`
- **Verification status:** Not started

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001      | Given the tested mini PC's scan (i3-5005U, 2 cores, 4 threads) and `gaming`, the `upgrade` and `repair` gates are `not_suitable` and their reasons name the processor. | Server unit test | Not run | |
| AC-002 | FR-001      | Given a processor above the threshold and `gaming`, no processor reason appears and the statuses are those of the existing RAM and graphics rules. | Server unit test | Not run | |
| AC-003 | FR-002      | Given a scan with no CPU name, cores or threads and `gaming`, the gates are the same as without this feature. | Server unit test | Not run | |
| AC-004 | FR-003      | The mini PC scan with `office`, and pass it on, salvage and recycle with `gaming`, give the same statuses and reasons as before. | Server unit test | Not run | |
| AC-005 | FR-004      | The feature 003 DESIGN gate rules describe the processor rule and cite its source. | Document review | Not run | |
| AC-006 | Review      | Self-review of the final diff against this plan, with findings recorded below; `npm run typecheck`, `npm test` and `npm run build` pass. | Recorded self-review and check output | Not run | |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review (see the [plan](./PLAN.md#review-and-integration)). No review performed yet.

## Verification notes

Not yet verified.
