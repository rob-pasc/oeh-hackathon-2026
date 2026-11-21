# Implementation Tasks: One step list for the plan

- **Feature ID:** `feature-014-plan-step-list`
- **Status:** Specified

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [ ] **T-001:** Allow plan step lists of up to 16 steps in the shared contract, with contract tests (supports `AC-002`)
- [ ] **T-002:** Add the plan step call: request, prompt, checks, cache and route with rate limit, with server tests (supports `AC-001`, `AC-003`, `AC-004`)
- [ ] **T-003:** Build the joined template fallback without repeated titles, with server tests (supports `AC-006`)
- [ ] **T-004:** Show the step list in the plan card with loading state and mock sample, with component tests (supports `AC-001`, `AC-002`, `AC-005` to `AC-007`)
- [ ] **T-005:** Run the live check if a key is configured, or hand it to the team (supports `AC-008`)
- [ ] **T-006:** Extension note in feature 009, feature index, README and server/web READMEs (new route); typecheck, tests, build and self-review (supports `AC-009`)

## Dependencies and blockers

- Requires feature 013 to be implemented first.
- AC-008 needs `LLM_API_KEY`; without it the live check is handed to the team.

## Progress notes

None yet.

## Lifecycle history

- 2026-11-21: Specified after the user accepted the scope (see the plan's scope change log).
