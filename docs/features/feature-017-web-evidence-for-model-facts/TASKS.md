# Implementation Tasks: Web evidence for model facts

- **Feature ID:** `feature-017-web-evidence-for-model-facts`
- **Status:** Specified

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [ ] **T-001:** Add the additive contract changes in `shared/` (`Passage.source`, `model_evidence: 'web'`, the `status` stream event if chosen), re-export the schemas and update the contract tests (supports `AC-006`, `AC-008`, `AC-015`)
- [ ] **T-002:** Read the TinyFish Fetch API documentation and record its parameters and free allowance in the plan (supports `AC-002`)
- [ ] **T-003:** Build `server/src/search/`: provider interface, configuration, LangSearch and TinyFish implementations, fallback wrapper, fake provider; tests for fallback and configuration (supports `AC-002`, `AC-003`, `AC-012`)
- [ ] **T-004:** Add the search cache and daily cap tables with tests for cache hit, expiry and cap (supports `AC-009`, `AC-010`)
- [ ] **T-005:** Wire the search step into the assessment service: per-topic trigger, query building, model-match filter, web passages, deadline; tests (supports `AC-001`, `AC-004`, `AC-006`, `AC-011`, `AC-013`)
- [ ] **T-006:** Extend fact extraction with web passage confirmation and the battery rule; tests with a fake LLM (supports `AC-005`, `AC-007`)
- [ ] **T-007:** Web app: Web source label on citations, "Searching the web…" phrase, mock data; component tests (supports `AC-008`, `AC-015`)
- [ ] **T-008:** Add `search:smoke` and run it live with the team's keys (supports `AC-016`)
- [ ] **T-009:** Update `server/README.md`, `server/.env.example`, `deploy/.env.example`, `docs/DEPLOYMENT.md`, the privacy notice (DE/EN) in `web/src/legal/`, `docs/PRODUCT.md`, the README status, and add ADR-008 (supports `AC-014`)
- [ ] **T-010:** Run all checks, self-review the diff, record findings, add the reciprocal notes to the feature 002 and 003 plans, update the feature index (supports `AC-017`, `AC-018`)

## Dependencies and blockers

- None blocking specification. T-008 needs the team's LangSearch and TinyFish keys in `server/.env`.

## Progress notes

None yet.

## Lifecycle history

- 2026-11-22: Specified after scope approval (see the [plan's scope change log](./PLAN.md#scope-change-log)).
