# Acceptance Criteria: Remove the recommendation summary

- **Feature ID:** `feature-015-remove-recommendation-summary`
- **Verification status:** Verified locally

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------ | -------- |
| AC-001 | FR-001      | On the Overview of the example laptop, the plan card and the category cards show, and there is no recommendation summary and no "Baseline:" line; the plan card sits directly above the categories. | Component test | Pass | 2026-11-21 @ 2f4d340 + working tree: `app.test.tsx` "shows no recommendation summary paragraph on the Overview (feature 015 AC-001)" and "shows \"Your plan\" above the categories…" pass. |
| AC-002 | FR-002      | With no Good fit option, nothing is labelled Recommended and no "No option is clearly recommended" line is shown. | Component test | Pass | 2026-11-21 @ 2f4d340 + working tree: `app.test.tsx` "labels nothing Recommended and shows no summary line when no option is a good fit…" passes. |
| AC-003 | Review      | Self-review of the diff with findings recorded; `npm run typecheck`, `npm test` and `npm run build` pass. | Recorded self-review and check output | Pass | 2026-11-21 @ 2f4d340 + working tree: see below. |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review on `main` (see the [plan](./PLAN.md#review-and-integration)).

**2026-11-21, self-review (Claude; not an independent review).** Reviewed the diff of `web/src/components/ResultsView.tsx`, `web/src/test/app.test.tsx` and the documentation against FR-001, FR-002 and the exclusions. Only the Overview paragraph and its now unused imports were removed; the Recommended label, hover texts, gauge, five-path fallback and contract are untouched. The feature 006 AC-059 test keeps its card check ("None" with the hover text). No findings. Not looked at in a browser.

## Verification notes

**2026-11-21.** From the repository root: `npm run typecheck` (exit 0), `npm test` (shared 131, server 358, web 128), `npm run build` (exit 0). After removing an unused test import, `npm run typecheck -w web` and `npm test -w web` (128) were run again and pass.
