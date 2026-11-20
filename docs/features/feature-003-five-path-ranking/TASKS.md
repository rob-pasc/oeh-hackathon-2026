# Implementation Tasks: Five-path assessment and ranking

- **Feature ID:** `feature-003-five-path-ranking`
- **Status:** In progress

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Define the fact schema and implement LLM fact extraction with citation validation and per-model caching, tested with a mocked LLM (supports `AC-002`)
- [ ] **T-002:** Implement the feasibility and safety gates as pure functions, with table-driven tests (supports `AC-003`–`AC-006`)
- [x] **T-003:** Define the `impact.yaml` structure and validator with clearly marked placeholder entries (supports `AC-007`)
- [ ] **T-004:** Implement the range calculator with provenance, the baseline statement, and the conditional displacement credit, with tests (supports `AC-008`, `AC-009`)
- [ ] **T-005:** Write the criterion rubrics, including use-specific rules, and implement scoring and confidence (supports `AC-010`, `AC-013`, `AC-014`)
- [ ] **T-006:** Implement the weights config and its startup validation (supports `AC-010`)
- [ ] **T-007:** Add the assessment API and the device page's intended-use picker, ranked view, and client-side mode toggle, with web tests (supports `AC-001`, `AC-011`, `AC-012`)
- [ ] **T-008:** Curate the real impact table entries with sources for the chosen demo models, replacing the placeholders (supports `AC-007`)
- [ ] **T-009:** Manually check extracted facts and rankings on the demo models, including the soldered-RAM case (supports `AC-005`)
- [ ] **T-010:** Run checks, self-review the diff, rubrics, and sources, and update the README and the feature index (supports `AC-015`)

## Dependencies and blockers

- Requires feature 001 (schema, device page) and feature 002 (retrieval).
- **Blocking for T-008 and T-009:** Demo models not yet chosen. CO₂e sources are selected (see `data/impact.yaml`).

## Progress notes

- 2026-11-20: Contracts for facts and the assessment, the invariant checks, and `rankPaths`/`totalScore` are in `shared/` with tests. They support T-001, T-005, and T-007 but do not complete any of them: extraction, gates, the calculator, rubrics, and the API are not built yet.
- 2026-11-20: LLM adapter (`server/src/llm/`) built with mocked-provider tests, ready for T-001 fact extraction; live check via `npm run llm:smoke -w server`.
- 2026-11-20: T-001 done: `server/src/facts/` (prompt, citation filter, memory and SQLite caches) with 13 mocked-LLM tests. Live check `npm run facts:smoke -w server` on the fixtures matched `facts.example-laptop-14.json` with thinking enabled (1 attempt, 10.8 s, 2176/2063 tokens) and disabled (1 attempt, 1.5 s, 2151/264 tokens). Thinking stays enabled as decided; revisit against the 20 s budget once real manuals are in the corpus. The assessment does not call the extractor yet (T-002 onward).
- 2026-11-20: T-003 done: `data/impact.yaml` with a loader, validator, and coverage check (`server/src/impact/table.ts`, 11 tests). It goes beyond placeholders: 38 entries for a typical 14-inch laptop and an office desktop are sourced from manufacturer PCFs, Fraunhofer IZM, Boavizta, peer-reviewed studies, and dated retail prices. One placeholder remains (`service.battery_replacement.price`). T-008 stays open for the demo-model-specific entries (for example exact batteries) once the models are chosen.

## Lifecycle history

- 2026-11-20: Implementation started (T-001, fact extraction).
