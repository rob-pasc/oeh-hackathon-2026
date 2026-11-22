# Feature 002: Curated knowledge base and model-aware retrieval

- **Feature ID:** `feature-002-knowledge-base-retrieval`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-20

## Summary

A small, hand-curated corpus of repair, upgrade, operating-system support, environmental, and circular-economy documents. Each document is tagged with its source and the device models it applies to. A retrieval module takes a scanned device (feature 001) and one of the five candidate paths. It returns relevant passages with full citation metadata, filtering on the exact manufacturer and model before semantic search, so that procedures for one laptop are never presented as evidence for another.

This is what lets the system know things rules alone cannot: soldered RAM, user-replaceable batteries, supported OS versions. It feeds the assessment (feature 003) and the explanations (feature 004).

## Problem and desired outcome

- **Problem:** Generic advice such as "old HDD, so add an SSD" is wrong for many models (soldered RAM, proprietary storage, unsupported CPUs). An LLM without sources can invent compatibility claims.
- **Desired outcome:** For each device model in the corpus and candidate path, the system retrieves citable, model-specific evidence, or states clearly that none exists.
- **Target users / stakeholders:** Indirectly the device owner (trustworthy recommendations); directly features 003 and 004; judges who need to see what retrieval contributes.

## Approved scope

### In scope

- A corpus manifest with required source, licensing, and model metadata per document.
- An ingestion command that chunks documents, keeps section/page locations, and builds a searchable index.
- Retrieval per device and per candidate path, filtered by model metadata before semantic ranking.
- Citation metadata on every passage, and an explicit "no model-specific evidence" result.
- A curated corpus of roughly 20–40 documents covering a few laptop models plus generic environmental, circular-economy, and OS-support sources (target, not a hard requirement).

### Out of scope

- Web-scale or automatic ingestion, crawling, or live web search. *(2026-11-22: "live web search" no longer holds; see the note under Related and superseded features. Ingestion and crawling stay excluded.)*
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
- ~~**FR-009:** For each chosen demo model, the corpus contains at least one model-specific repair/upgrade source and one OS-support source that covers its CPU.~~ *(Removed 2026-11-21: no demo models, see the scope change log.)*

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

Adopted during implementation (2026-11-20) unless marked otherwise.

