# Feature 013: "Your plan" card, a combined top recommendation

- **Feature ID:** `feature-013-combined-plan-card`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-21

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

The top recommendation is a single action today ("Swap the SSD"), but owners need the whole sequence, for example add RAM, swap the SSD, reinstall and perhaps hand the computer down. This feature adds a "Your plan" card above the categories on the Overview. The AI proposes the plan within its existing category call; the server checks it against fixed rules, prices it as one plan with the calculator (the new-laptop saving counted once), and builds a rule-based plan when the AI is unavailable. One step list for the whole plan follows in [feature 014](../feature-014-plan-step-list/PLAN.md).

## Problem and desired outcome

- **Problem:** The result shows separate actions; the owner has to work out which ones to combine and in which order, and the figures of separate options cannot be added up honestly.
- **Desired outcome:** When at least two good options combine, the owner sees one ordered plan with combined cost, extra life and CO₂e, and the gauge shows it.
- **Target users / stakeholders:** Owners reading the result; demo judges.

## Approved scope

### In scope

- A plan proposed by the existing category call (option order and one sentence), with server checks.
- Combined figures for the plan with the existing calculator.
- A "Your plan" card above the categories on the Overview, shown by the gauge on the Overview.
- A rule-based fallback plan when the AI is unavailable.
- A sample plan in mock mode.

### Out of scope

- The plan's step list (feature 014).
- Several alternative plans; editing a plan or adding and removing steps.
- Salvage or recycle as plan steps.
- A score or rank for the plan, or comparing it with the categories (user accepted this default, 2026-11-21).
- Changes to the categories, their ranking or the Recommended label.

## Functional requirements

- **FR-001:** The category call returns, besides the categories, an optional plan: an ordered list of option IDs from its own categories and a one-sentence summary. No additional AI call is made.
- **FR-002:** The server accepts a plan only if every step is an option with status `viable` after the feature 011 cap, no option appears twice, and it has at least two steps. Otherwise the result has no plan.
- **FR-003:** Plan steps are options that keep the computer in use (kinds `ssd`, `ram`, `battery`, `other`), in the AI's order, optionally followed by exactly one option of kind `hand_down` as the last step. A plan with a `salvage` or `recycle` step, more than one `hand_down` step, or `hand_down` before the last step is rejected.
- **FR-004:** The plan's figures come from one calculator run: SSD and RAM steps form one upgrade plan as in feature 003, a battery step adds the repair plan's cost and own emissions, and a step of kind `other` adds its AI-estimated cost and own CO₂e. The baseline is credited once against the plan's total own emissions. Extra life is the longest of the steps' extra-life ranges, not their sum.
- **FR-005:** A plan whose last step is `hand_down` is priced like an upgrade under the intended use "pass it on": the credit is conditional on the recipient otherwise buying new (feature 003 displacement `conditional`), with the matching assumption text.
- **FR-006:** A plan with any AI-estimated step is marked as an AI estimate in the payload and on the card and the gauge.
- **FR-007:** When the result has a plan, the Overview shows a "Your plan" card above the recommendation summary and the categories, with the summary sentence, the step titles in order, and the combined cost, extra life and CO₂e avoided (with the feature 006 FR-049 "None" rule). It has no score. Without a plan, the Overview is unchanged.
- **FR-008:** On the Overview, the gauge shows the plan when there is one; otherwise the best option of the first category. Category tabs keep the feature 011 behavior.
- **FR-009:** When the category call cannot be made or fails (feature 008 FR-013), the server builds the plan from the rule-based results: the upgrade plan's SSD and RAM steps, then the battery repair, each only if its path is `viable`, in that fixed order; the same two-step minimum applies. The fallback categories are unchanged.
- **FR-010:** In mock mode, the sample result for the example laptop includes a plan with an AI-estimated step.

## Non-functional requirements and constraints

- **Honest impact:** No figures of alternative plans or categories are added together; the plan is one alternative with one baseline credit. AI-estimated figures are labelled.
- **Cost:** No extra AI call for the plan; the prompt version changes once, so each device and use gets one new category call.
- **Compatibility:** The `plan` field is optional, so older payloads and the fallback without a plan stay valid.

## User journeys and edge cases

