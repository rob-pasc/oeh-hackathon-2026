# Acceptance Criteria: AI categories and options

- **Feature ID:** `feature-007-ai-categories-and-options`
- **Verification status:** Not started

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement    | Scenario / expected outcome                                                                                                                                                                                  | Verification method                                              | Result  | Evidence |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ------- | -------- |
| AC-001 | FR-001, FR-002 | Given a fake provider answer with 4 categories and valid options, the `categories` result contains those 4 categories with their labels, summaries and options; an answer with 2 or 7 categories, or an option missing its kind or difficulty, is treated as invalid. | Automated server test with the fake LLM provider                 | Not run | —        |
| AC-002 | FR-002         | An option with status `not_suitable` is delivered with its reason and without figures or a score, even if the provider sent figures for it.                                                                   | Automated server test                                            | Not run | —        |
| AC-003 | FR-003         | An option of kind `ssd` on the example laptop gets the same cost, extra-life and CO₂e ranges as the calculator computes for the SSD part, with impact references, marked as calculator figures.                | Automated server test                                            | Not run | —        |
| AC-004 | FR-004         | An option of kind `other` with valid ranges keeps them, marked as AI estimates; with `low > high` or a negative cost it has no figures and no score, and the other options are unaffected.                    | Automated server test                                            | Not run | —        |
| AC-005 | FR-005         | Environment, useful life and economic scores of an option equal the rubric results for its figures; feasibility equals the fixed value for its difficulty; an AI-estimated option has at most medium confidence with a reason naming the estimate. | Automated test of the scoring functions                          | Not run | —        |
| AC-006 | FR-006         | Given categories whose best options are Good fit, Depends and Not a fit, the Overview lists them in that order, by score within each group, and the Not a fit category has no score.                         | Automated test of the shared ranking functions; component test  | Not run | —        |
| AC-007 | FR-007         | The first category carries Recommended only when it has a Good fit option; with no Good fit option anywhere, no label appears and the Overview states that no option is clearly recommended.                  | Automated component test                                         | Not run | —        |
| AC-008 | FR-008         | Switching the priority toggle re-orders categories and options without a network request or new AI call.                                                                                                     | Automated component test (no request recorded); browser check    | Not run | —        |
| AC-009 | FR-009         | The toolbar shows Overview plus one tab per category with the AI's labels in Overview order; selecting a tab shows the non-clickable header and the option cards sorted Good fit, Depends, Not a fit.          | Automated component test; browser check at 1440 × 900 and 1280 × 720 | Not run | —        |
| AC-010 | FR-010         | An option card shows title, status, reason, figures and score; an AI-estimated option shows "AI estimate" on the card and on the gauge; opening a card shows the Why text and at most two source links.        | Automated component test; browser check                          | Not run | —        |
| AC-011 | FR-011         | Before any option is opened, the gauge shows the best option of the first category; after opening an option, it shows that option.                                                                            | Automated component test                                         | Not run | —        |
| AC-012 | FR-012         | The category request sent to the provider contains the scan, intended use, assessment, facts and passages, and the system prompt contains the four safety rules; claims citing unknown passage IDs are removed; text with a euro or CO₂e figure is rejected. | Automated server test inspecting the request built for the fake provider | Not run | —        |
| AC-013 | FR-013         | With no API key, with a provider error, and with a timeout, the result screen shows five categories (one per path) with the assessment's figures and scores and the notice "AI explanation unavailable".      | Automated server tests for the three failure cases; component test | Not run | —        |
| AC-014 | FR-014         | Opening the same device and intended use twice, or switching modes, makes exactly one category call; changing the prompt version makes a new one.                                                             | Automated server test counting fake provider calls               | Not run | —        |
| AC-015 | FR-015         | With no backend, `npm run dev -w web` shows the sample categories for the example laptop, including an "AI estimate" option and a Not a fit option.                                                          | Automated component test in mock mode; browser check             | Not run | —        |
| AC-016 | FR-012         | Demo review with the live provider on the three demo models (T480, XPS 13 9360, EliteBook 840 G5) for office use: no option asks the owner to do hazardous battery work, and the XPS 13 9360 has no RAM option that is a fit. Findings recorded either way. | Manual review of live output, recorded below                     | Not run | —        |
| AC-017 | —              | Self-review of the final diff against this plan, with findings and their resolution recorded; typecheck, tests and build pass.                                                                                | Self-review; `npm run typecheck`, `npm test`, `npm run build`    | Not run | —        |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

If a later feature supersedes this behavior, preserve these criteria, results, and evidence as historical records. Add a dated note under verification notes identifying the affected IDs and linking to the replacement feature's plan and acceptance criteria document. See the supersession rules in `docs/workflow/CHANGE_HISTORY.md`.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review ([plan](./PLAN.md#review-and-integration)). AC-016 depends on a configured `LLM_API_KEY` and is a review of live output, not a guarantee, because safety is enforced in the prompt only. No review has been performed yet.

## Verification notes

Not yet verified.
