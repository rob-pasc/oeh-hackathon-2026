# Feature 011: Gauge follows the tab, and option statuses capped by the rules

- **Feature ID:** `feature-011-tab-gauge-and-capped-option-status`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-21

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

Two corrections to the result screen of feature 008, both found when the team tested a real device. First, the CO₂e gauge stays on the option opened last (or on the first category) when the owner switches from Overview to a category tab, so it shows figures that do not belong to what is on screen. The gauge will now move to the selected tab's best option. Second, the AI can rate an option better than the fixed rules of feature 003 allow. On a 2015 mini PC with 4 GB of RAM, an i3 and no recognized graphics, the AI rated "upgrade the SSD" a Good fit for gaming, which made it the top recommendation, although the rules rate the upgrade path "Depends". The server will now cap the status of SSD, RAM and battery options at their path's rule-based status.

## Problem and desired outcome

- **Problem:** The gauge does not follow the tab the owner is looking at. And the top recommendation can contradict the rule-based assessment, because option statuses rest on the prompt alone ([ADR-003](../../adr/adr-003-ai-chosen-options.md)).
- **Desired outcome:** The gauge always matches the selected tab or the option opened in it. An SSD, RAM or battery option is never shown as a better fit than the rules give its path, so "Recommended" cannot rest on an AI rating the rules contradict.
- **Target users / stakeholders:** Laptop and PC owners reading the result; hackathon judges watching the demo.

## Approved scope

### In scope

- Moving the gauge when a category tab or Overview is selected.
- Capping the status of options of kind `ssd`, `ram` and `battery` at the status of their path's gate (`upgrade` for `ssd` and `ram`, `repair` for `battery`), including cached AI answers.

### Out of scope

- Capping options of kind `hand_down`, `salvage`, `recycle` or `other`. Only the three part kinds were agreed; their gates describe the part work itself.
- Any CPU rule for gaming (that is [feature 012](../feature-012-gaming-cpu-check/PLAN.md)).
- Recognizing graphics behind "Microsoft Basic Display Adapter" in the scanner (possible later amendment to feature 001).
- A combined "full plan" as the top recommendation (still under discussion).
- Changes to the prompt, the figures, the rubrics or the ranking functions.

## Functional requirements

- **FR-001:** Selecting a category tab moves the gauge to that category's best option (the option that decides the category's status and score), unless an option of that category was opened while this tab was selected; then it shows that option.
- **FR-002:** Opening an option moves the gauge to that option, as before.
- **FR-003:** Selecting Overview moves the gauge to the option last opened on the Overview, or, when none was opened there, to the best option of the first category.
- **FR-004:** For an option of kind `ssd` or `ram`, the server sets the status to the worse of the AI's status and the `upgrade` gate's status (`viable` better than `conditional` better than `not_suitable`); for kind `battery`, the same with the `repair` gate.
- **FR-005:** When FR-004 lowers an option's status, its reason is replaced by the first limiting reason of the gate that caused it (a reason that is not about what the plan does, such as "the RAM can be upgraded"; the gate's first reason when none is limiting), so the card does not say "Good fit" in words while showing "Depends". When the status becomes `not_suitable`, the option has no figures and no score (feature 008 FR-002).
- **FR-006:** The cap applies equally to fresh and cached category answers, without a new AI call.

## Non-functional requirements and constraints

- **Determinism:** The cap is a pure function of the AI answer and the gate results.
- **Honesty:** Figures, rubrics and ranking stay unchanged; only statuses (and with them feasibility values, ranking groups and the Recommended label) can move.
- **No extra cost:** No additional LLM calls.

## User journeys and edge cases

- Owner opens the result, Overview shows; the gauge is on the first category's best option. They select "Pass it on"; the gauge shows that tab's best option. They open "Return it to a collection point"; the gauge follows. Back on Overview, the gauge shows the first category's best option again (nothing was opened there).
- A category whose best option is not a fit has no figures; the gauge shows its empty state, as for any option without figures.
- Gaming on the tested mini PC: the AI's SSD option "Good fit" becomes "Depends" with the gate's reason ("We cannot verify the graphics…"). If no other option is a Good fit, nothing is labelled Recommended and the Overview says no option is clearly recommended (feature 008 FR-007).
- The upgrade gate is `not_suitable` because the computer already has an SSD and enough RAM: an AI SSD option becomes Not a fit with that reason.
- AI option of kind `battery` on a desktop: the repair gate is `not_suitable` ("No battery was detected"), so the option becomes Not a fit.

