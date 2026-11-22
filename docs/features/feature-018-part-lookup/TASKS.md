# Implementation Tasks: Part lookup

- **Feature ID:** `feature-018-part-lookup`
- **Status:** Implemented (verification pending)

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Define the part lookup contract in `shared/` (part kind, identifier, badge source, sentence, citation) and align `DetectedPart` in the web app (supports `AC-004`)
- [x] **T-002:** Build `server/src/parts/`: identifier normalization, corpus lookup, web fallback via feature 017's adapter, cache and per-device tables, retention purge; tests (supports `AC-001`, `AC-002`, `AC-006`, `AC-007`) *(2026-11-22: no per-device table was needed, so the retention purge is unchanged; see the plan's technical approach.)*
- [x] **T-003:** Add the part lookup LLM call with the citation check and delivery to the result screen; tests (supports `AC-003`, `AC-005`)
- [x] **T-004:** Web app: badges, sentence and link in the scan specs, mock data; component tests (supports `AC-004`, `AC-008`)
- [ ] **T-005:** Privacy notice DE/EN, server README, README status (supports `AC-009`) *(2026-11-22: all written, plus `server/.env.example`, `deploy/.env.example`, `docs/DEPLOYMENT.md`, `docs/GLOSSARY.md` and `docs/PRODUCT.md`. Open: the team reads the privacy notice in the browser, AC-009.)*
- [ ] **T-006:** Live smoke run, all checks, self-review, feature index update (supports `AC-010`, `AC-011`) *(2026-11-22: smoke run, local checks, self-review and index done. Open: merge into `main` and CI on the push.)* *(2026-11-22: merged in 818161e; CI on the push is open.)*

## Dependencies and blockers

- Feature 017 is implemented on `main` (the dependency is met).
- AC-009 needs the team's read of the privacy notice.
- AC-011 needs CI on the `main` push (merged 2026-11-22).

## Progress notes

- Work was done on the branch `feat/part-lookup` (from `main` at c981e7c): 0f76369 (server and contract), dcecae8 (web), 8f4ecb5 (documentation); merged into `main` in 818161e on 2026-11-22.
- Release to leaaf.green is outside this feature's completion boundary; it needs the feature 017 keys in `deploy/.env` (see `docs/DEPLOYMENT.md`).

## Lifecycle history

- 2026-11-22: Specified after scope approval (see the [plan's scope change log](./PLAN.md#scope-change-log)).
- 2026-11-22: Implementation started on `feat/part-lookup`; FR-001 clarified with the user (drives and battery by type).
- 2026-11-22: Implemented and verified locally (AC-001 to AC-008 and AC-010 pass, see [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md)); status set to Implemented (verification pending) with AC-009 and AC-011 open.
- 2026-11-22: Merged into `main` at the user's request (818161e); status unchanged, AC-009 and AC-011 (CI on `main`) open.
