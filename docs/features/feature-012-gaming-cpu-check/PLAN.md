# Feature 012: Processor check for gaming

- **Feature ID:** `feature-012-gaming-cpu-check`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-21

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

For the intended use `gaming`, feature 003 checks only RAM (16 GB) and a dedicated graphics card. The processor is never looked at, so a 2015 dual-core i3 laptop chip can still get "upgrade the SSD" as a gaming option. This feature adds a processor check: when the CPU is clearly too weak for gaming, upgrade and repair are `not_suitable` for gaming, with a reason that names the processor. Together with [feature 011](../feature-011-tab-gauge-and-capped-option-status/PLAN.md), which caps the AI's SSD, RAM and battery options at these gate statuses, such options then show "Not a fit".

## Problem and desired outcome

- **Problem:** A gaming result can suggest part upgrades on a computer whose processor rules out gaming, which no SSD or RAM upgrade changes.
- **Desired outcome:** For gaming, a clearly too weak processor makes upgrade and repair "Not a fit" with an understandable, sourced reason.
- **Target users / stakeholders:** Owners who choose the gaming use; demo judges.

## Approved scope

### In scope

- A rule, based on the scanned CPU name, cores and threads, that classifies a processor as clearly too weak for gaming.
- Applying it to the `upgrade` and `repair` gates for `gaming` only.
- A cited source for the threshold, recorded with the rule.

### Out of scope

- Any processor rule for other intended uses.
- Performance classes, benchmarks or game-specific requirements (still excluded by feature 003).
- CPU upgrades as an option.
- Changes to pass it on, salvage and recycle, which do not depend on the current use (feature 003 FR-017).

## Functional requirements

- **FR-001:** For the intended use `gaming`, when the scanned processor is classified as too weak for gaming (rule to be fixed under the blocking question below), the `upgrade` and `repair` gates are `not_suitable` with a reason that names the processor and says that upgrading or repairing other parts does not change it.
- **FR-002:** When the processor cannot be classified (name, cores and threads missing or unrecognized), the gates are unchanged by this feature; no extra "cannot verify" reason is added.
- **FR-003:** For every other intended use, and for pass it on, salvage and recycle under `gaming`, results are unchanged.
- **FR-004:** The rule and its source are documented in the feature 003 gate rules ([DESIGN](../feature-003-five-path-ranking/DESIGN.md#gate-rules)).

## Non-functional requirements and constraints

- **Evidence over assertion:** The threshold must cite a source (product principle). A rule without a source is not shipped.
- **Determinism:** The rule is a pure function of the scan.

## User journeys and edge cases

- The tested mini PC (Intel Core i3-5005U, 2 cores, 4 threads, 15 W "U" chip from 2015) with `gaming`: upgrade and repair become Not a fit with the processor reason; with feature 011, the AI's SSD option is Not a fit too.
- A current 6-core desktop processor with `gaming`: no processor reason; the RAM and graphics rules apply as before.
- A scan whose CPU name is missing: no change (FR-002).
- The same mini PC with `office`: unchanged.

## Proposed technical approach

- Add a `gamingCpuGate` next to `graphicsGate` in `server/src/assessment/gates.ts`, called from the upgrade and repair gates for `gaming`. Classify by thread or core count and, if the source supports it, by the low-power suffix in the name (for example Intel "U"/"Y"). Extend `server/test/assessment.test.ts` (or the existing gate tests).
- Whether a too weak CPU should be `not_suitable` or only `conditional` was proposed as "Not a fit" and accepted.

## Dependencies and risks

- Works without feature 011, but only with it do AI-chosen SSD, RAM and battery options follow the new gate status.
- Risk: a rule based on names and core counts misclassifies some processors. It is kept to "clearly too weak" cases to avoid false negatives on capable chips.

## Review and integration

Completion boundary: locally verified handoff with self-review, committed on `main`; no push, merge or release unless the user asks. Required checks: `npm run typecheck`, `npm test`, `npm run build`.

## Assumptions and open questions

- **Blocking:** Which threshold counts as "clearly too weak for gaming", and which source supports it? Proposed starting point: fewer than 4 physical cores, citing the minimum system requirements of widely played current PC games or a platform survey. Research the source and confirm the threshold with the user before implementation.
- Assumption: unclassifiable processors add no reason (FR-002), to avoid a second "cannot verify" next to the graphics one.

## Scope change log

| Date       | Change                 | User approval |
| ---------- | ---------------------- | ------------- |
| 2026-11-21 | Initial approved scope | User answered "accept" on 2026-11-21 to the plan that point 2b (a too weak CPU makes upgrade and repair Not a fit for gaming) becomes its own feature, because the threshold needs a cited rule |

## Related and superseded features

- [Feature 003](../feature-003-five-path-ranking/PLAN.md) **FR-017** (gaming needs 16 GB RAM and a dedicated graphics card) is extended with the processor condition of FR-001 here. Planned extension, not yet implemented; 003 AC-018 stays valid for the graphics part.
- [Feature 011](../feature-011-tab-gauge-and-capped-option-status/PLAN.md) carries the new gate status into AI options of kind `ssd`, `ram` and `battery`.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: None yet
