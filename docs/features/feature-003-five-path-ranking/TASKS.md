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
- [ ] **T-008:** Curate the real impact table entries with sources for the chosen demo models, replacing the placeholders (supports `AC-007`)
- [ ] **T-009:** Manually check extracted facts and rankings on the demo models, including the soldered-RAM case (supports `AC-005`)
- [ ] **T-010:** Run checks, self-review the diff, rubrics, and sources, and update the README and the feature index (supports `AC-015`)

## Dependencies and blockers

- Requires feature 001 (schema, device page) and feature 002 (retrieval).
- Demo models chosen 2026-11-20 (ThinkPad T480, XPS 13 9360, EliteBook 840 G5; see feature 002). CO₂e sources are selected (see `data/impact.yaml`). **Blocking for T-009:** real scans of the demo laptops.
- The web app defaults to the `general` use tag and offers `gaming`, which the contract does not have yet: in live mode those tags get `400 invalid_payload`. The user chose on 2026-11-20 to add both to the contract; the amendment scope is not yet recorded or approved.

## Progress notes

- 2026-11-20: Contracts for facts and the assessment, the invariant checks, and `rankPaths`/`totalScore` are in `shared/` with tests. They support T-001, T-005, and T-007 but do not complete any of them: extraction, gates, the calculator, rubrics, and the API are not built yet.
- 2026-11-20: LLM adapter (`server/src/llm/`) built with mocked-provider tests, ready for T-001 fact extraction; live check via `npm run llm:smoke -w server`.
- 2026-11-20: T-001 done: `server/src/facts/` (prompt, citation filter, memory and SQLite caches) with 13 mocked-LLM tests. Live check `npm run facts:smoke -w server` on the fixtures matched `facts.example-laptop-14.json` with thinking enabled (1 attempt, 10.8 s, 2176/2063 tokens) and disabled (1 attempt, 1.5 s, 2151/264 tokens). Thinking stays enabled as decided; revisit against the 20 s budget once real manuals are in the corpus. The assessment does not call the extractor yet (T-002 onward).
- 2026-11-20: T-003 done: `data/impact.yaml` with a loader, validator, and coverage check (`server/src/impact/table.ts`, 11 tests). It goes beyond placeholders: 38 entries for a typical 14-inch laptop and an office desktop are sourced from manufacturer PCFs, Fraunhofer IZM, Boavizta, peer-reviewed studies, and dated retail prices. One placeholder remains (`service.battery_replacement.price`). T-008 stays open for the demo-model-specific entries (for example exact batteries) once the models are chosen.
- 2026-11-20: T-002, T-004, T-005, and T-006 done on the branch `feat/five-path-ranking`: `server/src/assessment/` (gates, calculator, scoring and confidence, `assess()`), `config/weights.yaml` with startup validation in `main.ts`, and 52 tests in `server/test/assessment.test.ts`. The gate rules and rubrics are in [`DESIGN.md`](./DESIGN.md). Two rules were added while checking the scores on the fixtures: recycling is `conditional` while any reuse path is still possible, and a repair that leaves RAM below the use's need gets a halved useful-life score. No route calls `assess()` yet (T-007), and the scores are not yet checked on real devices (T-009).
- 2026-11-20: T-007 done. `GET /api/devices/:id/report?intended_use=` (`server/src/app.ts`) runs `createAssessmentService` (`server/src/assessment/service.ts`): retrieval, cached fact extraction, then `assess()`. It streams `assessment`, then `end` with `complete`; the `report` event between them is feature 004. A failed or unconfigured LLM gives an assessment without facts ("cannot verify"); a missing retrieval index disables the route with a startup warning. The picker, ranked view, and toggle are the feature 006 web app; the web app now stops waiting for a report when the stream ends without one. AC-001 (no ranking before a choice) is planned to be replaced by feature 006 FR-008/FR-009/FR-023 (ranking at once for the default use) and was not re-implemented. The first live assessment took 26.4 s, above the 20 s target (see the verification notes).
- The scan has no battery-swelling signal, so the swelling part of FR-006/AC-006 cannot trigger yet; the non-replaceable and unknown cases are covered.

## Lifecycle history

- 2026-11-20: Implementation started (T-001, fact extraction).
