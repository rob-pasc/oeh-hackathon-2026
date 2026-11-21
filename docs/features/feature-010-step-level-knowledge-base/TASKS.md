# Implementation Tasks: Step-level knowledge base

- **Feature ID:** `feature-010-step-level-knowledge-base`
- **Status:** Implemented (verification pending)

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Audit the existing corpus against the FR-001 to FR-003 checklist per demo model and option kind, and record the gaps in `RESEARCH.md` (supports `AC-005`)
- [x] **T-002:** Research and add the demo-model procedure sources with manifest entries (supports `AC-001`, `AC-004`, `AC-006`)
- [x] **T-003:** Research and add the generic sources for back-up, reset and Windows installation (supports `AC-002`, `AC-004`, `AC-006`)
- [x] **T-004:** Research and add the Austrian repair, donation and drop-off sources (supports `AC-003`, `AC-004`, `AC-006`)
- [ ] **T-005:** Run ingestion and the corpus tests, record the coverage output and the remaining gaps, update `corpus/README.md` if conventions change, update the feature index, and self-review (supports `AC-004`, `AC-005`, `AC-007`)

## Dependencies and blockers

- Needs web access for research; some vendor sites refuse automated fetches.

## Progress notes

- 2026-11-21: T-001 to T-004 done, see [RESEARCH.md](./RESEARCH.md): six documents added (37 documents, 228 passages), `corpus/README.md` counts updated. T-005 stays open: `npm run corpus:ingest -w server` and `npm test -w server` could not run in the sandbox (Node 22, no `typebox`); a substitute check with the same manifest rules and the real chunker passed. Self-review (AC-007) done.

## Lifecycle history

- 2026-11-21: Specified after the user accepted the scope in the conversation.
- 2026-11-21: Implemented (verification pending); waiting for the ingest and test run on Node 24.
- 2026-11-21 (second round): gap research after the first push. Four documents added: `ms-back-up-with-file-history`, `at-repaircafes-plattform`, `at-carla-elektrogeraete-reuse`, `at-carla-reparaturcafe` (41 documents, 245 passages in the substitute check). A Vorarlberg donation offer for laptops was not found; the finding is recorded in [RESEARCH.md](./RESEARCH.md). T-005 stays open for the same reason as above.
