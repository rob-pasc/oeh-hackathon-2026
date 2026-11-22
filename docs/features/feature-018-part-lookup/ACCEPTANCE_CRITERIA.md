# Acceptance Criteria: Part lookup

- **Feature ID:** `feature-018-part-lookup`
- **Verification status:** Not started

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001      | Given an uploaded scan with a CPU named in the corpus, when the lookup runs, then the CPU is found in the corpus and no web search is made for it. | Automated test with the test corpus and a fake provider | Not run | |
| AC-002 | FR-002      | Given a drive not named in the corpus, when the lookup runs, then exactly one web search is made, its query contains only the drive identifier, and the cap and fallback rules of feature 017 apply. | Automated test with fake providers | Not run | |
| AC-003 | FR-003      | Given the LLM returns a sentence for a part without a valid citation, then that part reads "No match"; cited sentences are kept; one LLM call is made per device. | Automated test with a fake LLM | Not run | |
| AC-004 | FR-004      | Given lookups for all four outcomes, when the result screen shows the scan specs, then each part shows the right badge, and parts with a sentence show it with a working source link. | Automated component test; browser check in mock mode | Not run | |
| AC-005 | FR-005      | Given a lookup that times out, then the rest of the result screen is shown without waiting and the affected parts read "No match". | Automated test | Not run | |
| AC-006 | FR-006      | Given a second device with the same CPU within 30 days, then no new search or LLM call is made for the CPU. | Automated test with a controlled clock | Not run | |
| AC-007 | FR-007      | Without an LLM key, the scan specs equal those before this feature; without search keys, only corpus lookups run. | Automated test | Not run | |
| AC-008 | FR-008      | In mock mode, the result screen shows sample lookups with all four badges. | Browser check in mock mode | Not run | |
| AC-009 | FR-009      | The privacy notice (DE/EN) says that part names, and no other scan data, go to the search providers. | Read both texts in the browser | Not run | |
| AC-010 | All         | A live lookup with the team's keys returns at least one Web search · check result for a part outside the corpus. | Live smoke run, output recorded | Not run | |
| AC-011 | All         | Typecheck, tests and build pass locally, CI passes on the `main` push, and a self-review is recorded with findings and resolutions. | Commands; CI link; review record below | Not run | |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified, merged into `main`, live smoke run (see the [plan](./PLAN.md#review-and-integration)). No review performed yet.

## Verification notes

Not yet verified.
