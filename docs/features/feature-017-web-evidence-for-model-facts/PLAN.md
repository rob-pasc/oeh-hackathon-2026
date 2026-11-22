# Feature 017: Web evidence for model facts

- **Feature ID:** `feature-017-web-evidence-for-model-facts`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-22

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

The curated corpus (feature 002) covers three laptop models, so for almost every real scan retrieval finds no model-specific evidence, the rule gates ignore the hardware facts, and most paths read "cannot verify". This feature lets the server search the web when the corpus has no evidence for the scanned model and a fact topic, and feed the found pages into the existing fact extraction as citable passages. Web facts count like corpus facts, but every claim from the web is labelled **Web source** with its link, and a web page can never unlock self-replacement of the battery.

The feature also introduces a provider-independent search adapter (LangSearch first, TinyFish as fallback) and a per-model cache, which features 018 and 019 reuse. It is the first of three web search features approved together on 2026-11-22.

## Problem and desired outcome

- **Problem:** For laptops outside the three corpus models, leaaf cannot verify RAM, storage, battery or software-support facts, so upgrade and repair paths read "cannot verify" even when the answer is a search away.
- **Desired outcome:** For a laptop the corpus does not cover, the result screen shows assessed paths backed by cited, labelled web pages about that exact model; if nothing usable is found, the result is the same as today.
- **Target users / stakeholders:** Owners of old laptops scanned with leaaf; the hackathon team and judges (more real laptops get a meaningful result).

## Approved scope

### In scope

- A web search step in the assessment, run only for fact topics without corpus model evidence.
- A `SearchProvider` adapter with LangSearch (primary) and TinyFish (fallback) implementations, selected by configuration.
- A server-side model-match check plus an LLM confirmation before a web page can support a fact.
- Web facts counting as model evidence for the gates, with the battery exception (FR-006).
- A **Web source** label with link and retrieval date wherever a web passage is cited.
- A cache of search results per normalized model and topic (30 days), a daily search cap, a timeout, and a fallback to today's behavior.
- A "Searching the web…" phrase on the result screen's thinking line while searches run.
- A live smoke script, documentation (server README, `.env` templates, deployment guide, privacy notice DE/EN) and an ADR for the search adapter once adopted.

### Out of scope

- Letting the LLM decide when or what to search (tool or function calling).
- Writing web results into the curated corpus or its manifest.
- Web search for anything other than the fact topics of feature 003 (part lookup is feature 018, prices and local offers feature 019).
- Searching when the corpus already has model evidence for the topic ("always search" was declined 2026-11-22).
- Unlocking `battery_user_replaceable` from web pages.

## Functional requirements

