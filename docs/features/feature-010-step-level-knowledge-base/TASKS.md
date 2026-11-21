# Implementation Tasks: Step-level knowledge base

- **Feature ID:** `feature-010-step-level-knowledge-base`
- **Status:** Complete

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Audit the existing corpus against the FR-001 to FR-003 checklist per demo model and option kind, and record the gaps in `RESEARCH.md` (supports `AC-005`)
- [x] **T-002:** Research and add the demo-model procedure sources with manifest entries (supports `AC-001`, `AC-004`, `AC-006`)
- [x] **T-003:** Research and add the generic sources for back-up, reset and Windows installation (supports `AC-002`, `AC-004`, `AC-006`)
- [x] **T-004:** Research and add the Austrian repair, donation and drop-off sources (supports `AC-003`, `AC-004`, `AC-006`)
- [x] **T-005:** Run ingestion and the corpus tests, record the coverage output and the remaining gaps, update `corpus/README.md` if conventions change, update the feature index, and self-review (supports `AC-004`, `AC-005`, `AC-007`)

## Dependencies and blockers

- Needs web access for research; some vendor sites refuse automated fetches.

## Progress notes

- 2026-11-21: T-001 to T-004 done, see [RESEARCH.md](./RESEARCH.md): six documents added (37 documents, 228 passages), `corpus/README.md` counts updated. T-005 stays open: `npm run corpus:ingest -w server` and `npm test -w server` could not run in the sandbox (Node 22, no `typebox`); a substitute check with the same manifest rules and the real chunker passed. Self-review (AC-007) done.

## Lifecycle history

- 2026-11-21: Specified after the user accepted the scope in the conversation.
- 2026-11-21: Implemented (verification pending); waiting for the ingest and test run on Node 24.
- 2026-11-21: Run on Node 24.15 after merging feature 008 into `main` (17c04b4), recorded for T-005 but not a substitute for its review: `npm run corpus:ingest` indexed 41 documents and 245 passages, with one coverage gap ("HP EliteBook 840 G5: no software-support document covers CPU i5-7200U, i5-7300U"); `server/test/corpus.test.ts` and `retrieval.test.ts` pass (58 tests), as does the full `npm test`. The feature 008 live demo review has not been repeated against this enlarged corpus.
- 2026-11-21 (second round): gap research after the first push. Four documents added: `ms-back-up-with-file-history`, `at-repaircafes-plattform`, `at-carla-elektrogeraete-reuse`, `at-carla-reparaturcafe` (41 documents, 245 passages in the substitute check). A Vorarlberg donation offer for laptops was not found; the finding is recorded in [RESEARCH.md](./RESEARCH.md). T-005 stays open for the same reason as above.
- 2026-11-21: Complete. T-005 done on `main` at f0af68e: ingestion (41 documents, 245 passages, only the known 840 G5 CPU gap) and the server suite (381 tests) pass; `corpus/README.md` needed no change. Covers FR-001–FR-006 and AC-001–AC-007; evidence in [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md).
