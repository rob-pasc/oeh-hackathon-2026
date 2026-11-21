# ADR-004: Keyword retrieval over SQLite FTS5 from curated Markdown extracts

- **Status:** Accepted
- **Date adopted:** 2026-11-20 (user decision; recorded as an ADR on 2026-11-21)
- **Related feature(s):** [002](../features/feature-002-knowledge-base-retrieval/PLAN.md) (owner), [003](../features/feature-003-five-path-ranking/PLAN.md), [008](../features/feature-008-ai-categories-and-options/PLAN.md) and [010](../features/feature-010-step-level-knowledge-base/PLAN.md) (consumers)
- **Supersedes:** None

## Context

Every technical claim leaf makes must cite a passage from a curated knowledge base: manuals, repair guides, vendor and Microsoft support pages, regulations. The corpus is small (31 documents at adoption, 41 after feature 010) and focused on three demo models. Retrieval must be exact about which model a document applies to, give stable citable passage IDs, run inside the server without extra services, and stay cheap to rebuild when the corpus changes.

## Decision

- **Source format:** The corpus is a set of Markdown extracts with short verbatim quotations under headings that name the source's sections, plus page markers for PDFs. No PDF parsing at run time.
- **Model matching:** A manifest (`corpus/manifest.yaml`) declares manufacturers, models with exact aliases, and documents with their topic and applicability. Matching a device to a model is exact after normalization, with no fuzzy matching.
- **Index:** Ingestion chunks each section into passages with stable IDs and writes them to a separate SQLite file using the built-in FTS5 extension. The file is rebuilt atomically.
- **Ranking:** Retrieval is keyword-only. SQL filters by topic and applicability, then BM25 (Porter stemmer) ranks passages per path and keyword facet, interleaved round-robin. No embeddings and no vector store.

## Alternatives considered

| Alternative | Benefits | Why not chosen |
| ----------- | -------- | -------------- |
| Embeddings with a vector store, or local embeddings | Semantic matches beyond shared words | Another model or service to run and pay for; quality uncertain on a small, technical corpus; metadata filtering already does most of the work |
| Parse the original PDFs at ingestion | No hand-made extracts | A new dependency and noisy text; extracts let every quotation be checked against the source |
| Fuzzy or prefix model matching | Fewer missed devices | Risks citing a sibling model's manual (for example T480 versus T480s); a miss reads "cannot verify" instead |

## Consequences

- No new runtime dependency or external service; the index ships inside the server image.
- **Weakness:** Queries must share words with the passage, so path queries are hand-tuned facets (`PATH_QUERIES` in `server/src/retrieval/retrieve.ts`). Synonyms or wording outside them can be missed.
- **Upkeep:** The corpus is curated by hand. Each new document needs an extract and a manifest entry, and new demo models need aliases confirmed from real scans.
- Exact matching means an unlisted model gets `model_evidence: "none"` and generic passages only.

## Implementation / validation references

- `server/src/retrieval/` (manifest, chunking, ingestion, retrieval), `npm run corpus:ingest -w server`
- Tests: `server/test/retrieval.test.ts`, `server/test/corpus.test.ts`
- Corpus conventions: [`corpus/README.md`](../../corpus/README.md); research notes in the feature 002 and 010 `RESEARCH.md` files

## Supersession notes (if applicable)

None.
