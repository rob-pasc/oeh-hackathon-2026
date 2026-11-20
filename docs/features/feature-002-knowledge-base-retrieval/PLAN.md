# Feature 002: Curated knowledge base and model-aware retrieval

- **Feature ID:** `feature-002-knowledge-base-retrieval`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-20

## Summary

A small, hand-curated corpus of repair, upgrade, operating-system support, environmental, and circular-economy documents. Each document is tagged with its source and the device models it applies to. A retrieval module takes a scanned device (feature 001) and one of the five candidate paths. It returns relevant passages with full citation metadata, filtering on the exact manufacturer and model before semantic search, so that procedures for one laptop are never presented as evidence for another.

This is what lets the system know things rules alone cannot: soldered RAM, user-replaceable batteries, supported OS versions. It feeds the assessment (feature 003) and the explanations (feature 004).

## Problem and desired outcome

- **Problem:** Generic advice such as "old HDD, so add an SSD" is wrong for many models (soldered RAM, proprietary storage, unsupported CPUs). An LLM without sources can invent compatibility claims.
- **Desired outcome:** For each demo model and candidate path, the system retrieves citable, model-specific evidence, or states clearly that none exists.
- **Target users / stakeholders:** Indirectly the device owner (trustworthy recommendations); directly features 003 and 004; judges who need to see what retrieval contributes.

## Approved scope

### In scope

- A corpus manifest with required source, licensing, and model metadata per document.
- An ingestion command that chunks documents, keeps section/page locations, and builds a searchable index.
- Retrieval per device and per candidate path, filtered by model metadata before semantic ranking.
- Citation metadata on every passage, and an explicit "no model-specific evidence" result.
- A curated corpus of roughly 20–40 documents covering the 2–3 chosen demo models plus generic environmental, circular-economy, and OS-support sources (target, not a hard requirement).

### Out of scope

- Web-scale or automatic ingestion, crawling, or live web search.
- Fuzzy matching across model variants (for example treating "T480s" as "T480").
- Extracting structured facts from passages (feature 003) and writing explanations (feature 004).
- A user-facing search interface.
- Ongoing corpus maintenance or update tooling beyond re-running ingestion.

## Functional requirements

- **FR-001:** A corpus manifest lists every document with: ID, title, source URL, publisher, access date, terms/licence note, topic (`repair-hardware`, `software-support`, `environmental`, `circular-economy`), and applicability (a list of manufacturer + model entries, or `generic`).
- **FR-002:** Ingestion rejects, and names, any document whose manifest entry is missing a required field, including the terms/licence note.
- **FR-003:** Ingestion splits documents into passages that keep their section heading or page number, and builds an index. Re-running ingestion on an unchanged corpus produces the same passages, without duplicates.
- **FR-004:** Device manufacturer and model are normalized (case, whitespace, and an explicit alias list in the manifest) before matching. Only exact matches after normalization count as model-specific.
- **FR-005:** Given a device and a candidate path (upgrade, repair, pass it on, salvage, recycle), retrieval returns up to *k* passages. Model-specific passages may only come from documents applicable to that exact model. Generic passages may be included but are labelled `generic`.
- **FR-006:** When no model-specific document matches the device, the retrieval result carries `model_evidence: "none"` and returns only generic passages.
- **FR-007:** Every returned passage includes the document ID, title, URL, section or page, applicability (model or `generic`), access date, and passage text.
- **FR-008:** Each candidate path uses its own path-specific query, so the five paths get different, relevant passages for the same device.
- **FR-009:** For each chosen demo model, the corpus contains at least one model-specific repair/upgrade source and one OS-support source that covers its CPU.

## Non-functional requirements and constraints

- **Legal:** Only ingest documents whose terms allow our use; record the basis in the manifest's terms note. Prefer linking with short quotations over copying large texts into the repository.
- **Performance:** Retrieval for all five paths of one device should take under 3 seconds on the demo host.
- **Reliability:** The index is built ahead of time and stored with the deployment, not built at request time.
- **Traceability:** Passages must be stable enough that a citation in feature 004 can be followed back to the source section.

