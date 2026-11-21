# Implementation Tasks: "Your plan" card, a combined top recommendation

- **Feature ID:** `feature-013-combined-plan-card`
- **Status:** Specified

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [ ] **T-001:** Extend `CategoryResult` with the optional plan, the invariants and the exported JSON Schemas, with contract tests (supports `AC-010`)
- [ ] **T-002:** Ask for the plan in the category prompt and bump the prompt version; validate the plan on the server (supports `AC-001`, `AC-002`)
- [ ] **T-003:** Price the plan as one calculator run with AI ranges and the hand-down rule, with server tests (supports `AC-003` to `AC-005`)
- [ ] **T-004:** Build the rule-based fallback plan, with server tests (supports `AC-008`)
- [ ] **T-005:** Add the "Your plan" card, the gauge default and the mock sample plan, with component tests (supports `AC-006`, `AC-007`, `AC-009`)
- [ ] **T-006:** Run the live check on the three demo models if a key is configured, or hand it to the team (supports `AC-011`)
- [ ] **T-007:** Supersession note in feature 011, extension notes in feature 008, feature index, README and shared/server/web READMEs; typecheck, tests, build and self-review (supports `AC-012`)

## Dependencies and blockers

- AC-011 needs `LLM_API_KEY`; without it the live check is handed to the team and the feature stays `Implemented (verification pending)`.

## Progress notes

None yet.

## Lifecycle history

- 2026-11-21: Specified after the user accepted the scope (see the plan's scope change log).
