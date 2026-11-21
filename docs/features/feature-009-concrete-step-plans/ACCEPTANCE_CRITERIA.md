# Acceptance Criteria: Concrete step plans

- **Feature ID:** `feature-009-concrete-step-plans`
- **Verification status:** Not started

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome                                                                                                                                                                         | Verification method                                           | Result  | Evidence |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------- | -------- |
| AC-001 | FR-001      | Opening the same option twice, reloading, and switching modes makes exactly one step call; a changed prompt version makes a new one.                                                                  | Automated server test counting fake provider calls            | Not run | —        |
| AC-002 | FR-002      | A valid answer with 4 steps is shown as 4 numbered blocks with title and detail; an answer with 0 or 13 steps, or a title over 80 characters, is treated as invalid.                                  | Automated server test; component test                         | Not run | —        |
| AC-003 | FR-003      | A step with tools, parts and a 10–15 minute range shows all three; a step without them shows none of these lines.                                                                                    | Automated component test                                      | Not run | —        |
| AC-004 | FR-004      | A `caution` step shows its warning sentence; a `professional` step shows "Professional only" and its detail names a service provider; the flag is part of the accessible text.                         | Automated component test                                      | Not run | —        |
| AC-005 | FR-005      | Given an answer with a technical step citing only an unknown passage ID, a technical step without citations, and a general step without citations, the plan keeps only the general step.             | Automated server test                                         | Not run | —        |
| AC-006 | FR-006      | When every step is removed, the card shows "No verified steps for this option yet. Ask a service provider to confirm it."                                                                            | Automated server and component test                           | Not run | —        |
| AC-007 | FR-007      | A step citing a passage shows a link with the document title that opens the source URL in a new tab.                                                                                                | Automated component test                                      | Not run | —        |
| AC-008 | FR-008      | An answer whose step text contains "€40" or "25 kg CO₂e" is rejected.                                                                                                                               | Automated server test                                         | Not run | —        |
| AC-009 | FR-009      | The step request sent to the provider contains the scan, intended use, option, facts and the passages retrieved for the option; its system prompt contains the "do x, not you could" instruction and the safety rules. | Automated server test inspecting the request built for the fake provider | Not run | —        |
| AC-010 | FR-010      | While the plan loads, the opened card shows the thinking line above the step placeholders, which disappear when the plan arrives.                                                                   | Automated component test                                      | Not run | —        |
| AC-011 | FR-011      | With no API key, a provider error, and a timeout, the card shows the template plan for the option's kind and "AI steps unavailable"; every template technical step cites a passage or is `professional`. | Automated server tests for the three cases; a test over all template plans | Not run | —        |
| AC-012 | FR-012      | In the fallback categories, opening an option shows its template plan without any provider call.                                                                                                     | Automated server test counting fake provider calls            | Not run | —        |
| AC-013 | FR-013      | In mock mode, every sample option opens a plan, and across the samples tools, parts, time, all three safety flags, and source links appear.                                                          | Automated test over the mock data; browser check              | Not run | —        |
| AC-014 | FR-002, FR-007 | In a browser at 1440 × 900 and 1280 × 720, an opened option shows readable numbered step blocks with their flags and source links.                                                                | Browser check                                                 | Not run | —        |
| AC-015 | FR-004, FR-005, FR-009 | Demo review with the live provider on the three demo models: each priced option's plan is concrete and ordered; internal battery work is `professional`; no technical step is disguised as `general`. Findings recorded either way. | Manual review of live output, recorded below                  | Not run | —        |
| AC-016 | —           | Self-review of the final diff against this plan, with findings and their resolution recorded; typecheck, tests and build pass.                                                                       | Self-review; `npm run typecheck`, `npm test`, `npm run build` | Not run | —        |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

If a later feature supersedes this behavior, preserve these criteria, results, and evidence as historical records. Add a dated note under verification notes identifying the affected IDs and linking to the replacement feature's plan and acceptance criteria document. See the supersession rules in `docs/workflow/CHANGE_HISTORY.md`.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review ([plan](./PLAN.md#review-and-integration)). AC-015 needs a configured `LLM_API_KEY` and is a review of live output, not a guarantee. No review has been performed yet.

## Verification notes

Not yet verified.
