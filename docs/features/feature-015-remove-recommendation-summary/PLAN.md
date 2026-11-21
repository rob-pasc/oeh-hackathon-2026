# Feature 015: Remove the recommendation summary

- **Feature ID:** `feature-015-remove-recommendation-summary`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-21

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

The Overview no longer shows the one-paragraph recommendation summary between the "Your plan" card and the category cards (for example "**System setup** · Reset the PC keeping personal files · €0 · +1–2 years · 85–200 kg CO₂e avoided (AI estimate). Baseline: The owner buys a comparable new laptop now."). The plan card, the category cards and the gauge already show the same figures, so the paragraph repeats them.

## Problem and desired outcome

- **Problem:** Below the plan card, the paragraph repeats figures shown on the cards and the gauge and makes the Overview longer.
- **Desired outcome:** The Overview goes straight from the plan card to the category cards.
- **Target users / stakeholders:** Owners reading their result; demo judges.

## Approved scope

### In scope

- Remove the recommendation summary paragraph from the Overview in every case, including the line "No option is clearly recommended…" shown when no option is a Good fit.
- Update the tests that checked the paragraph.

### Out of scope

- The Recommended label on the first category (feature 008 FR-007), which stays.
- The baseline statement in the CO₂e hover texts and the gauge wording, which stay.
- The five-path fallback view, which never showed the paragraph.
- Contract or server changes: `assessment.baseline` is still sent.

## Functional requirements

- **FR-001:** The Overview shows no recommendation summary paragraph: neither the best option's figures with the baseline statement nor the "No option is clearly recommended" line.
- **FR-002:** When no option is a Good fit, nothing is labelled Recommended (feature 008 FR-007, unchanged) and no replacement line is shown.

## Non-functional requirements and constraints

- **Honest impact:** The baseline remains explained where CO₂e figures appear: the "CO₂e avoided" hover texts name "buying a comparable new laptop now" and the gauge reads "of a new laptop's production".

## User journeys and edge cases

- Laptop with a plan: plan card, then the category cards, with nothing in between.
- No Good fit option anywhere: no Recommended label and no line saying so.

## Proposed technical approach

- **Web:** Delete `RecommendationSummary` from `web/src/components/ResultsView.tsx` and the now unused imports.

## Dependencies and risks

- Risk: without the "No option is clearly recommended" line, a result with no Good fit option no longer says so in words; the cards' status badges (Depends, Not a fit) still show it. Accepted by the user.

## Review and integration

Completion boundary: locally verified handoff with self-review, committed on `main`; no push or release unless the user asks. Required checks: `npm run typecheck`, `npm test`, `npm run build`.

## Assumptions and open questions

- No open questions.

## Scope change log

| Date       | Change                 | User approval |
| ---------- | ---------------------- | ------------- |
| 2026-11-21 | Initial approved scope | User asked to "get rid of this small paragraph" on the dashboard and chose "Accept" for removing it in all cases, including the fallback line, and "Spec + implement", 2026-11-21 |

## Related and superseded features

Implemented 2026-11-21 on `main` in the commit "feat(web): remove the recommendation summary from the Overview"; reciprocal notes added to features 004, 006, 008 and 013.

- [`feature-004-explained-report`](../feature-004-explained-report/PLAN.md) / **FR-002** (impact summary with the baseline statement, applied by feature 008 to the best option of the Recommended category) is replaced by FR-001 here: no impact summary is shown. AC-002 there stays as historical evidence.
- [`feature-008-ai-categories-and-options`](../feature-008-ai-categories-and-options/PLAN.md) / **FR-007**: the part "the Overview says that no option is clearly recommended" is replaced by FR-002 here; the Recommended label rule stays in force.
- [`feature-006-web-app`](../feature-006-web-app/PLAN.md) / **FR-049**: the sentence "The recommendation summary then reads 'no CO₂e avoided'" no longer applies; the "None" figure and hover text stay in force.
- [`feature-013-combined-plan-card`](../feature-013-combined-plan-card/PLAN.md) / **FR-007**: the plan card now sits directly above the categories, since the recommendation summary it was placed above is gone; otherwise unchanged.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: None
