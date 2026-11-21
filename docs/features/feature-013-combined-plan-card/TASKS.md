# Implementation Tasks: "Your plan" card, a combined top recommendation

- **Feature ID:** `feature-013-combined-plan-card`
- **Status:** Complete

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Extend `CategoryResult` with the optional plan, the invariants and the exported JSON Schemas, with contract tests (supports `AC-010`)
- [x] **T-002:** Ask for the plan in the category prompt and bump the prompt version; validate the plan on the server (supports `AC-001`, `AC-002`)
- [x] **T-003:** Price the plan as one calculator run with AI ranges and the hand-down rule, with server tests (supports `AC-003` to `AC-005`)
- [x] **T-004:** Build the rule-based fallback plan, with server tests (supports `AC-008`)
- [x] **T-005:** Add the "Your plan" card, the gauge default and the mock sample plan, with component tests (supports `AC-006`, `AC-007`, `AC-009`)
- [x] **T-006:** Run the live check on the three demo models if a key is configured, or hand it to the team (supports `AC-011`)
- [x] **T-007:** Supersession note in feature 011, extension notes in feature 008, feature index, README and shared/server/web READMEs; typecheck, tests, build and self-review (supports `AC-012`)

## Dependencies and blockers

- AC-011 needs `LLM_API_KEY`; without it the live check is handed to the team and the feature stays `Implemented (verification pending)`.

## Progress notes

The sample AI answer (`server/test/fixtures/category-output.example-laptop-14.json`) gained a Good fit AI-estimated option, "Copy the system to the new SSD", and a plan, so the shared fixture and mock mode carry a plan with an AI-estimated step (FR-010). Two server tests that addressed options by position were changed to address them by ID.

## Lifecycle history

- 2026-11-21: Specified after the user accepted the scope (see the plan's scope change log).
- 2026-11-21: Readiness checked (no blockers besides those listed); the user asked to implement features 013 and 014. Implementation started.
- 2026-11-21: Complete at the agreed boundary (locally verified handoff with self-review on `feat/combined-plan`). Covers FR-001 to FR-010 and AC-001 to AC-012; evidence in [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md). Not pushed, merged or released.
