# server

The TypeScript/Node backend. Node 24 runs the `.ts` sources directly; there is no build step. It currently contains the **device API** (`src/app.ts`, `src/devices/`, feature 001), the **LLM adapter** (`src/llm/`), **fact extraction** (`src/facts/`, feature 003 T-001), the **impact table loader** (`src/impact/`, T-003), the **assessment core** (`src/assessment/`: gates, calculator, scoring, weights), **retrieval** (`src/retrieval/`, feature 002), the **category service** (`src/categories/`, feature 008: the category call, its checks, option figures and scores, and the five-path fallback), and the **report stream** that combines them (003 T-007). The explained report request builder and model output schema are in `src/report/prompt.ts` (004 T-001).

The LLM API key is configured only here, through environment variables. It never ships in the scanner or the web app.

## Device API

`npm start -w server` runs Fastify on `HOST:PORT` (default `127.0.0.1:3000`) with SQLite at `DATABASE_PATH`. It first compiles `shared/` (the `prestart` script), because the server imports `@leaaf/shared` from its `dist/` folder.

| Route | Result |
|---|---|
| `POST /api/devices` | `201 UploadResponse`; `400 invalid_payload` with one `fields` entry per invalid field (JSON Pointer); `413 payload_too_large` above the configured ceiling (default 32 KiB), or `429 rate_limited` |
| `GET /api/devices/:id` | `200 DeviceRecord`; unknown and malformed IDs both get the same `404 not_found` |
| `GET /api/devices/:id/report?intended_use=` | Server-Sent Events: `assessment` (the ranked `Assessment`), then `categories` (the AI's `CategoryResult`, or the five-path fallback), then `end` with `{"status":"complete"}`. The fallback ends with `{"status":"fallback"}`. Internal assessment or storage failures send `error`. `400 invalid_payload` for a use outside the six shared intended uses; `404` like the device route; `429 rate_limited` before opening the stream, or `500` when the server has no retrieval index |
| `GET /api/devices/:id/options/:optionId/steps?intended_use=` | `200 StepPlan` (JSON, `cache-control: no-store`): the step plan of one option of the categories the result screen shows (feature 009). The route never starts a category call: it reads the cached categories, or the five-path fallback when none are cached. `400 invalid_payload` for an unknown use; `404` for an unknown device or option; `429 rate_limited`, or `500` when the server has no retrieval index |
| `GET /downloads/leaaf-scanner.exe` | The Windows scanner at `SCANNER_EXE_PATH`, or 404 while it does not exist. With `?session=<id>` the file is followed by the 37-byte trailer `LEAAFSCAN1:<id>`; an unknown session is 404 |
| `GET /downloads/leaaf-scanner-linux` | The Linux scanner at `SCANNER_LINUX_PATH`, with the same trailer for a session (feature 007) |
| `GET /downloads/leaaf-scanner-macos.zip` | The zipped macOS app at `SCANNER_MACOS_PATH`. For a session, the bundle inside is renamed from `leaaf-scanner.app` to `leaaf-scanner-<id>.app`, which keeps its signature valid (feature 007) |
| `POST /api/sessions` | Optional body `{"os": "windows" \| "macos" \| "linux"}` (default Windows). `201 ScanSession`: a new 26-character session ID and the download URL for that system (features 006 and 007); `400` for another body |
| `POST /api/sessions/:id/events` | The scanner's `step` or `error` event; `204`, `400` if invalid, `404` if unknown |
| `GET /api/sessions/:id/events` | Server-Sent Events: the latest event first, then live ones; ends after `complete` or `error` |
| `POST /api/admin/login` | Admin area (feature 013, only when configured, else 404). JSON `{"username", "password"}` → `204` with the `leaaf_admin` session cookie (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/admin`, 12 hours); `401 unauthorized` with one generic message; `429 rate_limited` after 5 failures per client or 50 overall in 15 minutes; `415` for non-JSON bodies |
| `POST /api/admin/logout` | JSON `{}` → `204`, ends the session and clears the cookie |
| `GET /api/admin/session` | `200 {"username"}` with a valid session, else `401` |
| `GET /api/admin/scans?page=<n>` | `200 AdminScanPage`: 50 scans per page, newest first, with time, device ID, maker, model, system and status, plus the total; `401` without a session. Every admin response is `no-store` and `X-Robots-Tag: noindex` |

No route lists devices: the device ID (16 random bytes, base64url) is the only access control. An upload carrying `session_id` completes that session; the ID is removed before the scan is stored, so device routes never return it. Request logs record the method and route pattern only, never the URL or the client IP.

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
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Empty (admin off) | The single admin login for `/admin` (feature 013). Both must be set and the password must have at least 16 characters; otherwise the admin routes are absent and a warning without the password is logged. Sessions live in memory, so a restart logs the admin out |

The running API shares one SQLite counter per UTC day across extraction and the category call. It reserves a call before each provider attempt, including failed requests, transport retries and JSON repairs. Cache hits consume no allowance. After exhaustion, fresh assessments can use cached facts, and uncached category results use the five-path fallback with its unavailable notice.

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

The category service (`src/categories/`) adds the SQLite table `category_cache` on startup, keyed by device and intended use and storing a hash of the category prompt, so a prompt change regenerates on the next open. It caches the AI's checked answer and recomputes option figures and scores from the current assessment on every read. Options of a priced kind (`ssd`, `ram`, `battery`, `hand_down`, `salvage`, `recycle`) are priced by the feature 003 calculator; `other` options keep the AI's ranges only if each has `low <= high` and no negative value, and are marked `ai_estimate`. Claims citing passages that were not supplied are removed, and text with a euro or CO₂e figure is replaced. A missing key, a typed provider failure, or an answer left with fewer than three categories after these checks produces the five assessed paths as five categories with the notice "AI explanation unavailable"; nothing is cached then, so the next open retries. `node scripts/category-fixture.ts` regenerates the shared example fixture.

The step service (`src/steps/`, feature 009) adds the SQLite table `step_cache` on startup, keyed by device, intended use and option ID. Like the category cache, it stores the AI's checked answer with a hash of the step prompt and the option's own fields, so a prompt change or a changed option regenerates on the next open, and concurrent opens share one call. The step call gets the scan, intended use, option, facts and the passages `retrieveOption` finds for the option. On every read, citations of passages that were not supplied are removed, then technical steps left without one; Windows 11 steps are removed on a Mac or Linux device. Text with a euro or CO₂e figure rejects the whole answer. A missing key, a typed provider failure or a rejected answer produces the template plan for the option's kind with the notice "AI steps unavailable", and nothing is cached, so the next open retries. The five-path fallback always gets template plans without a call. `node scripts/step-fixture.ts` regenerates the shared step fixtures.

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

## Container image

`server/Dockerfile` (build from the repository root: `docker build -f server/Dockerfile .`) contains the sources, `data/`, the compiled `shared/`, and production dependencies. It runs `node src/main.ts` with `PORT=3000`, `HOST=0.0.0.0`, and `DATABASE_PATH=/data/leaaf.sqlite`. A Go build stage adds the Windows scanner, built for `https://leaaf.green` (build argument `SCANNER_BACKEND_URL`), at `SCANNER_EXE_PATH=/app/scanner/leaaf-scanner.exe`. See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

## Commands

```sh
npm start -w server       # device API on http://127.0.0.1:3000
npm test -w server        # unit tests against a fake provider (no network, no key)
npm run typecheck -w server
npm run llm:smoke -w server   # live call to the configured provider; needs server/.env
npm run facts:smoke -w server # live fact extraction over shared/fixtures, compared with the expected facts
npm run categories:smoke -w server # live category call for the three demo models, with the feature 008 AC-016 checks; needs the index
npm run steps:smoke -w server # live category and step calls for the three demo models, listing feature 009 AC-015 candidates; needs the index
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