- **FR-001:** When search is configured and retrieval finds no model-specific passage for a device and a fact topic (memory, storage, battery, software support), the server runs a web search for the device's manufacturer, model and that topic. Topics with corpus model evidence are not searched.
- **FR-002:** Searches go through one provider interface. The configured primary provider (LangSearch by default) is asked first; the fallback provider (TinyFish by default) is asked when the primary fails, is rate-limited, times out, or returns no usable result. Which provider is primary or fallback is set by configuration, without code changes in the assessment.
- **FR-003:** A search result is kept only when its title or text contains the device's normalized model name as a whole token (for example "T480" does not match a page that only names "T480s"). Other results are discarded before fact extraction.
- **FR-004:** Kept web results are passed to fact extraction as passages marked as web sources. The extraction must confirm for each web passage that it describes the exact model; a fact is dropped when every passage it cites is a web passage the extraction did not confirm.
- **FR-005:** Facts supported by confirmed web passages count as model evidence for the rule gates, exactly like facts from corpus passages (subject to FR-006).
- **FR-006:** A `battery_user_replaceable: true` fact supported only by web passages is dropped. A `battery_user_replaceable: false` fact from web passages is kept. Web facts can therefore make the battery path more cautious but never unlock self-replacement. *(Clarified during implementation 2026-11-22: a `true` fact citing a web passage is also dropped when its other citations are only generic passages; it needs a curated passage about the exact model. See the scope change log.)*
- **FR-007:** Wherever the result screen cites a passage (option cards, step plans, plan card, fallback path cards), a web passage is shown with the label **Web source**, the page title, a link to its URL and the date it was retrieved.
- **FR-008:** Search results are cached per normalized model and topic for 30 days. A later scan of the same model within that time uses the cache and makes no provider call; after 30 days the next scan searches again.
- **FR-009:** Fresh provider calls are capped per UTC day by `SEARCH_DAILY_CALLS`. When the cap is reached, no further search runs that day and the assessment continues as without search.
- **FR-010:** The web search phase of one assessment has a deadline (`SEARCH_TIMEOUT_MS`). When it expires, the assessment continues with the results found so far; topics without usable results read "cannot verify" as today.
- **FR-011:** Without a configured provider key, the server starts normally, logs once that web search is off, and assesses exactly as before this feature.
- **FR-012:** Search queries contain only the manufacturer, model and topic terms, never other scan data. The privacy notice (German and English) names LangSearch and TinyFish, what is sent to them, and that no personal data is sent.
- **FR-013:** While web searches for a device run, the result screen's thinking line shows "Searching the web…" (German: „Suche im Web…“). *(2026-11-22: the result screen exists only in English, so only the English phrase is implemented; see the open questions.)*
- **FR-014:** A `search:smoke` script runs a live search against each configured provider with the keys in `server/.env` and reports the number of results, kept results after the model match, and errors.
- **FR-015** *(added during implementation 2026-11-22)*: When only web pages give model evidence (`model_evidence: "web"`), the confidence of upgrade, repair and salvage drops one level, with the reason "Model-specific facts come from web pages, not from the curated knowledge base". *(Pending the user's confirmation; see the scope change log.)*

## Non-functional requirements and constraints

- **Privacy:** Only manufacturer, model and topic go to the providers (FR-012); no device ID, no other scan values. The cache is keyed by model, not by device, and holds no personal data, so it is not subject to the 30-day scan deletion; it expires on its own after 30 days.
- **Security:** Provider keys live only in the server environment (`server/.env`, `deploy/.env`), never in the web bundle or logs. Fetched page text is untrusted input: it is passed to the LLM as data in the existing passage format, and the existing citation check (only retrieved passage IDs may be cited) applies unchanged.
- **Performance:** A cold scan of a new model may take up to `SEARCH_TIMEOUT_MS` (default 20 s) longer before facts are extracted; cached models add no delay. In the live run on 2026-11-22 the whole report stream for an uncovered ThinkPad T470 took 19.6 s cold and 0.03 s cached. LangSearch's free plan allows 5 requests per second; TinyFish personal accounts 30 search requests per minute, and Fetch 150 URLs per minute and 1,000 URLs per day.
- **Cost:** Free plans only (LangSearch free plan, TinyFish free daily allowance of 12,000 searches). At most 5 searches per new model (proposed), plus fallback calls.
- **Compatibility:** The `Passage` and `RetrievalResult` contracts in `shared/` change additively (ADR-001); corpus passages and the three corpus models behave as before.

## User journeys and edge cases

1. **Uncovered model, results found:** A Lenovo ThinkPad T470 is scanned. The corpus has no T470 documents. The thinking line shows "Searching the web…"; LangSearch returns a Lenovo PSREF page and an iFixit guide naming "T470". RAM and storage facts are extracted from them, the upgrade options become assessable, and their citations read "Web source · psref.lenovo.com · retrieved 2026-11-22".
2. **Sibling-model pages only:** For a ThinkPad T480 not in a topic's corpus coverage, the search returns only T480s pages. FR-003 discards them; the topic reads "cannot verify".
3. **Battery page claims easy replacement:** A web page says the battery "is easy to replace". The `true` fact is dropped (FR-006); the battery path keeps the rule-based caution.
4. **Primary provider down:** LangSearch answers 503. TinyFish is asked; its search plus page fetch supplies the passages (FR-002).
5. **Cap or timeout reached:** The assessment continues without web results; paths read "cannot verify" as before this feature (FR-009, FR-010).
6. **Corpus model:** A Dell XPS 13 9360 scan finds corpus evidence for every topic; no search runs (FR-001).
7. **No keys configured (local development):** Behavior is unchanged from before this feature (FR-011).

## Proposed technical approach

**Implemented 2026-11-22** (f1331e6, d3c9256 and the documentation commit; adopted as [ADR-008](../../adr/adr-008-web-search-adapter.md)). The original proposal is kept below, with notes where the implementation differs.

- **Adapter** in `server/src/search/`: `interface SearchProvider { name; search(query: SearchQuery, signal): Promise<SearchHit[]> }` with `SearchHit { title, url, text, published }`. `langsearch.ts` calls `POST https://api.langsearch.com/v1/web-search` (Bearer key) with `contents.text.maxCharacters` (proposed 5,000) so hits carry page text. `tinyfish.ts` calls `GET https://api.search.tinyfish.ai` (`X-API-Key`), which returns snippets only, and then the TinyFish Fetch API (`POST https://api.fetch.tinyfish.ai`) for the top hits' text. *(Checked 2026-11-22: Fetch takes `urls` (at most 10), `format: "markdown"` and `per_url_timeout_ms`; per-URL failures come back with HTTP 200 in `errors[]`, and the snippet is kept then.)* `providerChain` in `config.ts` implements FR-002 (proposed as `withFallback`); LangSearch is asked for 6,000 characters (`SEARCH_MAX_CHARS`). A fake provider for tests implements the same interface.
- **Configuration** (`server/src/search/config.ts`): `SEARCH_PROVIDER` (default `langsearch`), `SEARCH_FALLBACK` (default `tinyfish`, empty or `none` for none), `LANGSEARCH_API_KEY`, `TINYFISH_API_KEY`, `SEARCH_DAILY_CALLS` (default 200), `SEARCH_TIMEOUT_MS` (default 20000; the proposed 8000 was too short, since LangSearch took 4.5 s and TinyFish 8.7 s in the live smoke run, and the first provider gets half), `SEARCH_RESULTS_PER_QUERY` (default 5), `SEARCH_MAX_CHARS` (default 6000). At most 3 usable results per topic become passages, each a 3,000-character window from the first mention of the topic. Model names without a digit are not searched.
- **Where it runs:** in `createAssessmentService`, between retrieval and fact extraction. For each topic with no model-specific passage, build one query (for example `"<manufacturer> <model> RAM slots maximum memory"`), check the cache, call the provider, apply the model-match filter (reusing the normalization in `server/src/retrieval/normalize.ts`), and turn kept hits into passages.
- **Contracts (`shared/`):** `Passage` gains an optional `source: 'corpus' | 'web'` (absent = corpus) and keeps its required fields: `document_id` = `web:<url hash>`, `passage_id` = `web:<url hash>:<topic>`, `publisher` = domain, `section` = page title, `accessed_on` = retrieval date, `applicability` = the device's model. `ModelEvidence` (`model_specific`, `web`, `none`) is shared by `RetrievalResult` and `Assessment`; `ReportStatus` is the new stream event.
- **Extraction:** web passages carry `"source": "web"` in the prompt; only then are the web rules (`WEB_PASSAGE_RULES`) added to the user prompt and the answer schema `WebExtractionAnswer` with `rejected_passage_ids` used, so corpus-only prompts and their cached facts are byte-identical. `filterFacts` removes rejected web citations and drops facts left without one (FR-004) and applies the battery rule (FR-006). After extraction, `finishWebEvidence` keeps only cited web passages and, when the corpus had no model evidence, sets `web` and drops hardware facts that cite no web passage. Without fact extraction (no LLM key) no search runs.
- **Cache and cap:** new additive SQLite tables `search_cache (key, provider, hits_json, created_at)` and `search_daily_usage (day, calls)`, mirroring `llm_daily_usage`. Purely additive; existing data untouched.
- **Thinking line:** implemented as the report stream's `status` event (`{ phase: 'web_search' }`), sent once before the first fresh provider call (not for cache hits); the thinking line shows the fixed phrase until the assessment arrives. A second request for the same model that joins a search already running gets no status event.
- **Web label:** the existing citation components in `web/src/components/` render `source: 'web'` passages with the label, domain and date (FR-007). Mock mode gains one sample web citation.
- **Tests:** fake-provider tests for trigger per topic, fallback chain (error, 429, timeout, empty), model-match filter including sibling models, rejected passages, battery rule, cache hit and expiry, daily cap, deadline, no-key startup; contract tests for the additive schema; web tests for the label and the thinking phrase.
- **ADR:** [ADR-008](../../adr/adr-008-web-search-adapter.md) records the adapter and provider choice.

## Dependencies and risks

- **Dependency:** LangSearch and TinyFish API keys (the team has both; the user put them into the local `server/.env` on 2026-11-22 and will rotate them afterwards).
- **Risk:** LangSearch's free plan meters tokens per day without a documented number; `SEARCH_DAILY_CALLS` and the TinyFish fallback limit the impact of hitting it.
- **Risk:** Wrong web facts. The model-match check, the LLM confirmation and the label reduce but do not rule out errors, for example a page that names the model but describes a different configuration. Accepted with "full trust, labelled" on 2026-11-22.
- **Risk:** Neither provider's documentation states data retention or hosting region; the privacy notice can only state what is sent.
- **Risk:** Slower first results for uncovered models (up to the timeout).
- **Risk:** Prompt injection in page text. Mitigated by the existing structured-output validation and citation check; the LLM cannot trigger actions.

## Review and integration

- **Completion boundary:** Locally verified and merged into `main`, plus a live smoke run (FR-014) with the team's keys. Release to leaaf.green is a separate step the user authorizes later.
- **Review:** Self-review of the final diff against this plan, with the privacy of queries, the battery rule and the model-match filter checked in particular, recorded in `ACCEPTANCE_CRITERIA.md`. Self-review is not independent approval.
- **CI/merge:** `npm run typecheck`, `npm test`, `npm run build` locally; CI on the `main` push must pass. The team works without pull requests, so CI evidence comes from the `main` run. Merging needs the user's request.

## Release and recovery (when applicable)

- **Rollout (later, separately authorized):** set `LANGSEARCH_API_KEY` and `TINYFISH_API_KEY` in `deploy/.env` on the host, then release and deploy as in [`docs/DEPLOYMENT.md`](../../DEPLOYMENT.md). Without keys the feature is off, so the image can be deployed first.
- **Compatibility:** Additive tables only; no change to existing data.
- **Recovery:** Removing the keys and restarting turns search off. Rolling back the image leaves the two new tables unused; they can stay.
- **Post-release checks (later):** a scan of an uncovered model shows Web source citations; the server log shows no key or query text beyond manufacturer, model and topic. Owner: the team member who releases; not part of this feature's completion boundary.

## Assumptions and open questions

- Assumption: one query per topic and at most 5 results are enough to find a spec or service page; to be checked with the smoke script.
- Assumption: LangSearch's `contents.text` returns usable page text for manufacturer spec pages (PSREF, Dell, HP QuickSpecs).
- Resolved: the TinyFish Fetch format (see the technical approach) and the `status` event for FR-013.
- **Open (for the user):** FR-013 names a German phrase, but the result screen has no German version; only the English phrase is implemented. Confirm that this is acceptable or decide whether the German phrase is needed.
- **Open (for the user):** confirm FR-015 (confidence one level lower with web-only evidence) and the FR-006 clarification, both added during implementation.

## Scope change log

| Date       | Change                 | User approval                                                                                                                                                                                            |
| ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-22 | Initial approved scope | User chose "Accept" for the three-feature web search proposal (017–019) in the web search discussion, 2026-11-22, after choosing model facts, full trust with label, LangSearch with TinyFish fallback as an adapter, search only on corpus gaps with cache, server check plus LLM model match, and the battery exception |
| 2026-11-22 | During implementation: FR-015 added (confidence one level lower with web-only evidence, a visible effect of the approved "full trust, labelled" choice) and FR-006 clarified (a generic passage beside a web page cannot unlock a user-replaceable battery). Both are stricter than or consistent with the approved scope; recorded here for the user's confirmation. The default `SEARCH_TIMEOUT_MS` became 20 s instead of the proposed 8 s after the live smoke run. | Pending: to be confirmed by the user |

## Related and superseded features

- **Replacement of an exclusion of [feature 002](../feature-002-knowledge-base-retrieval/PLAN.md):** its out-of-scope item "Web-scale or automatic ingestion, crawling, or live web search" no longer holds for live web search used as fallback evidence. Ingestion and crawling into the corpus stay excluded. feature-002-knowledge-base-retrieval / FR-001–FR-009 remain in force; corpus retrieval runs first and unchanged.
- **Extension of [feature 003](../feature-003-five-path-ranking/PLAN.md)** FR-002 (fact extraction from retrieved passages) and FR-004: passages may now also come from the web, and `model_evidence` can be `web`; the gates themselves do not change.
- **Change to [`docs/PRODUCT.md`](../../PRODUCT.md):** the principle "Evidence over assertion" gains web sources as labelled evidence.
- **Effective since 2026-11-22** on `main` (f1331e6 "feat(server): search the web for facts the corpus does not cover", d3c9256 "feat(web): label web sources and show the web search line"; not pushed). Reciprocal notes are in the feature 002 and 003 plans, the 003 DESIGN confidence rules and the 003 acceptance verification notes; `docs/PRODUCT.md` is updated.
- **Reused by:** [feature 018](../feature-018-part-lookup/PLAN.md) and [feature 019](../feature-019-eu-prices-and-local-offers/PLAN.md) (adapter, cap, cache).

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: [ADR-008](../../adr/adr-008-web-search-adapter.md) (this feature's adapter), [ADR-002](../../adr/adr-002-llm-openai-compatible-deepseek.md) (LLM adapter, the pattern the search adapter follows), [ADR-004](../../adr/adr-004-keyword-retrieval-sqlite-fts5.md) (corpus retrieval), [ADR-007](../../adr/adr-007-gate-cap-for-ai-part-options.md) (gate cap)
- Provider documentation (read 2026-11-22): [LangSearch Web Search API](https://docs.langsearch.com/api/web-search-api.md), [LangSearch limits](https://docs.langsearch.com/limits/api-limits), [TinyFish Search API](https://docs.tinyfish.ai/search-api/reference)
