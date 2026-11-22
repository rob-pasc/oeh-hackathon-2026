# ADR-008: Search the web through a provider-neutral adapter, LangSearch first and TinyFish as fallback

- **Status:** Accepted
- **Date adopted:** 2026-11-22
- **Related feature(s):** [017](../features/feature-017-web-evidence-for-model-facts/PLAN.md) (web evidence for model facts); reused by [018](../features/feature-018-part-lookup/PLAN.md) and [019](../features/feature-019-eu-prices-and-local-offers/PLAN.md) once they are built
- **Supersedes:** None. It narrows [ADR-004](adr-004-keyword-retrieval-sqlite-fts5.md): corpus retrieval stays keyword-only and runs first; web search only fills topics the corpus does not cover.

## Context

The curated corpus covers three laptop models. For every other laptop the rule gates ignore hardware facts, so most paths read "cannot verify". The user chose on 2026-11-22 to fill those gaps from the web, with free search plans that need no credit card, and asked for an adapter so that providers can be switched later. Facts from the web must stay citable, and the search must not send personal data.

## Decision

- The server searches through the provider-neutral interface `SearchProvider.search(query, signal)` in `server/src/search/`. It returns `{ title, url, text, published }` hits or throws `SearchError` with a `kind` (`config`, `auth`, `rate_limited`, `timeout`, `unavailable`, `bad_response`). A provider is one implementation plus an entry in `PROVIDERS` (`config.ts`).
- **LangSearch** is the primary provider: its Web Search API returns page text with each result (`contents.text`). **TinyFish** is the fallback: its Search API returns snippets, so the top results' text comes from its Fetch API. The order is configurable (`SEARCH_PROVIDER`, `SEARCH_FALLBACK`).
- The **server decides when to search**, not the LLM: only for fact topics without a model-specific corpus passage. The query is the manufacturer, the model and fixed topic words.
- Web results enter the existing pipeline as `Passage`s with `source: "web"`, so citations, the citation check and the report display work unchanged. A result counts only if it names the exact model as whole tokens, and the fact extraction must confirm each web passage.
- Results are cached per model and topic for 30 days in SQLite; fresh searches are capped per UTC day (`SEARCH_DAILY_CALLS`); the search phase has one deadline (`SEARCH_TIMEOUT_MS`, default 20 s), with half for the first provider.

## Alternatives considered

| Alternative | Benefits | Why not chosen |
| ----------- | -------- | -------------- |
| LLM tool calling (DeepSeek function calling with a search tool) | The model picks queries and when to search | Extra round trips and less predictable cost and latency; harder to keep queries free of scan data and to cache per model |
| Tavily, Exa or Serper | LLM-oriented results (Tavily, Exa) or Google results (Serper), free credits without a card | The team already had LangSearch and TinyFish keys; Serper returns snippets only. The adapter keeps them as later options |
| Brave Search API | Independent index, good quality | Requires a credit card since early 2026, even for the free credit |
| Writing web pages into the corpus | One evidence path | Uncurated pages would lose the corpus's manifest review; excluded by feature 017 |

## Consequences

- Laptops outside the corpus can get assessed upgrade and repair paths, labelled "Web source" and with confidence lowered one level (`model_evidence: "web"`).
- A first assessment of an uncovered model takes longer: in the live run on 2026-11-22, about 20 s for a ThinkPad T470 including search and extraction, against 0.03 s once cached. LangSearch answered in about 4.5 s and TinyFish (search and fetch) in about 8.7 s.
- Two more third-party services receive manufacturer, model and topic. The privacy notice names them. Neither provider documents its data retention or hosting region.
- Wrong web facts are reduced by the model match, the LLM confirmation and the battery rule, but not ruled out.
- Operational: two more keys to configure and rotate; LangSearch's daily token limit is not documented, so the daily cap and the fallback guard against it.

## Implementation / validation references

- Code: `server/src/search/` (`types.ts`, `langsearch.ts`, `tinyfish.ts`, `config.ts`, `cache.ts`, `evidence.ts`), `server/src/assessment/service.ts`, `server/src/facts/` (web rules, rejected passages, battery rule).
- Tests: `server/test/search.test.ts`; `web/src/test/web-sources.test.tsx`.
- Live check: `npm run search:smoke -w server` (results in `server/README.md`), and the end-to-end run recorded in the feature 017 acceptance criteria.

## Supersession notes (if applicable)

None.
