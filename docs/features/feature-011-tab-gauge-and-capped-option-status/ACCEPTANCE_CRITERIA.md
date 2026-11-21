# Acceptance Criteria: Gauge follows the tab, and option statuses capped by the rules

- **Feature ID:** `feature-011-tab-gauge-and-capped-option-status`
- **Verification status:** Not started

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001      | Given the Overview with no option opened, when the owner selects a category tab, then the gauge title and value are those of that category's best option. | Component test of the result screen | Not run | |
| AC-002 | FR-001      | Given an option opened in a category tab, when the owner switches to another tab and back, then the gauge shows the option opened in that tab again. | Component test of the result screen | Not run | |
| AC-003 | FR-002      | Opening an option in any tab moves the gauge to that option. | Component test of the result screen | Not run | |
| AC-004 | FR-003      | Given no option was opened on the Overview, when the owner returns to Overview from a category tab, then the gauge shows the best option of the first category; given one was, it shows that option. | Component test of the result screen | Not run | |
| AC-005 | FR-004      | Given an AI option of kind `ssd` marked `viable` and an `upgrade` gate that is `conditional`, the finished option is `conditional`; with a `viable` gate it stays `viable`; an AI `conditional` option with a `viable` gate stays `conditional`. | Server unit test | Not run | |
| AC-006 | FR-004      | Given an AI option of kind `battery` marked `viable` on a desktop (repair gate `not_suitable`), the finished option is `not_suitable`. Options of kind `hand_down`, `salvage`, `recycle` and `other` keep the AI's status. | Server unit test | Not run | |
| AC-007 | FR-005      | A lowered option carries the gate's first reason instead of the AI's; a `not_suitable` result has no figures and no score. | Server unit test | Not run | |
| AC-008 | FR-006      | A cached AI answer that rated an `ssd` option `viable` is served capped (`conditional` with a `conditional` gate), and no provider call is made. | Server unit test with the fake provider | Not run | |
| AC-009 | FR-004, FR-005 | The gaming scan of the tested mini PC (4 GB DDR3, i3-5005U, no recognized graphics) with an AI answer rating the SSD option `viable` yields no Good fit SSD option, so it cannot be Recommended. | Server test with a fixture derived from the scan | Not run | |
| AC-010 | Review      | Self-review of the final diff against this plan, with findings and their resolution recorded below; `npm run typecheck`, `npm test` and `npm run build` pass. | Recorded self-review and check output | Not run | |

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
