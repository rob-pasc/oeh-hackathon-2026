# Implementation Tasks: Curated knowledge base and model-aware retrieval

- **Feature ID:** `feature-002-knowledge-base-retrieval`
- **Status:** Specified

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [ ] **T-001:** Define the manifest format and validator, with tests (supports `AC-001`)
- [ ] **T-002:** Decide the embedding approach (local or hosted), record it in the plan, and ask the user first if it adds a new provider or a significant dependency (supports `AC-004`–`AC-007`)
- [ ] **T-003:** Implement the ingestion command (parsing, chunking with locations, idempotent storage) with a fixture corpus and tests (supports `AC-002`)
- [ ] **T-004:** Implement model normalization and alias matching, with tests (supports `AC-003`)
- [ ] **T-005:** Implement metadata-filtered retrieval with path-specific queries, citation metadata, and the `model_evidence: "none"` case, with integration tests (supports `AC-004`–`AC-007`)
- [ ] **T-006:** Get the user's choice of the 2–3 demo models, record it in the plan, and collect real model strings and aliases from scans (supports `AC-008`, `AC-009`)
- [ ] **T-007:** Curate the real corpus (about 20–40 documents), checking terms for each, and add the coverage check (supports `AC-008`)
- [ ] **T-008:** Manually verify retrieval on real demo scans and record the passages (supports `AC-009`)
- [ ] **T-009:** Run checks, self-review the diff and terms notes, and update the README and the feature index (supports `AC-010`)

## Dependencies and blockers

- **Blocking for T-006–T-008:** The demo laptop models are not chosen yet (user decision).
- Requires the feature 001 device schema (T-002 of feature 001).

## Progress notes

None yet.

## Lifecycle history

No lifecycle events recorded yet.
