# server

The TypeScript/Node backend. Node 24 runs the `.ts` sources directly; there is no build step. It currently contains the **device API** (`src/app.ts`, `src/devices/`, feature 001), the **LLM adapter** (`src/llm/`), **fact extraction** (`src/facts/`, feature 003 T-001), the **impact table loader** (`src/impact/`, T-003), the **assessment core** (`src/assessment/`: gates, calculator, scoring, weights), **retrieval** (`src/retrieval/`, feature 002), and the **report stream** that combines them (003 T-007). The explained report (004) comes next.

The LLM API key is configured only here, through environment variables. It never ships in the scanner or the web app.

## Device API

`npm start -w server` runs Fastify on `HOST:PORT` (default `127.0.0.1:3000`) with SQLite at `DATABASE_PATH`.

| Route | Result |
|---|---|
| `POST /api/devices` | `201 UploadResponse`; `400 invalid_payload` with one `fields` entry per invalid field (JSON Pointer); `413 payload_too_large` above 32 KiB |
| `GET /api/devices/:id` | `200 DeviceRecord`; unknown and malformed IDs both get the same `404 not_found` |
| `GET /api/devices/:id/report?intended_use=` | Server-Sent Events: `assessment` (the ranked `Assessment`), then `end` `{"status":"complete"}`; `error` with an `ApiError` if the assessment fails. `400 invalid_payload` for a use outside `office`, `study`, `development`, `pass_on`; `404` like the device route; `500` when the server has no retrieval index. The `report` event (feature 004) is not sent yet |
| `GET /downloads/leaaf-scanner.exe` | The file at `SCANNER_EXE_PATH`, or 404 while it does not exist. With `?session=<id>` the file is followed by the 37-byte trailer `LEAAFSCAN1:<id>`; an unknown session is 404 |
| `POST /api/sessions` | `201 ScanSession`: a new 26-character session ID and its download URL (feature 006) |
| `POST /api/sessions/:id/events` | The scanner's `step` or `error` event; `204`, `400` if invalid, `404` if unknown |
| `GET /api/sessions/:id/events` | Server-Sent Events: the latest event first, then live ones; ends after `complete` or `error` |

No route lists devices: the device ID (16 random bytes, base64url) is the only access control. An upload carrying `session_id` completes that session; the ID is removed before the scan is stored, so device routes never return it. Request logs record the method and route pattern only, never the URL or the client IP.

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
| `SCANNER_EXE_PATH` | `../scanner/dist/leaaf-scanner.exe` | Executable served as the download |
| `CORPUS_INDEX_PATH` | `data/corpus.sqlite` | Retrieval index built by `corpus:ingest` |
| `CORPUS_DIR` | `../corpus` | Corpus read by `corpus:ingest` |
| `LLM_API_KEY` | (required for LLM features) | Provider API key; without it the server starts and assesses without facts |
| `LLM_BASE_URL` | `https://api.deepseek.com` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `deepseek-flash` | Model name |
| `LLM_TIMEOUT_MS` | `25000` | Per-request timeout |
| `LLM_THINKING_FACT_EXTRACTION` | `disabled` | `enabled`, `disabled`, or `omit` (don't send the parameter) |
| `LLM_THINKING_EXPLANATION` | `disabled` | As above |

## Container image

`server/Dockerfile` (build from the repository root: `docker build -f server/Dockerfile .`) contains the sources, `data/`, the compiled `shared/`, and production dependencies. It runs `node src/main.ts` with `PORT=3000`, `HOST=0.0.0.0`, and `DATABASE_PATH=/data/leaaf.sqlite`. A Go build stage adds the Windows scanner, built for `https://leaaf.green` (build argument `SCANNER_BACKEND_URL`), at `SCANNER_EXE_PATH=/app/scanner/leaaf-scanner.exe`. See [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

## Commands

```sh
npm start -w server       # device API on http://127.0.0.1:3000
npm test -w server        # unit tests against a fake provider (no network, no key)
npm run typecheck -w server
npm run llm:smoke -w server   # live call to the configured provider; needs server/.env
npm run facts:smoke -w server # live fact extraction over shared/fixtures, compared with the expected facts
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
