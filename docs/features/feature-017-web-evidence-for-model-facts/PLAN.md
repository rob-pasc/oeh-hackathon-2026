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
- **FR-006:** A `battery_user_replaceable: true` fact supported only by web passages is dropped. A `battery_user_replaceable: false` fact from web passages is kept. Web facts can therefore make the battery path more cautious but never unlock self-replacement.
- **FR-007:** Wherever the result screen cites a passage (option cards, step plans, plan card, fallback path cards), a web passage is shown with the label **Web source**, the page title, a link to its URL and the date it was retrieved.
- **FR-008:** Search results are cached per normalized model and topic for 30 days. A later scan of the same model within that time uses the cache and makes no provider call; after 30 days the next scan searches again.
- **FR-009:** Fresh provider calls are capped per UTC day by `SEARCH_DAILY_CALLS`. When the cap is reached, no further search runs that day and the assessment continues as without search.
- **FR-010:** The web search phase of one assessment has a deadline (`SEARCH_TIMEOUT_MS`). When it expires, the assessment continues with the results found so far; topics without usable results read "cannot verify" as today.
- **FR-011:** Without a configured provider key, the server starts normally, logs once that web search is off, and assesses exactly as before this feature.
- **FR-012:** Search queries contain only the manufacturer, model and topic terms, never other scan data. The privacy notice (German and English) names LangSearch and TinyFish, what is sent to them, and that no personal data is sent.
- **FR-013:** While web searches for a device run, the result screen's thinking line shows "Searching the web…" (German: „Suche im Web…“).
- **FR-014:** A `search:smoke` script runs a live search against each configured provider with the keys in `server/.env` and reports the number of results, kept results after the model match, and errors.

## Non-functional requirements and constraints

- **Privacy:** Only manufacturer, model and topic go to the providers (FR-012); no device ID, no other scan values. The cache is keyed by model, not by device, and holds no personal data, so it is not subject to the 30-day scan deletion; it expires on its own after 30 days.
- **Security:** Provider keys live only in the server environment (`server/.env`, `deploy/.env`), never in the web bundle or logs. Fetched page text is untrusted input: it is passed to the LLM as data in the existing passage format, and the existing citation check (only retrieved passage IDs may be cited) applies unchanged.
- **Performance:** A cold scan of a new model may take up to `SEARCH_TIMEOUT_MS` (proposed default 8 s) longer before facts are extracted; cached models add no delay. LangSearch's free plan allows 5 requests per second; TinyFish personal accounts 30 requests per minute.
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

Proposal based on repository inspection on 2026-11-22 (revision `dc51543`); not adopted yet.

