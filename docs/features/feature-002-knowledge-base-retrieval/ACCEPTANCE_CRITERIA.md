# Acceptance Criteria: Curated knowledge base and model-aware retrieval

- **Feature ID:** `feature-002-knowledge-base-retrieval`
- **Verification status:** In progress

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001, FR-002 | Given a manifest entry missing its terms note and another missing its URL, when ingestion runs, then it fails and names both documents and the missing fields. | Automated ingestion test | Pass | `retrieval.test.ts` › manifest validation: names `acme-book14-manual: missing terms` and `os-cpu-list: missing url`; `ingestCorpus` throws too and writes no index (2026-11-20, branch `feat/knowledge-base-retrieval`) |
| AC-002 | FR-003 | Given a fixture corpus, when ingestion runs twice, then the passage count and IDs are identical, and each passage carries its section heading or page number. | Automated ingestion test | Pass | `retrieval.test.ts` › chunking and ingestion: two ingests give equal stats and identical passage rows, unique IDs, each with a section or page |
| AC-003 | FR-004 | Given a device whose manufacturer and model differ from the manifest only in case and whitespace, or match a listed alias, then it is matched. A near-miss variant not listed as an alias is not matched. | Automated unit test | Pass | `retrieval.test.ts` › model normalization and aliases: case/whitespace, manufacturer alias, machine-type alias, and product_version match; `Book 14s` and an alias prefix do not |
| AC-004 | FR-005 | Given a fixture corpus with model A and model B documents, when retrieving for model A on every path, then no returned passage comes from a model-B-only document, and generic passages are labelled `generic`. | Automated integration test | Pass | `retrieval.test.ts` › AC-004: no `acme-book15-manual` passage for Book 14 on any path (and the reverse); other passages labelled `generic` |
| AC-005 | FR-006 | Given a device model absent from the corpus, when retrieving, then the result has `model_evidence: "none"` and contains only generic passages. | Automated integration test | Pass | `retrieval.test.ts` › AC-005: unknown model, near-miss `Book 14s`, and null identity give `model_evidence: "none"`, `matched_model: null`, generic passages only |
| AC-006 | FR-007 | Given any retrieval result, every passage has a non-empty document ID, title, URL, section or page, applicability, access date, and text. | Automated integration test over all paths of the fixture devices | Pass | `retrieval.test.ts` › AC-006: all fields non-empty, `checkPassage` (section or page) passes, results validate against the `RetrievalResult` schema |
| AC-007 | FR-008 | Given a model-specific fixture device, when retrieving for upgrade and for recycle, then the top passages differ and each comes from a document whose topic suits its path. | Automated integration test | Pass | `retrieval.test.ts` › AC-007: upgrade's top passage is from the model manual (memory, storage), recycle's from the e-waste guide, no overlap; every passage topic is allowed for its path |
| AC-008 | FR-009 | Given the real curated corpus, for each chosen demo model there is at least one model-specific `repair-hardware` document and one `software-support` document covering its CPU, each with a terms note. | Manifest review, plus an automated manifest coverage check | Not run | |
| AC-009 | FR-005, FR-007 | Given a real scan of each available demo laptop, when retrieving for upgrade, then at least one returned passage is from that model's service documentation and its citation resolves to the stated source section. | Manual check, recording the scan JSON and the passages | Not run | |
| AC-010 | Review | The final diff and the manifest's terms notes are self-reviewed, with findings recorded below. | Self-review | Not run | |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review (see [PLAN.md § Review and integration](./PLAN.md#review-and-integration)). Demo models chosen 2026-11-20; AC-008 waits for the curated corpus, AC-009 for real scans of the demo laptops. Not yet reviewed.

## Verification notes

Not yet verified.
