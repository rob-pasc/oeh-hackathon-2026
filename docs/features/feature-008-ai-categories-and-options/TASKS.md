# Implementation Tasks: AI categories and options

- **Feature ID:** `feature-008-ai-categories-and-options`
- **Status:** Specified

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [ ] **T-001:** Add the `CategoryResult` contract (categories, options, kind, difficulty, impact source, criterion scores) to `shared/src/`, export its JSON Schema, add a fixture for the example laptop, and add contract tests (supports `AC-001`, `AC-002`)
- [ ] **T-002:** Add option and category ranking to `shared/src/ranking.ts` with tests, including the Recommended rule (supports `AC-006`, `AC-007`, `AC-008`)
- [ ] **T-003:** Map priced kinds to the calculator, validate AI-estimated ranges, derive criterion scores and confidence, and record the feasibility values per difficulty in the feature 003 rubric documentation (supports `AC-003`, `AC-004`, `AC-005`)
- [ ] **T-004:** Build the category prompt and request, the shape and citation checks, the figure check, and the `category_cache` table; send the `categories` event on the report stream (supports `AC-001`, `AC-002`, `AC-012`, `AC-014`)
- [ ] **T-005:** Convert the five-path assessment and template text into five fallback categories for every failure case (supports `AC-013`)
- [ ] **T-006:** Commit the domain logic and server work with their tests (milestone)
- [ ] **T-007:** Replace the web app's proposed option types with the shared contract; build the dynamic toolbar tabs, the ranked Overview, the category tab and option cards, the "AI estimate" label, and the gauge selection (supports `AC-008`–`AC-011`)
- [ ] **T-008:** Add the sample categories for mock mode and the component tests (supports `AC-015`)
- [ ] **T-009:** Run the live demo review on the three demo models and record the findings (supports `AC-016`)
- [ ] **T-010:** Record the ADR for AI-chosen options; update `docs/PRODUCT.md`, the README, `docs/GLOSSARY.md`, the feature index, and the reciprocal notes in features 003, 004 and 006 (supports `AC-017`)
- [ ] **T-011:** Run all checks, self-review the final diff against the plan, and record the findings and their resolution (supports `AC-017`)

## Dependencies and blockers

- T-009 needs a configured `LLM_API_KEY` and real scans or fixtures of the demo models.
- The open questions in the plan (timeout, thinking, feasibility values) must be settled during T-003 and T-004.

## Progress notes

None yet.

## Lifecycle history

- 2026-11-21: Specified after the user accepted the scope in the conversation.
