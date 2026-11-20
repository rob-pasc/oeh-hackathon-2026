# Acceptance Criteria: Curated knowledge base and model-aware retrieval

- **Feature ID:** `feature-002-knowledge-base-retrieval`
- **Verification status:** Not started

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001, FR-002 | Given a manifest entry missing its terms note and another missing its URL, when ingestion runs, then it fails and names both documents and the missing fields. | Automated ingestion test | Not run | |
| AC-002 | FR-003 | Given a fixture corpus, when ingestion runs twice, then the passage count and IDs are identical, and each passage carries its section heading or page number. | Automated ingestion test | Not run | |
| AC-003 | FR-004 | Given a device whose manufacturer and model differ from the manifest only in case and whitespace, or match a listed alias, then it is matched. A near-miss variant not listed as an alias is not matched. | Automated unit test | Not run | |
| AC-004 | FR-005 | Given a fixture corpus with model A and model B documents, when retrieving for model A on every path, then no returned passage comes from a model-B-only document, and generic passages are labelled `generic`. | Automated integration test | Not run | |
| AC-005 | FR-006 | Given a device model absent from the corpus, when retrieving, then the result has `model_evidence: "none"` and contains only generic passages. | Automated integration test | Not run | |
| AC-006 | FR-007 | Given any retrieval result, every passage has a non-empty document ID, title, URL, section or page, applicability, access date, and text. | Automated integration test over all paths of the fixture devices | Not run | |
| AC-007 | FR-008 | Given a model-specific fixture device, when retrieving for upgrade and for recycle, then the top passages differ and each comes from a document whose topic suits its path. | Automated integration test | Not run | |
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

Completion boundary: locally verified handoff with self-review (see [PLAN.md § Review and integration](./PLAN.md#review-and-integration)). AC-008 and AC-009 cannot run until the demo models are chosen. Not yet reviewed.

## Verification notes

Not yet verified.
