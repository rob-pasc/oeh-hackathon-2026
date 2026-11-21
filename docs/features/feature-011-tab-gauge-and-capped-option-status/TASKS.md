# Implementation Tasks: Gauge follows the tab, and option statuses capped by the rules

- **Feature ID:** `feature-011-tab-gauge-and-capped-option-status`
- **Status:** Complete

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Cap the status of `ssd`, `ram` and `battery` options at their gate's status in `finishOption`, replacing the reason when lowered, with server tests including a cached answer and the mini PC gaming fixture (supports `AC-005` to `AC-009`)
- [x] **T-002:** Make the gauge follow the selected tab and the option opened in it, with component tests (supports `AC-001` to `AC-004`)
- [x] **T-003:** Record the adopted change in a new ADR that partly supersedes ADR-003; add supersession notes to the feature 008 plan and acceptance criteria and to ADR-003; update the feature 003 DESIGN note on AI options, the feature index and the README status (supports `AC-010`)
- [x] **T-004:** Run typecheck, tests and build; self-review the final diff against the plan and record findings (supports `AC-010`)

## Dependencies and blockers

- None identified.

## Progress notes

Server cap committed in 3d3dd74; gauge, ADR-007 and documentation in the following commit.

## Lifecycle history

- 2026-11-21: Specified after the user accepted the scope (see the plan's scope change log).
- 2026-11-21: Readiness checked (no blockers); implementation started at the user's request ("implement 011").
- 2026-11-21: Complete at the agreed boundary (locally verified handoff with self-review). Covers FR-001 to FR-006 and AC-001 to AC-010; evidence in [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md). Not pushed or released.
