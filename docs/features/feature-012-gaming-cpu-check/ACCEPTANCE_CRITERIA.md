# Acceptance Criteria: Processor check for gaming

- **Feature ID:** `feature-012-gaming-cpu-check`
- **Verification status:** Verified locally

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001      | Given the tested mini PC's scan (i3-5005U, 2 cores, 4 threads) and `gaming`, the `upgrade` and `repair` gates are `not_suitable` and their reasons name the processor. | Server unit test | Pass | 2026-11-21 @ 9240a06 + working tree: `assessment.test.ts` "makes upgrade and repair Not a fit for gaming on the tested i3-5005U, naming the processor" and "keeps the first reason of a path that is already Not a fit…" pass; fails with the gate disabled (mutation check). |
| AC-002 | FR-001      | Given a processor above the threshold and `gaming`, no processor reason appears and the statuses are those of the existing RAM and graphics rules. | Server unit test | Pass | 2026-11-21 @ 9240a06 + working tree: `assessment.test.ts` "leaves processors at or above the floor alone" passes (i3-3225, i5-8250U, Ryzen 5 5600X). |
| AC-003 | FR-002      | Given a scan with no CPU name, cores or threads and `gaming`, the gates are the same as without this feature. | Server unit test | Pass | 2026-11-21 @ 9240a06 + working tree: `assessment.test.ts` "changes nothing when the processor cannot be judged" passes. |
| AC-004 | FR-003      | The mini PC scan with `office`, and pass it on, salvage and recycle with `gaming`, give the same statuses and reasons as before. | Server unit test | Pass | 2026-11-21 @ 9240a06 + working tree: `assessment.test.ts` "leaves other uses, and pass it on, salvage and recycle for gaming, unchanged" passes. |
| AC-005 | FR-004      | The feature 003 DESIGN gate rules describe the processor rule and cite its source. | Document review | Pass | 2026-11-21 @ 9240a06 + working tree: Document review: the feature 003 [DESIGN gate rules](../feature-003-five-path-ranking/DESIGN.md#gate-rules) describe the rule and link [RESEARCH](./RESEARCH.md), which cites Valve (CS2 minimum, read from Valve's store API), Epic (Fortnite minimum) and Intel (i3-3225, i3-5005U). |
| AC-006 | Review      | Self-review of the final diff against this plan, with findings recorded below; `npm run typecheck`, `npm test` and `npm run build` pass. | Recorded self-review and check output | Pass | 2026-11-21 @ 9240a06 + working tree: Self-review below; `npm run typecheck`, `npm test` (shared 117, server 332, web 118) and `npm run build` pass. |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review (see the [plan](./PLAN.md#review-and-integration)).

**2026-11-21, self-review (Claude; not an independent review).** Reviewed `git diff 9240a06 -- server/src server/test` and the documentation changes against FR-001 to FR-004 and the exclusions.

- Only `gaming` and only the upgrade and repair gates are affected; recycling still sees the gates before the check, so FR-003 holds (AC-004 test).
- Finding (fixed): on a path already `not_suitable` for another reason (for example a desktop without a battery), the processor reason was placed first with "a battery repair does not change that". It now keeps the existing reason first and adds the processor reason after it, without the action clause. Covered by a new test; rechecked with the full server suite.
- Finding (accepted limit, recorded in the plan and RESEARCH): the name's clock is the base clock, so recent dual-core laptop chips with a high turbo clock count as too weak.
- The threshold was chosen under the user's delegation ("research … and implement … in full") rather than confirmed separately; recorded in the plan.

No open blocking findings. Push, merge and release are outside the boundary and were not done.

## Verification notes

**2026-11-21.** From the repository root: `npm run typecheck` (exit 0), `npm test` (shared 117, server 332, web 118 passed), `npm run build` (exit 0). Mutation check: with the processor gate bypassed, the AC-001 test fails. Together with feature 011, AI options of kind `ssd`, `ram` and `battery` on the tested mini PC now become Not a fit for gaming (they are capped at the new gate status). No live check on leaaf.green: nothing was deployed.