## Proposed technical approach

- **Web:** In `web/src/components/ResultsView.tsx`, track the opened option per tab instead of one `selectedOption`; derive the gauge option from the active tab (FR-001 to FR-003). Extend `app.test.tsx`.
- **Server (implemented):** `capDraft` in `server/src/categories/options.ts` runs first in `finishOption`. It applies the gates' `atMost` (now exported from `server/src/assessment/gates.ts`) and, when it lowers a status, takes the first gate reason not in a short list of enabling codes (`ssd_slot_available`, `ram_upgradeable`, `drive_failing`, `battery_worn`, `os_supported`). Because the cache stores the AI answer and finishes options on each read (`server/src/categories/service.ts`), FR-006 needs no cache change. Extend `server/test/categories.test.ts`.
- **Tradeoff (proposed, not yet adopted):** The `upgrade` gate covers SSD and RAM together, so an SSD option can be capped by a RAM-only finding, for example "cannot verify whether the RAM can be upgraded". This is conservative (it can only make an option look less fit) and keeps the change small. Splitting the gate per part is possible later.
- **ADR:** After implementation, record the adopted change to ADR-003's "the server does not re-check options against the gates" in a new ADR that partly supersedes ADR-003.

## Dependencies and risks

- Depends on the feature 003 gates and the feature 008 option pipeline, both on `main`.
- Risk: fewer options are Good fit, so more results show "no option is clearly recommended". That is the intended honest outcome.

## Review and integration

Completion boundary: locally verified handoff with self-review, committed on `main`; no push, merge or release unless the user asks. Required checks: `npm run typecheck`, `npm test`, `npm run build`. CI runs the same checks on push. A browser look at the gauge behavior is part of the team browser review of feature 006 (T-009) and is not required here.

## Assumptions and open questions

- Assumption: "best option" means the option feature 008 already uses to head the category (`CategoryView.best`).
- No blocking questions.

## Scope change log

| Date       | Change                 | User approval |
| ---------- | ---------------------- | ------------- |
| 2026-11-21 | Initial approved scope | User answered "accept" on 2026-11-21 to the proposal for points 1 (gauge follows the tab) and 2a (cap SSD, RAM and battery statuses at the gate status), after reporting that the gauge did not follow the "Pass it on" tab and that gaming on a 4 GB / i3 device recommended an SSD upgrade |
| 2026-11-21 | Clarification during implementation: FR-005 names the gate's first *limiting* reason instead of its first reason. The first reason is often enabling (for example "the RAM can be upgraded") and would not explain the lower status. Same intent as approved (the card shows the rules' reason); no new requirement. | Within the approved scope; reported to the user with the implementation |

## Related and superseded features

Planned replacements (not yet implemented):

- [Feature 008](../feature-008-ai-categories-and-options/PLAN.md) **FR-011** ("The gauge follows the option the user last opened. Before any option is opened, it shows the best option of the first category") is replaced by FR-001 to FR-003 here. 008 AC-011 stays as historical evidence.
- Feature 008 **FR-012**, the part "The server checks only the payload shape", is replaced for options of kind `ssd`, `ram` and `battery` by FR-004 to FR-006 here. The rest of 008 FR-012 (inputs, safety rules in the prompt, citation and figure checks) is unchanged. 008 AC-012 and AC-016 stay as historical evidence.
- [ADR-003](../../adr/adr-003-ai-chosen-options.md): the decision "The server does not re-check options against the feature 003 gates" will be partly superseded for the three part kinds.

Unchanged: feature 008 FR-001 to FR-010 and FR-013 to FR-015; feature 003 gates and rubrics.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: [ADR-003](../../adr/adr-003-ai-chosen-options.md) (to be partly superseded on implementation)
- Gate rules: [feature 003 DESIGN](../feature-003-five-path-ranking/DESIGN.md#gate-rules)
