# Implementation Tasks: Web evidence for model facts

- **Feature ID:** `feature-017-web-evidence-for-model-facts`
- **Status:** Implemented (verification pending)

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Add the additive contract changes in `shared/` (`Passage.source`, `model_evidence: 'web'`, the `status` stream event if chosen), re-export the schemas and update the contract tests (supports `AC-006`, `AC-008`, `AC-015`)
- [x] **T-002:** Read the TinyFish Fetch API documentation and record its parameters and free allowance in the plan (supports `AC-002`)
- [x] **T-003:** Build `server/src/search/`: provider interface, configuration, LangSearch and TinyFish implementations, fallback wrapper, fake provider; tests for fallback and configuration (supports `AC-002`, `AC-003`, `AC-012`)
- [x] **T-004:** Add the search cache and daily cap tables with tests for cache hit, expiry and cap (supports `AC-009`, `AC-010`)
- [x] **T-005:** Wire the search step into the assessment service: per-topic trigger, query building, model-match filter, web passages, deadline; tests (supports `AC-001`, `AC-004`, `AC-006`, `AC-011`, `AC-013`)
- [x] **T-006:** Extend fact extraction with web passage confirmation and the battery rule; tests with a fake LLM (supports `AC-005`, `AC-007`)
- [x] **T-007:** Web app: Web source label on citations, "Searching the web…" phrase, mock data; component tests (supports `AC-008`, `AC-015`)
- [x] **T-008:** Add `search:smoke` and run it live with the team's keys (supports `AC-016`)
- [ ] **T-009:** Update `server/README.md`, `server/.env.example`, `deploy/.env.example`, `docs/DEPLOYMENT.md`, the privacy notice (DE/EN) in `web/src/legal/`, `docs/PRODUCT.md`, the README status, and add ADR-008 (supports `AC-014`) *(2026-11-22: all written, plus `docs/GLOSSARY.md`, `docs/VISUAL_DESIGN.md`, `web/README.md`, `shared/README.md` and an ADR-004 note. Open: the team reads the privacy notice in the browser, AC-014.)*
- [ ] **T-010:** Run all checks, self-review the diff, record findings, add the reciprocal notes to the feature 002 and 003 plans, update the feature index (supports `AC-017`, `AC-018`) *(2026-11-22: local checks, self-review, reciprocal notes and index done. Open: CI on the `main` push, which needs the user's request to push.)*
- [ ] **T-011:** *(Added 2026-11-22)* The user confirms FR-015, the FR-006 clarification and the English-only FR-013 phrase (see the plan's open questions)

## Dependencies and blockers

- CI evidence (AC-017) needs a push to `main`, which needs the user's request.
- AC-014 needs the team's read of the privacy notice.
- T-011 needs the user's decision.

## Progress notes

- The team's keys are in the local, gitignored `server/.env`; the user will rotate them.
- Release to leaaf.green is outside this feature's completion boundary: set both keys in `deploy/.env` (see `docs/DEPLOYMENT.md`), tag and deploy with the user's authorization.

## Lifecycle history

- 2026-11-22: Specified after scope approval (see the [plan's scope change log](./PLAN.md#scope-change-log)).
- 2026-11-22: Implementation started and finished locally (f1331e6, d3c9256, documentation commit); status set to Implemented (verification pending) with AC-014, AC-017 and T-011 open.