- **Contract (adopted 2026-11-20):** `Passage` and `RetrievalResult` in [`shared/src/retrieval.ts`](../../../shared/src/retrieval.ts), with passages grouped per path in `passages_by_path`. See [ADR-001](../../adr/adr-001-shared-contracts-typebox.md).
- **Location:** `corpus/manifest.yaml` plus Markdown extracts in `corpus/docs/`; code in `server/src/retrieval/`; the ingestion command is `npm run corpus:ingest -w server` (`server/scripts/corpus-ingest.ts`).
- **Manifest (adopted):** `manufacturers` (canonical name + aliases), `models` (canonical manufacturer/model, exact `aliases`, optional `demo` and `cpus` for the coverage check), and `documents` with the FR-001 fields plus `file`. Documents reference models by canonical name only; every declared model needs at least one document, and aliases may not collide. Format details: [`corpus/README.md`](../../../corpus/README.md).
- **Documents (user decision 2026-11-20):** Markdown extracts only, no PDF parsing. Each extract holds short verbatim quotations under `##` headings that name the source's own sections, with `<!-- page: N -->` markers for PDF pages, and links to the original. No `pdf-parse` dependency.
- **Chunking (adopted):** A passage never spans a heading or page marker, so it cites one section and page. Paragraphs are packed up to about 1,000 characters and split at sentence ends only when one paragraph is longer. No overlap: the extracts are short quotations, and overlap would make two passages cite the same text. Passage IDs are `<document>#<section-slug>-<n>`, which is stable for an unchanged corpus.
- **Index (adopted):** A separate SQLite file (default `server/data/corpus.sqlite`, `CORPUS_INDEX_PATH`), rebuilt in one transaction and written to a temporary file that replaces the old one, so a failed ingestion leaves the previous index untouched. Built-in `node:sqlite`, no new dependency. The FTS5 table indexes the document title (weight 0.5), the section (2) and the text (1); the title gives table rows such as Microsoft's "8th Generation Core i5 Processors" their "Windows 11" context. The server image builds the index at image build time (`server/Dockerfile`, `CORPUS_INDEX_PATH=/app/corpus-index/corpus.sqlite`).
- **Matching (adopted):** Names are normalized (NFKC, lower case, collapsed whitespace). The device's manufacturer must equal a canonical name or alias, and its `model` or `product_version` must equal a canonical model name or alias. No prefix or fuzzy matching.
- **Search (user decision 2026-11-20, T-002):** Keyword-only. SQL filters by topic and applicability first (generic documents plus documents for the exact matched model), then FTS5 BM25 ranks the rest, with the Porter stemmer. Each path has allowed topics and several keyword facets (`PATH_QUERIES` in `retrieve.ts`), for example memory, storage, and Windows 11 for upgrade. Facets are ranked separately and interleaved round-robin, so an aspect with many matching words cannot crowd out the others; this was needed on the real corpus, where one combined query returned only Windows 10 end-of-support passages for pass on. The Windows 11 device facet requires a Windows 11 term AND a device term: the matched model's name (vendor lists such as Lenovo's "T480") or the Intel CPU model number and generation (Microsoft's list names generations, for example "8th Generation", not model numbers). Trailing-`*` prefix terms handle German compounds (`elektroaltger*`). Model-specific passages get a 1.5× score boost over equally relevant generic ones. There are no embeddings; they can be added behind the same retriever interface if keyword ranking proves too weak.
- **k:** 5 passages per path by default (`DEFAULT_K`), configurable per call. Raised from the proposed 4 so pass on (four facets) also gets a second Windows 11 passage; at most 25 passages go to fact extraction.
- **Wiring:** No route calls the retriever yet; the assessment API (feature 003 T-007) will open it with `openRetriever(path)`.
- **Tests:** `server/test/retrieval.test.ts` covers manifest validation, chunking, idempotent ingestion, normalization and aliases, cross-model isolation, the `none` case, citation completeness, path-specific queries, and the coverage check, using the fixture corpus in `server/test/fixtures/corpus/` (fictional models Acme Book 14 and Book 15). `server/test/corpus.test.ts` checks the real corpus: manifest validity, demo models, coverage with its known gap, model isolation, the Windows 11 passages, the T480s near miss, and timing.
- **Real corpus (2026-11-20):** 31 documents, 197 passages: 5 per demo model (service manual or equivalent, spec sheet, iFixit guides, vendor Windows 11 or BIOS support pages) and 16 generic (Microsoft Windows 11 and Windows 10 support pages, reset, Austrian Geräte-Retter-Prämie, EU repair directive, PCs für alle, Austrian e-waste and battery pages, WEEE, Global E-waste Monitor, EPA, Umweltbundesamt). Every extract was checked against the fetched source text. Research notes, gaps, and terms decisions are in [`RESEARCH.md`](./RESEARCH.md).

## Dependencies and risks

- ~~**Resolved:** The demo models were chosen on 2026-11-20 (see Assumptions and open questions). Real scans are still needed to confirm their identity strings and aliases.~~ *(2026-11-21: no demo models.)*
- **Dependency:** Feature 001 device schema (`manufacturer`, `model`).
- **Risk:** Manufacturer documents may forbid redistribution. Mitigation: store only short extracts with links, or choose other sources; record this in the terms note.
- **Risk:** Windows model strings are inconsistent (machine-type codes, OEM names). Mitigation: an explicit alias list, extended from real scans of the team's laptops.
- **Risk:** Local embedding quality may be weak. Mitigation: metadata filtering does most of the work; add keyword scoring if needed.

## Review and integration

- **Completion boundary:** Locally verified handoff with self-review.
- **Review:** Self-review of the diff and of the manifest's terms notes, recorded in `ACCEPTANCE_CRITERIA.md`.
- **CI/merge:** CI ([`.github/workflows/ci.yaml`](../../../.github/workflows/ci.yaml), added by feature 005 on 2026-11-20) runs the workspace checks and the scanner's Go checks on pull requests and pushes to `main`. Server tests and type checks must pass locally. Pushing and merging need user authorization.

## Release and recovery (when applicable)

Not applicable to this feature: the index is shipped with the deployment owned by feature 005.

## Assumptions and open questions

- **Resolved (2026-11-20, user decision):** The demo models are Lenovo ThinkPad T480 (upgradeable: two SO-DIMM slots, 8th-gen CPU), Dell XPS 13 9360 (soldered memory, mostly 7th-gen CPUs), and HP EliteBook 840 G5 (upgradeable, 8th gen). Physical access for the live demo and real scans (AC-009) is not yet confirmed. *(2026-11-21: the demo models were dropped; the three models stay in the corpus as ordinary models. See the scope change log.)*
- **Resolved (2026-11-20, user decision):** Keyword BM25 over built-in SQLite FTS5, no embeddings; and Markdown extracts, no PDF parsing.
- **Adopted:** *k* = 5 per path (see the technical approach); revisit once fact extraction runs on the real corpus.
- **Accepted (coverage gap, 2026-11-21):** No fetched source states whether Windows 11 supports the 7th-gen CPUs (i5-7200U, i5-7300U) that some EliteBook 840 G5 units shipped with. HP's Windows 11 tested list could not be fetched. Options: add HP's list once reachable, or accept the gap (those units get "cannot verify" for Windows 11). AC-008 fails until one is chosen. *(2026-11-21: the gap is accepted, those units get "cannot verify" for Windows 11; AC-008 was removed with FR-009.)*
- Assumption: Documents can be stored as text extracts in the repository where their terms allow; otherwise only metadata and a short quotation are stored.

## Scope change log

| Date       | Change                 | User approval                                                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Initial approved scope | User replied "accept" to the five-feature MVP proposal in the specification conversation, 2026-11-20 |
| 2026-11-21 | No demo models: FR-009, AC-008 and T-006 removed; AC-009 now uses real scans of the team's own laptops instead of the demo laptops. The 840 G5 7th-gen CPU gap is accepted. The three models stay in the corpus and its tests. | User replied "accept, just remove those entries for the demo models" to the proposal in the task review conversation, 2026-11-21 |

## Related and superseded features

**Exclusion "live web search" replaced by [feature 017](../feature-017-web-evidence-for-model-facts/PLAN.md#related-and-superseded-features)** (implemented 2026-11-22 on `main` in f1331e6 "feat(server): search the web for facts the corpus does not cover" and d3c9256 "feat(web): label web sources and show the web search line"; not pushed). When this retrieval finds no model-specific passage for a fact topic, the assessment searches the web for the exact model and adds labelled web passages. FR-001 to FR-008 stay in force: corpus retrieval runs first and unchanged, and web pages are never written into the corpus. ([ADR-008](../../adr/adr-008-web-search-adapter.md))

Depends on [feature 001](../feature-001-device-scan-and-upload/PLAN.md) (device schema). Consumed by [feature 003](../feature-003-five-path-ranking/PLAN.md) and [feature 004](../feature-004-explained-report/PLAN.md).

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: [ADR-001](../../adr/adr-001-shared-contracts-typebox.md) (contracts), [ADR-004](../../adr/adr-004-keyword-retrieval-sqlite-fts5.md) (keyword retrieval over SQLite FTS5)
- Terms: [`docs/GLOSSARY.md`](../../GLOSSARY.md)
