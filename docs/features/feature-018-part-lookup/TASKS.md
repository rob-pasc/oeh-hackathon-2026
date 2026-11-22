# Implementation Tasks: Part lookup

- **Feature ID:** `feature-018-part-lookup`
- **Status:** Specified

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [ ] **T-001:** Define the part lookup contract in `shared/` (part kind, identifier, badge source, sentence, citation) and align `DetectedPart` in the web app (supports `AC-004`)
- [ ] **T-002:** Build `server/src/parts/`: identifier normalization, corpus lookup, web fallback via feature 017's adapter, cache and per-device tables, retention purge; tests (supports `AC-001`, `AC-002`, `AC-006`, `AC-007`)
- [ ] **T-003:** Add the part lookup LLM call with the citation check and delivery to the result screen; tests (supports `AC-003`, `AC-005`)
- [ ] **T-004:** Web app: badges, sentence and link in the scan specs, mock data; component tests (supports `AC-004`, `AC-008`)
- [ ] **T-005:** Privacy notice DE/EN, server README, README status (supports `AC-009`)
- [ ] **T-006:** Live smoke run, all checks, self-review, feature index update (supports `AC-010`, `AC-011`)

## Dependencies and blockers

- Blocked on feature 017 being implemented (search adapter, cap, web passages).

## Progress notes

None yet.

## Lifecycle history

- 2026-11-22: Specified after scope approval (see the [plan's scope change log](./PLAN.md#scope-change-log)).