- **Adapter** in `server/src/search/`: `interface SearchProvider { name; search(query: SearchQuery, signal): Promise<SearchHit[]> }` with `SearchHit { title, url, text, published }`. `langsearch.ts` calls `POST https://api.langsearch.com/v1/web-search` (Bearer key) with `contents.text.maxCharacters` (proposed 5,000) so hits carry page text. `tinyfish.ts` calls `GET https://api.search.tinyfish.ai` (`X-API-Key`), which returns snippets only, and then the TinyFish Fetch API (`POST https://api.fetch.tinyfish.ai`) for the top hits' text; the Fetch API's parameters are still to be checked against its documentation. `withFallback(primary, fallback)` implements FR-002. A fake provider for tests implements the same interface.
- **Configuration** (`server/src/search/config.ts`): `SEARCH_PROVIDER` (default `langsearch`), `SEARCH_FALLBACK` (default `tinyfish`, empty for none), `LANGSEARCH_API_KEY`, `TINYFISH_API_KEY`, `SEARCH_DAILY_CALLS` (proposed default 200), `SEARCH_TIMEOUT_MS` (proposed 8000), `SEARCH_RESULTS_PER_QUERY` (proposed 5).
- **Where it runs:** in `createAssessmentService`, between retrieval and fact extraction. For each topic with no model-specific passage, build one query (for example `"<manufacturer> <model> RAM slots maximum memory"`), check the cache, call the provider, apply the model-match filter (reusing the normalization in `server/src/retrieval/normalize.ts`), and turn kept hits into passages.
- **Contracts (`shared/`):** `Passage` gains an optional `source: 'corpus' | 'web'` (absent = corpus) and keeps its required fields: `document_id` and `passage_id` derived from a hash of the URL (`web:<hash>`), `publisher` = domain, `section` = page title, `accessed_on` = retrieval date, `applicability` = the device's model. `RetrievalResult.model_evidence` gains `'web'` for results whose model evidence comes only from web passages. Exact field names are an implementation choice.
- **Extraction:** the fact prompt (`server/src/facts/prompt.ts`) marks web passages and asks for `rejected_passage_ids` (web passages not about the exact model); `filterFacts` drops facts whose citations are all rejected (FR-004) and applies the battery rule (FR-006). Existing fact cache keys include the prompt, so cached corpus facts are unaffected.
- **Cache and cap:** new additive SQLite tables `search_cache (key, provider, hits_json, created_at)` and `search_daily_usage (day, calls)`, mirroring `llm_daily_usage`. Purely additive; existing data untouched.
- **Thinking line:** the report stream gains a `status` event (`{ phase: 'web_search' }`) sent before searching; the web app's thinking line shows the FR-013 phrase while that phase is active. An alternative is a fixed phrase rotation; to be settled during implementation.
- **Web label:** the existing citation components in `web/src/components/` render `source: 'web'` passages with the label, domain and date (FR-007). Mock mode gains one sample web citation.
- **Tests:** fake-provider tests for trigger per topic, fallback chain (error, 429, timeout, empty), model-match filter including sibling models, rejected passages, battery rule, cache hit and expiry, daily cap, deadline, no-key startup; contract tests for the additive schema; web tests for the label and the thinking phrase.
- **ADR:** record the search adapter and provider choice (LangSearch primary, TinyFish fallback) as ADR-008 once implemented.

## Dependencies and risks

- **Dependency:** LangSearch and TinyFish API keys (the team has both, per the user on 2026-11-22). The TinyFish Fetch API's request and response format has not been read yet.
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
- Open: the TinyFish Fetch API's exact parameters and free allowance (check during T-002).
- Open: `status` event versus a client-side phrase for FR-013 (implementation choice).

## Scope change log

| Date       | Change                 | User approval                                                                                                                                                                                            |
| ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-22 | Initial approved scope | User chose "Accept" for the three-feature web search proposal (017–019) in the web search discussion, 2026-11-22, after choosing model facts, full trust with label, LangSearch with TinyFish fallback as an adapter, search only on corpus gaps with cache, server check plus LLM model match, and the battery exception |

## Related and superseded features

- **Planned replacement of an exclusion of [feature 002](../feature-002-knowledge-base-retrieval/PLAN.md):** its out-of-scope item "Web-scale or automatic ingestion, crawling, or live web search" no longer holds for live web search used as fallback evidence. Ingestion and crawling into the corpus stay excluded. feature-002-knowledge-base-retrieval / FR-001–FR-009 remain in force; corpus retrieval runs first and unchanged.
- **Planned extension of [feature 003](../feature-003-five-path-ranking/PLAN.md)** FR-002 (fact extraction from retrieved passages): passages may now also come from the web; the gates themselves do not change.
- **Planned change to [`docs/PRODUCT.md`](../../PRODUCT.md):** the principle "Evidence over assertion" gains web sources as labelled evidence.
- These are planned until implemented; reciprocal notes go into the feature 002 and 003 plans then.
- **Reused by:** [feature 018](../feature-018-part-lookup/PLAN.md) and [feature 019](../feature-019-eu-prices-and-local-offers/PLAN.md) (adapter, cap, cache).

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: [ADR-002](../../adr/adr-002-llm-openai-compatible-deepseek.md) (LLM adapter, the pattern the search adapter follows), [ADR-004](../../adr/adr-004-keyword-retrieval-sqlite-fts5.md) (corpus retrieval), [ADR-007](../../adr/adr-007-gate-cap-for-ai-part-options.md) (gate cap)
- Provider documentation (read 2026-11-22): [LangSearch Web Search API](https://docs.langsearch.com/api/web-search-api.md), [LangSearch limits](https://docs.langsearch.com/limits/api-limits), [TinyFish Search API](https://docs.tinyfish.ai/search-api/reference)