- Office use on a laptop with an HDD and 4 GB RAM: plan "Add 8 GB RAM → Swap in a 500 GB SSD → Reinstall the operating system", priced as one upgrade plus the AI estimate for the reinstall, marked "AI estimate".
- Pass-on use: plan "Swap in an SSD → Hand it down"; the CO₂e credit is conditional on the recipient.
- The tested mini PC with gaming: no Good fit options, so no plan; the Overview looks as today.
- The AI proposes a plan with a "Depends" option or with recycling: the plan is dropped; categories are shown as usual.
- AI unavailable on a laptop whose upgrade (HDD and too little RAM) and battery repair are both viable: the fallback plan shows "SSD → RAM → battery" steps from the rules.

## Proposed technical approach

- **Contract:** Add an optional `plan` to `CategoryResult` in `shared/src/categories.ts` (steps as option IDs, summary, `impact`, `impact_source`), extend `checkCategoryResult`, re-export the JSON Schemas, and follow [changing a contract](../../../shared/README.md#changing-a-contract).
- **Prompt:** Ask for the plan in `server/src/categories/prompt.ts` and bump `CATEGORY_PROMPT_VERSION`.
- **Server:** A `buildPlan` step after `finishOption` in `server/src/categories/` validates the plan (FR-002, FR-003) and prices it by building a combined feature 003 plan for `calculateImpact` plus the AI ranges (FR-004 to FR-006); `fallback.ts` builds the rule-based plan (FR-009).
- **Web:** A `PlanCard` above the summary in `web/src/components/ResultsView.tsx`, a `planView` in `web/src/lib/`, the gauge default (FR-008), and a sample plan in the mock data.
- **Decided during implementation:** `server/src/categories/plan.ts` prices the plan as a sum of per-step impacts with one baseline credit: one `calculateImpact` run for the SSD and RAM steps together (the existing upgrade plan), one for a battery step, the AI ranges of `other` steps, and the hand-over for a final `hand_down`, then `avoided()` once over the summed own emissions. No new `PathPlan` variant was needed. Plan steps carry `category_id`, `option_id`, `title` and `kind`; in the fallback, the five-path upgrade option is referenced by both its SSD and RAM steps, so uniqueness is per option and kind.

## Dependencies and risks

- Builds on features 003, 008 and 011 (cap) on this branch; feature 014 builds on this feature.
- Risk: the AI proposes valid but unhelpful combinations. The server checks catch only invalid ones; the live check (AC-011) covers this.
- Risk: the prompt version change makes every device ask the AI once more, counting against `LLM_DAILY_CALLS`.

## Review and integration

Completion boundary: locally verified handoff with self-review, committed on the branch `feat/combined-plan` (user request, 2026-11-21); no push, merge or release unless the user asks. Required checks: `npm run typecheck`, `npm test`, `npm run build`. The live check with the real provider (AC-011) is run by Claude only if `LLM_API_KEY` is configured locally; otherwise it is handed to the team.

## Assumptions and open questions

- Assumption (user default): the plan card has no score.
- Assumption: options of kind `other` in a plan are only those that keep the computer in use (for example reinstalling); an `other` option that ends use cannot be detected by kind and relies on the prompt.
- No blocking questions.

## Scope change log

| Date       | Change                 | User approval |
| ---------- | ---------------------- | ------------- |
| 2026-11-21 | Initial approved scope | User chose approach B (AI proposes, server checks), a card above the categories, one step list and "upgrade, then hand down", then answered "accept" to the two-feature proposal with its defaults (no plan score, up to 16 plan steps), 2026-11-21 |

## Related and superseded features

Implemented 2026-11-21 on `feat/combined-plan` (server in ed06786, card in the following commit); reciprocal notes added to features 011 and 008:

- [Feature 011](../feature-011-tab-gauge-and-capped-option-status/PLAN.md) **FR-003** (on the Overview the gauge shows the first category's best option) is replaced by FR-008 here when a plan exists; unchanged without a plan.
- [Feature 008](../feature-008-ai-categories-and-options/PLAN.md) **FR-001** (the category call returns categories) and **FR-013** (fallback) are extended with the plan; their requirements stay valid. FR-007 (Recommended label) is unchanged.
- [Feature 003](../feature-003-five-path-ranking/PLAN.md) calculator and displacement rules are reused unchanged.

- [Feature 015](../feature-015-remove-recommendation-summary/PLAN.md#related-and-superseded-features) (implemented 2026-11-21 on `main`) removes the recommendation summary, so the plan card of FR-007 sits directly above the categories; otherwise FR-007 is unchanged.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Follow-up: [feature 014](../feature-014-plan-step-list/PLAN.md)
- Related ADRs: [ADR-003](../../adr/adr-003-ai-chosen-options.md), [ADR-007](../../adr/adr-007-gate-cap-for-ai-part-options.md)
