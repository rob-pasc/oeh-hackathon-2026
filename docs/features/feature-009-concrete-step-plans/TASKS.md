# Implementation Tasks: Concrete step plans

- **Feature ID:** `feature-009-concrete-step-plans`
- **Status:** Complete

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Add the `StepPlan` contract to `shared/src/`, export its JSON Schema, add a fixture, and add contract tests (supports `AC-002`)
- [x] **T-002:** Add option-level retrieval on the existing index, with tests (supports `AC-009`)
- [x] **T-003:** Build the step prompt and request, the citation and technical-step filter, the figure check, and the empty-plan result (supports `AC-002`, `AC-005`, `AC-006`, `AC-008`, `AC-009`)
- [x] **T-004:** Add the step route and the `step_cache` table (supports `AC-001`)
- [x] **T-005:** Write the template plans for every priced kind and `other`, and use them for failures and for the fallback categories (supports `AC-011`, `AC-012`)
- [x] **T-006:** Commit the server work with its tests (milestone)
- [x] **T-007:** Build the step list in the option card: numbered blocks, tools, parts, time, safety flags, source links, loading state (supports `AC-003`, `AC-004`, `AC-007`, `AC-010`)
- [x] **T-008:** Add the sample plans for mock mode and the component tests; check the screens in a browser (supports `AC-013`, `AC-014`)
- [x] **T-009:** Run the live demo review on the three demo models and record the findings (supports `AC-015`)
- [x] **T-010:** Update the feature index, the reciprocal notes in features 004 and 006, `docs/GLOSSARY.md`, and the README; run all checks; self-review the final diff and record the findings (supports `AC-016`)

## Dependencies and blockers

- Depends on feature 008 T-001 to T-005 (options and their IDs). Implement 008 first.
- T-009 needs a configured `LLM_API_KEY`, and plans will be thin until feature 010 adds step-level sources. (Resolved: a key was configured locally, and the feature 010 corpus already on `main` gave most technical steps a source.)

## Progress notes

- T-001 to T-006: shared contract, option retrieval, step module, route and template plans, committed as 22938bd with their tests.
- T-007, T-008: step list in the option card, mock sample plans (the desktop's fallback options use the server's template steps from `shared/fixtures/steps.templates.json`), component tests and the browser check at 1440 × 900 and 1280 × 720, committed as bf1ed95.
- T-009: live review with `npm run steps:smoke -w server` (three runs). The first run found technical steps marked `general`; the step-kind and `not_suitable` rules in the prompt were tightened (steps-v3). One borderline step remains, recorded under AC-015.
- T-010: documentation, all checks and the self-review; see [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md).

## Lifecycle history

- 2026-11-21: Specified after the user accepted the scope in the conversation.
- 2026-11-21: Implementation started on `main` at the user's request ("Implement feature 009"). Status Specified → Ready → In progress; no blockers.
- 2026-11-21: Complete at the agreed boundary (locally verified handoff with self-review) on local `main`, not pushed. Covers FR-001 to FR-013 and AC-001 to AC-016; AC-015 passed with one residual finding. Evidence in [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md).
