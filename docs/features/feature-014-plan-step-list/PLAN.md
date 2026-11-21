# Feature 014: One step list for the plan

- **Feature ID:** `feature-014-plan-step-list`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-21

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

Opening the "Your plan" card of [feature 013](../feature-013-combined-plan-card/PLAN.md) shows one ordered step list for the whole plan instead of each option's steps one after another, so shared steps such as "back up your files" or "open the bottom cover" appear once. The list follows the rules of [feature 009](../feature-009-concrete-step-plans/PLAN.md): cited sources, safety flags, removal of uncited technical steps, no figures in text, a cache, and a template fallback.

## Problem and desired outcome

- **Problem:** A plan of several options would otherwise repeat preparation and closing steps per option and leave the order between options to the reader.
- **Desired outcome:** One numbered list from start to finish for the plan, with the same safety and evidence rules as single options.
- **Target users / stakeholders:** Owners following the plan; demo judges.

## Approved scope

### In scope

- One AI call per device, intended use and plan when the plan card is first opened, with a cache.
- The feature 009 step rules applied to the plan list, with up to 16 steps.
- A template fallback built from the steps' template plans.

### Out of scope

- Changing the step plans of single options (feature 009).
- Progress tracking, ticking off steps, or printing.
- Steps for options that are not in the plan.

## Functional requirements

- **FR-001:** Opening the "Your plan" card for the first time requests the plan's step list. The server makes one AI call (the plan step call) per device, intended use and plan, and caches the result; reopening the card or reloading the page does not call again. A changed plan (different steps or order) gets its own call.
- **FR-002:** The plan step list is an ordered list of 1 to 16 steps, with the step fields and display of feature 009 FR-002 to FR-004 and FR-007 (title, detail, tools, parts, time, safety flag, sources).
- **FR-003:** The plan step call receives the scan, intended use, the plan's steps in order (title, kind, difficulty, reason), the extracted facts, and the passages retrieved for every option in the plan. Its prompt asks for one list in the plan's order that names shared preparation and closing steps once.
- **FR-004:** The server applies feature 009 FR-005, FR-006 and FR-008 to the plan list: unknown citations removed, uncited `technical` steps removed, the empty-plan message when nothing is left, and an answer with euro or CO₂e figures rejected.
- **FR-005:** While the list loads, the card shows the thinking line and step placeholders of feature 006 FR-045.
- **FR-006:** When the plan step call cannot be made or fails, and for the fallback plan of feature 013 FR-009, the card shows the template plans of the plan's steps one after another (feature 009 FR-011), with a step whose title repeats an earlier one left out, at most 16 steps, and the notice of feature 009 FR-011.
- **FR-007:** In mock mode, the sample plan of feature 013 FR-010 has a sample step list.

## Non-functional requirements and constraints

- **Safety:** The feature 009 safety flags and the "Professional only" rule apply unchanged; the prompt keeps feature 008's safety rules.
- **Cost:** One AI call per device, use and plan, only when the card is opened; counted against `LLM_DAILY_CALLS` and limited per client like the option step route.

## User journeys and edge cases

- Plan "RAM → SSD → reinstall": one list such as back up, shut down and unplug, open the bottom cover, insert the RAM module, swap the drive, close the cover, install the operating system from a USB stick, restore files; with sources for the technical steps.
- Plan ending in "hand it down": the list ends with erasing personal data and resetting the computer before handing it over.
- AI unavailable: the joined template plans, without a repeated "Back up your files" step.
- All technical steps uncited: the empty-plan message.

## Proposed technical approach

- **Server:** Reuse `server/src/steps/` (prompt, checks, cache, templates) with a plan variant: a new route such as `/api/devices/:id/plan/steps?intended_use=…`, a cache key from the plan's option IDs and order, and `MAX_PLAN_STEPS = 16`. Retrieval merges the passages of each option (`retrieveOption`).
- **Contract:** Allow a step plan of up to 16 steps for plans while single options keep 12 (`shared/src/steps.ts`).
- **Web:** Reuse `StepList` and `useStepPlans` for the plan card.
- **Open technical choice:** a separate cache table or the existing `step_cache` with a plan key; decide during implementation.

## Dependencies and risks

- Requires feature 013 (the plan and its card).
- Risk: a longer list exceeds the step timeout (`LLM_STEP_TIMEOUT_MS`); the template fallback covers a timeout, and the timeout may need its own setting.

## Review and integration

Completion boundary: locally verified handoff with self-review, committed on the branch `feat/combined-plan`; no push, merge or release unless the user asks. Required checks: `npm run typecheck`, `npm test`, `npm run build`. The live check (AC-008) runs only if `LLM_API_KEY` is configured; otherwise it is handed to the team.

## Assumptions and open questions

- Assumption (user default): up to 16 steps for a plan list.
- No blocking questions.

## Scope change log

| Date       | Change                 | User approval |
| ---------- | ---------------------- | ------------- |
| 2026-11-21 | Initial approved scope | User chose "one step list" for the plan and answered "accept" to the two-feature proposal with its defaults (no plan score, up to 16 plan steps), 2026-11-21 |

## Related and superseded features

- [Feature 009](../feature-009-concrete-step-plans/PLAN.md): its step rules are reused for the plan; single-option step plans are unchanged. Planned extension, not yet implemented.
- [Feature 013](../feature-013-combined-plan-card/PLAN.md): provides the plan and the card this list appears in.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: None
