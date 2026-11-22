# server

The TypeScript/Node backend. Node 24 runs the `.ts` sources directly; there is no build step. It currently contains the **device API** (`src/app.ts`, `src/devices/`, feature 001), the **LLM adapter** (`src/llm/`), **fact extraction** (`src/facts/`, feature 003 T-001), the **impact table loader** (`src/impact/`, T-003), the **assessment core** (`src/assessment/`: gates, calculator, scoring, weights), **retrieval** (`src/retrieval/`, feature 002), the **category service** (`src/categories/`, feature 008: the category call, its checks, option figures and scores, and the five-path fallback), **web search** (`src/search/`, feature 017), the **part lookup** (`src/parts/`, feature 018), and the **report stream** that combines them (003 T-007). The explained report request builder and model output schema are in `src/report/prompt.ts` (004 T-001).

The LLM and search API keys are configured only here, through environment variables. They never ship in the scanner or the web app.

## Device API

`npm start -w server` runs Fastify on `HOST:PORT` (default `127.0.0.1:3000`) with SQLite at `DATABASE_PATH`. It first compiles `shared/` (the `prestart` script), because the server imports `@leaaf/shared` from its `dist/` folder.

| Route | Result |
|---|---|
| `POST /api/devices` | `201 UploadResponse`; `400 invalid_payload` with one `fields` entry per invalid field (JSON Pointer); `413 payload_too_large` above the configured ceiling (default 32 KiB), or `429 rate_limited` |
| `GET /api/devices/:id` | `200 DeviceRecord`; unknown and malformed IDs both get the same `404 not_found` |
| `GET /api/devices/:id/report?intended_use=` | Server-Sent Events: `status` with `{"phase":"web_search"}` while a fresh web search for the model runs (feature 017; not sent for cached or corpus-covered models), `assessment` (the ranked `Assessment`), then `categories` (the AI's `CategoryResult` with an optional combined `plan`, feature 013, or the five-path fallback with a rule-based plan when the upgrade and repair support one), then `end` with `{"status":"complete"}`. The fallback ends with `{"status":"fallback"}`. Internal assessment or storage failures send `error`. `400 invalid_payload` for a use outside the six shared intended uses; `404` like the device route; `429 rate_limited` before opening the stream, or `500` when the server has no retrieval index |
| `GET /api/devices/:id/parts` | `200 PartLookupResult` (JSON, `cache-control: no-store`): one lookup per scanned part (processor, memory type, graphics, drive types, battery) with a badge status (`knowledge_base`, `web`, `no_match`), a cited sentence and its source (feature 018). The lookup starts in the background on upload; this route waits for it. Corpus first, then feature 017's web search, then one LLM call for the parts not cached; results are cached per part for 30 days (`part_cache`), failures read `no_match` and are retried on the next request. An empty list without an LLM. `404` like the device route; `429` after `REPORTS_PER_HOUR` per client (its own window) |
| `GET /api/devices/:id/options/:optionId/steps?intended_use=` | `200 StepPlan` (JSON, `cache-control: no-store`): the step plan of one option of the categories the result screen shows (feature 009). The route never starts a category call: it reads the cached categories, or the five-path fallback when none are cached. `400 invalid_payload` for an unknown use; `404` for an unknown device or option; `429 rate_limited`, or `500` when the server has no retrieval index |
| `GET /api/devices/:id/plan/steps?intended_use=` | `200 PlanStepList` (JSON, `cache-control: no-store`): one step list of up to 16 steps for the combined plan of the shown categories (feature 014), with the option-step checks; the joined template plans when the AI is unavailable or for the fallback plan. `400` for an unknown use, `404` for an unknown device or a result without a plan, `429` after `STEPS_PER_HOUR` per client. |
| `GET /api/devices/:id/prices?intended_use=` | `200 WebPriceList` (JSON, `cache-control: no-store`): web prices in EUR (lowest and highest offer, and the checked offers) for the shown SSD, RAM and battery options, from the sites in [`config/price-sources.yaml`](../config/price-sources.yaml) (feature 019). Options with fewer than two checked offers are left out; the list is empty without web search or an LLM. Prices never change the categories or ranking. `400` for an unknown use, `404` for an unknown device, `429` after `REPORTS_PER_HOUR` per client. |
| `GET /api/devices/:id/options/:optionId/offers?intended_use=` | `200 LocalOfferList` (JSON, `cache-control: no-store`): up to three local offers for a repair, pass it on or recycle option, for the shared town or Austria-wide (`town: null`). Empty without web search or an LLM. `400` for an unknown use, `404` for an unknown device or an option without local offers, `429` after `STEPS_PER_HOUR` per client. |
| `GET /api/devices/:id/location` | `200 DeviceLocation`: the town shared on this device link, or `town: null`. `404` for an unknown device. |
| `POST /api/devices/:id/location` | Body `LocationRequest` (`lat`, `lon`). `200 DeviceLocation` with the town found by Nominatim, which is stored for this device link; `town: null` when none was found, which returns the link to Austria-wide offers. `400` for invalid coordinates, `404` for an unknown device, `429` after `REPORTS_PER_HOUR` per client. |
| `DELETE /api/devices/:id/location` | `200 DeviceLocation` with `town: null`: removes the shared town. `404` for an unknown device. |
| `GET /downloads/leaaf-scanner.exe` | The Windows scanner at `SCANNER_EXE_PATH`, or 404 while it does not exist. With `?session=<id>` the file is followed by the 37-byte trailer `LEAAFSCAN1:<id>`; an unknown session is 404 |
| `GET /downloads/leaaf-scanner-linux` | The Linux scanner at `SCANNER_LINUX_PATH`, with the same trailer for a session (feature 007) |
| `GET /downloads/leaaf-scanner-macos.zip` | The zipped macOS app at `SCANNER_MACOS_PATH`. For a session, the bundle inside is renamed from `leaaf-scanner.app` to `leaaf-scanner-<id>.app`, which keeps its signature valid (feature 007) |
| `POST /api/sessions` | Optional body `{"os": "windows" \| "macos" \| "linux"}` (default Windows). `201 ScanSession`: a new 26-character session ID and the download URL for that system (features 006 and 007); `400` for another body |
| `POST /api/sessions/:id/events` | The scanner's `step` or `error` event; `204`, `400` if invalid, `404` if unknown |
| `GET /api/sessions/:id/events` | Server-Sent Events: the latest event first, then live ones; ends after `complete` or `error` |
| `POST /api/admin/login` | Admin area (feature 016, only when configured, else 404). JSON `{"username", "password"}` → `204` with the `leaaf_admin` session cookie (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/admin`, 12 hours); `401 unauthorized` with one generic message; `429 rate_limited` after 5 failures per client or 50 overall in 15 minutes; `415` for non-JSON bodies |
| `POST /api/admin/logout` | JSON `{}` → `204`, ends the session and clears the cookie |
| `GET /api/admin/session` | `200 {"username"}` with a valid session, else `401` |
| `GET /api/admin/scans?page=<n>` | `200 AdminScanPage`: 50 scans per page, newest first, with time, device ID, maker, model, system and status, plus the total and today's AI calls against `LLM_DAILY_CALLS`; `401` without a session. Every admin response is `no-store` and `X-Robots-Tag: noindex` |
| `GET /api/admin/scans/:id` | `200 AdminScanDetail`: the full stored scan and its AI status (category results and step plans from the AI per intended use, and the AI fallbacks recorded in the `ai_fallbacks` table with a fixed reason code); `401` without a session, `404` for an unknown or malformed ID |

No route lists devices: the device ID (16 random bytes, base64url) is the only access control. An upload carrying `session_id` completes that session; the ID is removed before the scan is stored, so device routes never return it. Request logs record the method and route pattern only, never the URL or the client IP.

## Scan retention

`src/retention.ts` deletes scan data after `SCAN_RETENTION_DAYS` (30), as the privacy notice states (feature 006 FR-046). `main.ts` runs it on start and then every hour. A run deletes devices whose `created_at` is older than that, together with their rows in `category_cache`, `step_cache`, `explanation_cache` and `ai_fallbacks`, and scan sessions older than that. The model `fact_cache`, the `search_cache` (which expires on its own after 30 days) and the daily LLM and search counters are kept, because they hold no scan data. A deleted device link answers 404. The constant must match `scanRetentionDays` in `web/src/legal/provider.ts`, and a test checks this. The log line "deleted expired scan data" gives only the counts.

## Request limits

Each server process allows 10 upload attempts, 60 report requests and 120 step plan requests per client IP in separate one-hour windows starting with the first request. A 429 includes `Retry-After` in seconds. Direct connections use the socket IP. Configure the immediate Caddy peer for the deployed topology as described in the [deployment guide](../docs/DEPLOYMENT.md#client-ip-configuration).

| Environment variable | Default | Allowed value |
|---|---:|---|
| `UPLOAD_MAX_BYTES` | 32768 | 1–32768 bytes |
| `UPLOADS_PER_HOUR` | 10 | Positive integer |
| `REPORTS_PER_HOUR` | 60 | Positive integer |
| `STEPS_PER_HOUR` | 120 | Positive integer |
| `LLM_DAILY_CALLS` | 200 | Nonnegative integer. Zero prevents all fresh provider calls. |
| `TRUSTED_PROXY_IP` | Empty | One IPv4 or IPv6 address |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Empty (admin off) | The single admin login for `/admin` (feature 016). Both must be set and the password must have at least 16 characters; otherwise the admin routes are absent and a warning without the password is logged. Sessions live in memory, so a restart logs the admin out |

The running API shares one SQLite counter per UTC day across extraction and the category call. It reserves a call before each provider attempt, including failed requests, transport retries and JSON repairs. Cache hits consume no allowance. After exhaustion, fresh assessments can use cached facts, and uncached category results use the five-path fallback with its unavailable notice.

## Web search

When retrieval has no model-specific passage for a fact topic (memory, storage, battery, software support), the assessment searches the web for the manufacturer, the model and the topic, and nothing else from the scan ([feature 017](../docs/features/feature-017-web-evidence-for-model-facts/PLAN.md), [ADR-008](../docs/adr/adr-008-web-search-adapter.md)). Without a key, search is off and assessments behave as before.

- **Adapter:** `SearchProvider.search(query, signal)` in `src/search/types.ts`. `langsearch.ts` asks LangSearch for page text; `tinyfish.ts` uses TinyFish Search (snippets) and then Fetch for the top results' page text. `providerChain` in `config.ts` asks the next provider when one throws, uses up its half of `SEARCH_TIMEOUT_MS`, or returns no result naming the model. A new provider is one implementation plus an entry in `PROVIDERS`.
- **Model match:** a result counts only when its title or text names the model as whole tokens (`modelMatcher` in `evidence.ts`): "T480" never matches "T480s". Model names without a digit are not searched. Kept results become passages with `source: "web"` and IDs `web:<url hash>:<topic>`; the fact extraction gets extra rules for them and lists web passages that are not about the exact model in `rejected_passage_ids`. Corpus-only fact prompts are unchanged.
- **Trust:** facts from confirmed web passages count as model evidence (`model_evidence: "web"` when the corpus had none), which lowers confidence one level on upgrade, repair and salvage. A user-replaceable battery is never accepted from web pages alone. Web passages that no kept fact cites are dropped before the categories call.
- **Cache and cap:** `search_cache` keeps the usable results per model and topic for 30 days; failures are not cached. `search_daily_usage` counts fresh searches per UTC day (one per query, whichever providers answer). Concurrent assessments of one model share a search.

| Environment variable | Default | Allowed value |
|---|---:|---|
| `LANGSEARCH_API_KEY`, `TINYFISH_API_KEY` | Empty | Provider keys. Without any key, web search is off (logged once at startup) |
| `SEARCH_PROVIDER` | `langsearch` | `langsearch`, `tinyfish` or `none`: asked first |
| `SEARCH_FALLBACK` | `tinyfish` | `langsearch`, `tinyfish` or `none`: asked second. A provider without a key is skipped |
| `SEARCH_DAILY_CALLS` | 200 | Nonnegative integer. Zero stops all fresh searches |
| `SEARCH_TIMEOUT_MS` | 20000 | Positive integer: deadline for the whole search phase of one assessment; the first provider gets half |
| `SEARCH_RESULTS_PER_QUERY` | 5 | Positive integer; at most 3 usable results per topic become passages |
| `SEARCH_MAX_CHARS` | 6000 | At least 500: page text asked for per result; each passage keeps a 3,000-character window from the first mention of the topic |

## Web prices and local offers

The same search providers and daily cap serve web prices and local offers ([feature 019](../docs/features/feature-019-eu-prices-and-local-offers/PLAN.md)). Both are shown next to the impact table figures and never change scores, ranking or plan totals. Without a search key or an LLM, both lists are empty.

- **Providers one by one** (`src/search/lookup.ts`): unlike the fact search's chain, price and offer lookups ask the next provider when the first gives too few *checked* results (fewer than two offers or places), since providers differ a lot in how much text they return for shop and listing pages. Each provider call reserves one search from the daily cap.
- **Web prices** (`src/prices/`): the part an SSD, RAM or battery option would buy, named like the impact table prices it (`part.ts`), is searched as "<part> Preisvergleich" with 10 results, on the domains in [`config/price-sources.yaml`](../config/price-sources.yaml) only (with or without `www.`, not other subdomains). One LLM call (`web_extraction`) lists the offers. The server keeps only EUR offers from allowlisted pages, within plausible bounds, whose exact amount appears in the page title or text (comparison titles carry a product's lowest price), counting a product at one price once. At least two offers make a web price, shown as "from" the lowest offer with the three cheapest listed. `web_price_cache` keeps the checked offers per part for 7 days.
- **Local offers** (`src/offers/`): a repair, pass it on or recycle option searches for repair cafés, donation or drop-off points in Austria, or in the town shared on the device link. Only the town, never coordinates, goes into the query. Up to three places are kept, each named on its page. `local_offer_cache` keeps them for 7 days per kind and town, keyed by a hash.
- **Shared town** (`src/location/`): the page sends coordinates rounded to two decimals. The server rounds them again and asks Nominatim for the town: one request per second at most, with the User-Agent `leaaf (<PUBLIC_BASE_URL>)`, and lookups are cached in memory per rounded pair. Only the town is stored, in `device_locations`, which the retention purge empties with the scan. Coordinates are never written to the database or the log.

| Environment variable | Default | Allowed value |
|---|---:|---|
| `NOMINATIM_URL` | `https://nominatim.openstreetmap.org` | Base URL of a Nominatim server, or `none` to turn the town lookup off |

`npm run prices:smoke -w server` runs the live lookups once: prices for an SSD, a RAM module and a battery, Nominatim for the centre of Dornbirn, and repair offers Austria-wide and for that town. It uses the configured keys but not the cap or caches.

## LLM adapter

Feature code calls the provider-neutral `LlmClient.completeJson({ task, system, user, schema })`. It returns a value validated against the given TypeBox schema, or throws `LlmError` with a `kind`. The current provider is DeepSeek `deepseek-flash`, reached through an OpenAI-compatible adapter ([ADR-002](../docs/adr/adr-002-llm-openai-compatible-deepseek.md)).

```ts
import { createOpenAiCompatibleClient, loadLlmConfig, LlmError } from './src/llm/index.ts'

const llm = createOpenAiCompatibleClient(loadLlmConfig())
try {
  const { value } = await llm.completeJson({ task: 'fact_extraction', system, user, schema: FactSet })
} catch (e) {
  if (e instanceof LlmError) {
    // e.kind: config | auth | rate_limited | timeout | unavailable | bad_request | invalid_output
  }
}
```

Rules for callers:
- Put document passages in `user`, clearly delimited as data.
- Never put device IDs or personal data into prompts.

The report service adds the SQLite table `explanation_cache` on startup. Repeat requests for the same device and intended use reuse the stored output. Each response filters claims against the retrieved passages and takes citation metadata from retrieval. Concurrent opens share a pending generation in the server process. If no cached result exists, a missing key or typed provider failure produces a template report derived from the assessment. The explanation deadline covers transport retries and JSON repair. A later open can retry generation. Older prompt versions regenerate on the next request. There is no device-data migration. Since feature 008 the report stream no longer calls the explanation service; its template text is still used by the category fallback.

The category service (`src/categories/`) also checks and prices the AI's proposed plan (`src/categories/plan.ts`, feature 013): only Good fit options after the gate cap, two to six steps, hand-down at most once and last, priced as one plan with the baseline credited once; an invalid plan is dropped without affecting the categories. It adds the SQLite table `category_cache` on startup, keyed by device and intended use and storing a hash of the category prompt, so a prompt change regenerates on the next open. It caches the AI's checked answer and recomputes option figures and scores from the current assessment on every read. Options of a priced kind (`ssd`, `ram`, `battery`, `hand_down`, `salvage`, `recycle`) are priced by the feature 003 calculator; `other` options keep the AI's ranges only if each has `low <= high` and no negative value, and are marked `ai_estimate`. Claims citing passages that were not supplied are removed, and text with a euro or CO₂e figure is replaced. A missing key, a typed provider failure, or an answer left with fewer than three categories after these checks produces the five assessed paths as five categories with the notice "AI explanation unavailable"; nothing is cached then, so the next open retries. `node scripts/category-fixture.ts` regenerates the shared example fixture.

The step service (`src/steps/`, feature 009) adds the SQLite table `step_cache` on startup, keyed by device, intended use and option ID. Like the category cache, it stores the AI's checked answer with a hash of the step prompt and the option's own fields, so a prompt change or a changed option regenerates on the next open, and concurrent opens share one call. The step call gets the scan, intended use, option, facts and the passages `retrieveOption` finds for the option. On every read, citations of passages that were not supplied are removed, then technical steps left without one; Windows 11 steps are removed on a Mac or Linux device. Text with a euro or CO₂e figure rejects the whole answer. A missing key, a typed provider failure or a rejected answer produces the template plan for the option's kind with the notice "AI steps unavailable", and nothing is cached, so the next open retries. The five-path fallback always gets template plans without a call. `node scripts/step-fixture.ts` regenerates the shared step fixtures. The plan step list (feature 014) is cached in the same table under the option ID `#plan`, keyed by the plan prompt and the plan's options in order, so a changed plan is asked again.

## Fact extraction

`createFactExtractor({ llm, cache }).extract({ scan, retrieval })` returns the device model's `FactSet`. It sends the retrieved passages, the model identity, and the CPU name to the LLM, never the device ID. It keeps a fact only if every passage it cites was retrieved, and drops repeated keys whose values conflict. Results are cached under the model plus a hash of the prompt input, using `createSqliteFactCache(db)` (built-in `node:sqlite`) or `createMemoryFactCache()`. On LLM failure it throws `LlmError` and caches nothing. Change `PROMPT_VERSION` in `src/facts/prompt.ts` when editing the prompt.

## Impact table

`loadImpactTable()` (`src/impact/table.ts`) reads and validates [`data/impact.yaml`](../data/impact.yaml) and throws on any problem. `coverageProblems(table)` lists required entries that are missing or still placeholders. See [`data/README.md`](../data/README.md).

## Assessment

`assess({ deviceId, scan, use, modelEvidence, facts, impactTable, weights })` (`src/assessment/`) returns the shared `Assessment`: a status, reasons, impact ranges, four criterion scores, and a confidence level per path. It is a pure function. `createAssessmentService` (`src/assessment/service.ts`) runs it for the report stream: retrieval, then fact extraction (cached in the database's `fact_cache` table), then `assess()`. If the LLM fails or `LLM_API_KEY` is not set, it assesses without facts, so compatibility-dependent paths read "cannot verify". `loadWeights()` reads [`config/weights.yaml`](../config/weights.yaml). `main.ts` loads the weights and the impact table at startup, so an invalid file stops the server. The gate rules and scoring rubrics are documented in the [feature 003 design](../docs/features/feature-003-five-path-ranking/DESIGN.md).

## Retrieval

`npm run corpus:ingest -w server` validates [`corpus/manifest.yaml`](../corpus/README.md), chunks the Markdown extracts, and writes the search index to `CORPUS_INDEX_PATH` (default `data/corpus.sqlite`). It fails, naming each document and missing field, on an invalid manifest, and prints coverage gaps for the demo models. The index is built ahead of time, never per request.

`openRetriever(path).retrieve(scan, { k })` returns the shared `RetrievalResult`. It matches the device to a manifest model exactly (after case and whitespace normalization and the alias lists), keeps generic documents plus documents for that exact model, and ranks passages per path with SQLite FTS5 BM25 over the path's keyword facets, interleaved round-robin (`PATH_QUERIES` in `src/retrieval/retrieve.ts`; default `k` = 5). An unmatched device gets `model_evidence: "none"` and generic passages only. The report stream opens it at `CORPUS_INDEX_PATH` on startup; without an index the server starts with a warning and the report stream answers `500`.

## Configuration

```sh
cp server/.env.example server/.env   # gitignored; then set LLM_API_KEY
```

| Variable | Default | Meaning |
|---|---|---|
| `PORT`, `HOST` | `3000`, `127.0.0.1` | API listen address |
| `DATABASE_PATH` | `data/leaaf.sqlite` | SQLite file (gitignored `server/data/`) |
| `PUBLIC_BASE_URL` | `http://localhost:5173` | Web origin used to build device URLs |
| `SCANNER_EXE_PATH` | `../scanner/dist/leaaf-scanner.exe` | Windows scanner served as the download |
| `SCANNER_LINUX_PATH` | `../scanner/dist/leaaf-scanner-linux` | Linux scanner |
| `SCANNER_MACOS_PATH` | `../scanner/dist/leaaf-scanner-macos.zip` | Zipped macOS app (built on a Mac by `scanner/packaging/macos/build.sh`) |
| `CORPUS_INDEX_PATH` | `data/corpus.sqlite` | Retrieval index built by `corpus:ingest` |
| `CORPUS_DIR` | `../corpus` | Corpus read by `corpus:ingest` |
| `LLM_API_KEY` | (required for LLM features) | Provider API key; without it the server starts and assesses without facts |
| `LLM_BASE_URL` | `https://api.deepseek.com` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `deepseek-flash` | Model name |
| `LLM_TIMEOUT_MS` | `25000` | Per-request timeout |
| `LLM_THINKING_FACT_EXTRACTION` | `disabled` | `enabled`, `disabled`, or `omit` (don't send the parameter) |
| `LLM_THINKING_EXPLANATION` | `disabled` | As above |
| `LLM_CATEGORY_TIMEOUT_MS` | `40000` | Deadline for the whole category call (feature 008), including retries and the repair attempt |
| `LLM_THINKING_CATEGORIES` | `disabled` | As above, for the category call |
| `LLM_STEP_TIMEOUT_MS` | `25000` | Deadline for the whole step call (feature 009), including retries and the repair attempt |
| `LLM_THINKING_STEPS` | `disabled` | As above, for the step call |
| `LLM_THINKING_PART_LOOKUP` | `disabled` | As above, for the part lookup call (feature 018), whose deadline is `LLM_TIMEOUT_MS` |
| `LLM_THINKING_WEB_EXTRACTION` | `disabled` | As above, for reading web prices and local offers (feature 019) |

## Container image

`server/Dockerfile` (build from the repository root: `docker build -f server/Dockerfile .`) contains the sources, `data/`, the compiled `shared/`, and production dependencies. It runs `node src/main.ts` with `PORT=3000`, `HOST=0.0.0.0`, and `DATABASE_PATH=/data/leaaf.sqlite`. A Go build stage adds the Windows scanner, built for `https://leaaf.green` (build argument `SCANNER_BACKEND_URL`), at `SCANNER_EXE_PATH=/app/scanner/leaaf-scanner.exe`. See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

## Commands

```sh
npm start -w server       # device API on http://127.0.0.1:3000
npm test -w server        # unit tests against a fake provider (no network, no key)
npm run typecheck -w server
npm run llm:smoke -w server   # live call to the configured provider; needs server/.env
npm run facts:smoke -w server # live fact extraction over shared/fixtures, compared with the expected facts
npm run categories:smoke -w server # live category call for the three demo models, with the feature 008 AC-016 checks and each plan (or why it was dropped, feature 013); needs the index
npm run steps:smoke -w server # live category and step calls for the three demo models, listing feature 009 AC-015 candidates; needs the index
npm run steps:smoke -w server -- --plan # only the plan step call for models whose categories carry a plan (feature 014)
npm run search:smoke -w server # live search with each configured provider (feature 017); optional: -- "<maker>" "<model>"
npm run parts:smoke -w server  # live part lookup for ThinkPad T470 parts with the configured LLM and search (feature 018); needs the index
npm run corpus:ingest -w server # build the retrieval index from corpus/ into data/corpus.sqlite
```

The smoke test sends one tiny non-personal prompt per thinking setting. It prints the model, attempts, latency, and token usage, and never the key or the prompt.

### Smoke test results

| Date | Provider / model | Thinking | Result |
|---|---|---|---|
| 2026-11-20 | `https://api.deepseek.com` / `deepseek-flash` | disabled (explanation) | Pass: 1 attempt, 1717 ms, 156/25 tokens in/out |
| 2026-11-20 | `https://api.deepseek.com` / `deepseek-flash` | enabled (fact extraction) | Pass: 1 attempt, 1298 ms, 181/78 tokens in/out |
| 2026-11-20 | `https://api.deepseek.com` / `deepseek-flash` | enabled (`facts:smoke`) | Pass, matches fixture: 1 attempt, 10757 ms, 2176/2063 tokens in/out |
| 2026-11-20 | `https://api.deepseek.com` / `deepseek-flash` | disabled (`facts:smoke`) | Pass, matches fixture: 1 attempt, 1469 ms, 2151/264 tokens in/out |
| 2026-11-20 | `https://api.deepseek.com` / `deepseek-flash` | disabled (`facts:smoke`, new default) | Pass, matches fixture: 1 attempt, 1459 ms, 2151/264 tokens in/out |

This confirms that DeepSeek accepts `thinking: { type: "disabled" }`, which its docs did not show explicitly.

Web search (`search:smoke`, query "Lenovo ThinkPad T470 RAM memory slots maximum memory"):

| Date | Provider | Result |
|---|---|---|
| 2026-11-22 | LangSearch | Pass: 5 results, 4 name "ThinkPad T470", 4524 ms |
| 2026-11-22 | TinyFish (Search and Fetch) | Pass: 5 results, 4 name "ThinkPad T470" (including Lenovo's PSREF spec sheet), 8692 ms |

Part lookup (`parts:smoke`, ThinkPad T470 parts: Intel Core i5-7300U, DDR4, Intel HD Graphics 620, NVMe SSD, battery):

| Date | Result |
|---|---|
| 2026-11-22 | Pass: 5 parts in 6925 ms; processor, memory, graphics and drive as Web search (notebookcheck.net via web.archive.org, starmicroinc.net, mobilexfiles.com, graphicscardhub.com), battery as Knowledge base (EPA's lithium-ion battery page). A second run after a prompt change took 12351 ms, with LangSearch failing once (`unavailable`) and TinyFish answering as fallback |
