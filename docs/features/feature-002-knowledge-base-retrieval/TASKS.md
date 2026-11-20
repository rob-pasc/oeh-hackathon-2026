# Implementation Tasks: Curated knowledge base and model-aware retrieval

- **Feature ID:** `feature-002-knowledge-base-retrieval`
- **Status:** In progress

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Define the manifest format and validator, with tests (supports `AC-001`)
- [x] **T-002:** Decide the embedding approach (local or hosted), record it in the plan, and ask the user first if it adds a new provider or a significant dependency (supports `AC-004`–`AC-007`)
- [x] **T-003:** Implement the ingestion command (parsing, chunking with locations, idempotent storage) with a fixture corpus and tests (supports `AC-002`)
- [x] **T-004:** Implement model normalization and alias matching, with tests (supports `AC-003`)
- [x] **T-005:** Implement metadata-filtered retrieval with path-specific queries, citation metadata, and the `model_evidence: "none"` case, with integration tests (supports `AC-004`–`AC-007`)
- [ ] **T-006:** Get the user's choice of the 2–3 demo models, record it in the plan, and collect real model strings and aliases from scans (supports `AC-008`, `AC-009`)
- [ ] **T-007:** Curate the real corpus (about 20–40 documents), checking terms for each, and add the coverage check (supports `AC-008`)
- [ ] **T-008:** Manually verify retrieval on real demo scans and record the passages (supports `AC-009`)
- [ ] **T-009:** Run checks, self-review the diff and terms notes, and update the README and the feature index (supports `AC-010`)

## Dependencies and blockers

- Demo models chosen 2026-11-20 (ThinkPad T480, XPS 13 9360, EliteBook 840 G5). **Blocking for T-008 and the alias part of T-006:** real scans of the demo laptops; no physical access confirmed yet.
- Requires the feature 001 device schema (T-002 of feature 001).

## Progress notes

- 2026-11-20: The retrieval output contract (`Passage`, `RetrievalResult`) is defined in `shared/` with example fixtures. No retrieval tasks have been started yet.
- 2026-11-20: T-002 decided with the user: keyword BM25 (SQLite FTS5), Markdown extracts, no new dependency. T-001, T-003, T-004, T-005 done in `server/src/retrieval/` with the fixture corpus and `server/test/retrieval.test.ts`. T-006: models chosen; aliases still to confirm from real scans.

## Lifecycle history

- 2026-11-20: In progress. Implementation requested by the user; work on branch `feat/knowledge-base-retrieval`.