## User journeys and edge cases

1. **Known model:** A scanned demo laptop matches its manifest entry. The upgrade query returns service-manual passages about memory and storage, and the recycle query returns generic e-waste guidance.
2. **Alias:** The scanner reports `"LENOVO"` / `"20L5CTO1WW"` (a machine type) while the manifest says `Lenovo ThinkPad T480`. The alias list maps the machine type to the model.
3. **Unknown model:** A laptop not in the corpus gets `model_evidence: "none"` with only generic passages. Feature 003 must then mark compatibility-dependent claims "cannot verify".
4. **Near-miss variant:** A model similar to a corpus model but not the same is treated as unknown, not matched.
5. **Bad manifest:** A new document without a terms note makes ingestion fail with a clear message.

## Proposed technical approach

Not yet adopted; to be confirmed during implementation.

- **Location:** `corpus/manifest.yaml` plus source files or extracts in `corpus/docs/`; retrieval code in `server/src/retrieval/`.
- **Ingestion:** A Node script parses Markdown, HTML, and PDF (for example with `pdf-parse`), chunks by heading or page with overlap, and writes passages and embeddings to SQLite.
- **Search:** Metadata filtering in SQL first, then ranking of the remaining passages. Because the corpus is tiny, a brute-force cosine similarity in process is enough; no separate vector database. Possibly combined with keyword (BM25/FTS5) scoring for exact part names.
- **Embeddings:** **Open.** Options are a local model through `transformers.js` (no extra API key, works offline) or a hosted embedding API. Anthropic offers no embedding endpoint, so a hosted option means an extra provider. Proposed default: a local model, for offline robustness.
- **Tests:** Unit tests for manifest validation, normalization and aliases, and deterministic chunking. Integration tests with a small fixture corpus of two fake models, checking cross-model isolation and the `none` case.

## Dependencies and risks

- **Blocking:** The 2–3 demo laptop models are not chosen yet. FR-009, the alias list, and corpus curation cannot be completed without them. The other tasks can proceed with the fixture corpus.
- **Dependency:** Feature 001 device schema (`manufacturer`, `model`).
- **Risk:** Manufacturer documents may forbid redistribution. Mitigation: store only short extracts with links, or choose other sources; record this in the terms note.
- **Risk:** Windows model strings are inconsistent (machine-type codes, OEM names). Mitigation: an explicit alias list built from real scans of the demo laptops.
- **Risk:** Local embedding quality may be weak. Mitigation: metadata filtering does most of the work; add keyword scoring if needed.

## Review and integration

- **Completion boundary:** Locally verified handoff with self-review.
- **Review:** Self-review of the diff and of the manifest's terms notes, recorded in `ACCEPTANCE_CRITERIA.md`.
- **CI/merge:** No CI yet. Server tests and type checks must pass locally. Pushing and merging need user authorization.

## Release and recovery (when applicable)

Not applicable to this feature: the index is shipped with the deployment owned by feature 005.

## Assumptions and open questions

- **Blocking:** Which 2–3 demo laptop models? Ideally one upgradeable model, one with soldered RAM or another hard limitation, and access to at least one physically for the live demo (see Suggestions.md §9).
- **Open:** Embedding approach (local versus hosted). Proposed default: local.
- **Open:** The value of *k* per path. Proposed default: 4.
- Assumption: Documents can be stored as text extracts in the repository where their terms allow; otherwise only metadata and a short quotation are stored.

## Scope change log

| Date       | Change                 | User approval                                                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Initial approved scope | User replied "accept" to the five-feature MVP proposal in the specification conversation, 2026-11-20 |

## Related and superseded features

None superseded. Depends on [feature 001](../feature-001-device-scan-and-upload/PLAN.md) (device schema). Consumed by [feature 003](../feature-003-five-path-ranking/PLAN.md) and [feature 004](../feature-004-explained-report/PLAN.md).

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: None yet
- Terms: [`docs/GLOSSARY.md`](../../GLOSSARY.md)
