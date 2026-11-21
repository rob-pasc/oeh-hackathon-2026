# Implementation Tasks: Concrete step plans

- **Feature ID:** `feature-008-concrete-step-plans`
- **Status:** Specified

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [ ] **T-001:** Add the `StepPlan` contract to `shared/src/`, export its JSON Schema, add a fixture, and add contract tests (supports `AC-002`)
- [ ] **T-002:** Add option-level retrieval on the existing index, with tests (supports `AC-009`)
- [ ] **T-003:** Build the step prompt and request, the citation and technical-step filter, the figure check, and the empty-plan result (supports `AC-002`, `AC-005`, `AC-006`, `AC-008`, `AC-009`)
- [ ] **T-004:** Add the step route and the `step_cache` table (supports `AC-001`)
- [ ] **T-005:** Write the template plans for every priced kind and `other`, and use them for failures and for the fallback categories (supports `AC-011`, `AC-012`)
- [ ] **T-006:** Commit the server work with its tests (milestone)
- [ ] **T-007:** Build the step list in the option card: numbered blocks, tools, parts, time, safety flags, source links, loading state (supports `AC-003`, `AC-004`, `AC-007`, `AC-010`)
- [ ] **T-008:** Add the sample plans for mock mode and the component tests; check the screens in a browser (supports `AC-013`, `AC-014`)
- [ ] **T-009:** Run the live demo review on the three demo models and record the findings (supports `AC-015`)
- [ ] **T-010:** Update the feature index, the reciprocal notes in features 004 and 006, `docs/GLOSSARY.md`, and the README; run all checks; self-review the final diff and record the findings (supports `AC-016`)

## Dependencies and blockers

- Depends on feature 007 T-001 to T-005 (options and their IDs). Implement 007 first.
- T-009 needs a configured `LLM_API_KEY`, and plans will be thin until feature 009 adds step-level sources.

## Progress notes

None yet.

## Lifecycle history

- 2026-11-21: Specified after the user accepted the scope in the conversation.
