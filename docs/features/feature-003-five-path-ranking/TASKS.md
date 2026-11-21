# Implementation Tasks: Five-path assessment and ranking

- **Feature ID:** `feature-003-five-path-ranking`
- **Status:** In progress

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Define the fact schema and implement LLM fact extraction with citation validation and per-model caching, tested with a mocked LLM (supports `AC-002`)
- [x] **T-002:** Implement the feasibility and safety gates as pure functions, with table-driven tests (supports `AC-003`–`AC-006`)
- [x] **T-003:** Define the `impact.yaml` structure and validator with clearly marked placeholder entries (supports `AC-007`)
- [x] **T-004:** Implement the range calculator with provenance, the baseline statement, and the conditional displacement credit, with tests (supports `AC-008`, `AC-009`)
- [x] **T-005:** Write the criterion rubrics, including use-specific rules, and implement scoring and confidence (supports `AC-010`, `AC-013`, `AC-014`)
- [x] **T-006:** Implement the weights config and its startup validation (supports `AC-010`)
- [x] **T-007:** Add the assessment API and the device page's intended-use picker, ranked view, and client-side mode toggle, with web tests (supports `AC-001`, `AC-011`, `AC-012`)
- [ ] **T-008:** Replace the remaining placeholder (`service.battery_replacement.price`) with a sourced entry ~~and curate the real impact table entries for the chosen demo models~~ (supports `AC-007`) *(Revised 2026-11-21: no demo models.)*
- [x] ~~**T-009:** Manually check extracted facts and rankings on the demo models, including the soldered-RAM case (supports `AC-005`)~~ *(Removed 2026-11-21: no demo models, see the scope change log.)*
- [ ] **T-010:** Run checks, self-review the diff, rubrics, and sources, and update the README and the feature index (supports `AC-015`)
- [x] **T-011:** *(amendment)* Add `general` and `gaming` to `INTENDED_USES` in `shared/`, regenerate the schemas, and accept them on the report stream, with tests (supports `AC-016`)
- [x] **T-012:** *(amendment)* Add the use rules: RAM needs, the dedicated-GPU check for `gaming`, use labels, and the confidence reason, and document them in `DESIGN.md`, with table-driven tests (supports `AC-017`, `AC-018`, `AC-019`)
- [x] **T-013:** *(amendment)* Add the `general` (reused from `office`) and `gaming` (estimate) life entries to `data/impact.yaml` and the coverage check (supports `AC-017`, `AC-019`)
- [x] **T-014:** *(amendment)* Switch the web app's use tags to the contract type, remove the "not in the contract" notes, and update feature 006's plan and the feature index (supports `AC-020`)

## Dependencies and blockers

- Requires feature 001 (schema, device page) and feature 002 (retrieval).
- CO₂e sources are selected (see `data/impact.yaml`). ~~Demo models chosen 2026-11-20; **blocking for T-009:** real scans of the demo laptops.~~ *(2026-11-21: no demo models; T-009 removed.)*
- The web app defaults to the `general` use tag and offers `gaming`, which the contract does not have yet: this was resolved on 2026-11-20 by the amendment FR-015 to FR-018 (T-011 to T-014 done).

## Progress notes

- 2026-11-20: Contracts for facts and the assessment, the invariant checks, and `rankPaths`/`totalScore` are in `shared/` with tests. They support T-001, T-005, and T-007 but do not complete any of them: extraction, gates, the calculator, rubrics, and the API are not built yet.
- 2026-11-20: LLM adapter (`server/src/llm/`) built with mocked-provider tests, ready for T-001 fact extraction; live check via `npm run llm:smoke -w server`.
- 2026-11-20: T-001 done: `server/src/facts/` (prompt, citation filter, memory and SQLite caches) with 13 mocked-LLM tests. Live check `npm run facts:smoke -w server` on the fixtures matched `facts.example-laptop-14.json` with thinking enabled (1 attempt, 10.8 s, 2176/2063 tokens) and disabled (1 attempt, 1.5 s, 2151/264 tokens). Thinking stays enabled as decided; revisit against the 20 s budget once real manuals are in the corpus. The assessment does not call the extractor yet (T-002 onward).
- 2026-11-20: T-003 done: `data/impact.yaml` with a loader, validator, and coverage check (`server/src/impact/table.ts`, 11 tests). It goes beyond placeholders: 38 entries for a typical 14-inch laptop and an office desktop are sourced from manufacturer PCFs, Fraunhofer IZM, Boavizta, peer-reviewed studies, and dated retail prices. One placeholder remains (`service.battery_replacement.price`). T-008 stays open for the demo-model-specific entries (for example exact batteries) once the models are chosen.
- 2026-11-20: T-002, T-004, T-005, and T-006 done on the branch `feat/five-path-ranking`: `server/src/assessment/` (gates, calculator, scoring and confidence, `assess()`), `config/weights.yaml` with startup validation in `main.ts`, and 52 tests in `server/test/assessment.test.ts`. The gate rules and rubrics are in [`DESIGN.md`](./DESIGN.md). Two rules were added while checking the scores on the fixtures: recycling is `conditional` while any reuse path is still possible, and a repair that leaves RAM below the use's need gets a halved useful-life score. No route calls `assess()` yet (T-007), and the scores are not yet checked on real devices (T-009).
- 2026-11-20: T-007 done. `GET /api/devices/:id/report?intended_use=` (`server/src/app.ts`) runs `createAssessmentService` (`server/src/assessment/service.ts`): retrieval, cached fact extraction, then `assess()`. It streams `assessment`, then `end` with `complete`; the `report` event between them is feature 004. A failed or unconfigured LLM gives an assessment without facts ("cannot verify"); a missing retrieval index disables the route with a startup warning. The picker, ranked view, and toggle are the feature 006 web app; the web app now stops waiting for a report when the stream ends without one. AC-001 (no ranking before a choice) is planned to be replaced by feature 006 FR-008/FR-009/FR-023 (ranking at once for the default use) and was not re-implemented. The first live assessment took 26.4 s, above the 20 s target (see the verification notes).
- 2026-11-20: Thinking for fact extraction is now off by default (user decision; `server/src/llm/config.ts`, both `.env.example` files). The cold T480 assessment went from 26.4 s to 1.8 s with the same eight facts. This revisits the T-001 note above, as it proposed.
- 2026-11-20: T-011 to T-014 done. `general` and `gaming` are in `INTENDED_USES`; `graphicsClass` and the gaming graphics gate are in `server/src/assessment/gates.ts`; a new impact status `estimate` lowers confidence; the web app's use tags are the contract type. While implementing, FR-018/AC-019 were clarified, because marking every gaming life entry as an estimate contradicted FR-017 (see the plan's scope change log).
- The scan has no battery-swelling signal, so the swelling part of FR-006/AC-006 cannot trigger yet; the non-replaceable and unknown cases are covered.
- 2026-11-21: Demo models dropped by the user (see the plan's scope change log). T-009 removed; T-008 narrowed to the battery labour placeholder.

## Lifecycle history

- 2026-11-20: Implementation started (T-001, fact extraction).
- 2026-11-20: Amendment approved: `general` and `gaming` intended uses (FR-015 to FR-018). The feature was already in progress, so its status stays `In progress`.
