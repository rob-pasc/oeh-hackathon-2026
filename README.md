# leaaf: Lifecycle Evaluation and Action Finder

**Status:** In progress. Six MVP features are specified. The shared data contracts (`shared/`) are implemented and tested. The web app (`web/`) supports both live and sample data and passes its automated checks; the wider team browser review is pending. The Windows scanner (`scanner/`) and the server's device upload API are built and tested on recorded readings. One elevated scan on a real Windows 11 laptop uploaded a complete record through **Scan now** against the local stack. The remaining Windows checks (declining the prompt, the offline retry) are open. The server also has the LLM adapter, fact extraction, the sourced impact table (`data/impact.yaml`), and the assessment core (gates, impact ranges, scoring, weights in `config/weights.yaml`), and retrieval over a curated corpus of 31 sourced documents for the three demo models (ThinkPad T480, XPS 13 9360, EliteBook 840 G5) in `corpus/`. The report stream (`GET /api/devices/:id/report`) ties these together and sends the ranked assessment for six intended uses, including `general` and `gaming`; the [explained report](docs/features/feature-004-explained-report/PLAN.md) now follows the assessment with checked citations and explanations cached per device and use. A missing or unavailable LLM triggers explanations from the assessment. The report UI, source links and keyboard journey were verified at phone and laptop widths. The landing page discloses the scanner data before download. The API enforces per-client request limits and a daily provider allowance. Container images for `web` (on the real API) and `server` (with the Windows scanner) have a CI build and a GHCR publishing workflow triggered by tag pushes ([deployment guide](docs/DEPLOYMENT.md)).

ÖH Hackathon 2026 project (theme: AI for Green), planned to run at [leaaf.green](https://leaaf.green) (not deployed yet). A small Windows scanner reads an old laptop's hardware. The platform then ranks five next lives for it (upgrade, repair, pass it on, salvage for parts, recycle) in Environment first or Money first mode, with cited evidence and honest cost and CO₂e ranges.

## Planned features (build order)

1. [Device scan and upload](docs/features/feature-001-device-scan-and-upload/PLAN.md)
2. [Curated knowledge base and model-aware retrieval](docs/features/feature-002-knowledge-base-retrieval/PLAN.md)
3. [Five-path assessment and ranking](docs/features/feature-003-five-path-ranking/PLAN.md)
4. [Explained report](docs/features/feature-004-explained-report/PLAN.md)
5. [Public demo deployment](docs/features/feature-005-public-demo-deployment/PLAN.md)
6. [Web app: landing, scan session, results](docs/features/feature-006-web-app/PLAN.md)

Stack: a Go scanner for Windows, a TypeScript/Node backend with SQLite, and a React web app (Vite, Tailwind). The LLM is reached through an OpenAI-compatible adapter, currently DeepSeek `deepseek-flash` via its official API ([ADR-002](docs/adr/adr-002-llm-openai-compatible-deepseek.md), implemented in `server/src/llm/`).

## Repository layout

| Folder | Contents | Owning feature |
|---|---|---|
| [`scanner/`](scanner/) | Go Windows hardware scanner | 001, 005 (release build) |
| [`server/`](server/) | TypeScript/Node API, storage, retrieval, assessment, reports | 001–005 |
| [`web/`](web/) | React web app | 001, 003, 004, 006 |
| [`shared/`](shared/) | Data contracts (TypeBox → JSON Schema), fixtures, and ranking helpers | 001–004 |
| [`corpus/`](corpus/) | Curated knowledge base and its manifest | 002 |
| [`data/`](data/) | Static impact table (CO₂e, prices, useful life) | 003 |
| [`config/`](config/) | Ranking weights (illustrative) | 003 |
| [`demo/`](demo/) | Seeded demo device scans and caches | 005 |
| [`deploy/`](deploy/) | Example production Compose file and env templates | 005 |
| [`docs/`](docs/) | Product, workflow, feature specs, ADRs | — |

`demo/` contains only a README placeholder so far.

## Development setup

All commands run from the repository root unless a step says otherwise.

### 1. Prerequisites

| Tool | Needed for | Notes |
|---|---|---|
| Node.js 24 or later, with npm | `shared/`, `server/`, `web/` | The server runs its `.ts` sources directly on Node 24 and uses the built-in `node:sqlite`, so older versions don't work. |
| Go 1.26 | `scanner/` only | `scanner/go.mod` pins Go 1.26.5. Not needed if you only work on the web app or server. |
| A DeepSeek API key | Optional | Without it, the server assesses without extracted facts and explains with templates (see [step 3](#3-configure-the-environment)). |
| Docker | Optional | Only to build or run the container images ([deployment guide](docs/DEPLOYMENT.md)). |
| A Windows 10 or 11 x64 machine | Optional | Only to run the real scanner. Other systems can send an empty scan (see [step 6](#6-build-and-run-the-scanner)). |

### 2. Install dependencies

```sh
git clone <repository URL> && cd oeh-hackathon-2026
npm install
```

`npm install` installs all three workspaces (`shared`, `server`, `web`). The server imports `@leaaf/shared` from its compiled `dist/` folder. `npm start -w server`, `npm test` and `npm run typecheck` build it first. After changing `shared/src/` while the server is running, restart the server so it picks up the rebuild. The web app imports the shared sources directly, so it needs no build.

### 3. Configure the environment

Both `.env` files are gitignored. Never commit real keys.

```sh
cp server/.env.example server/.env   # then set LLM_API_KEY, if you have one
cp web/.env.example web/.env         # VITE_API_MODE=mock (default) or live
```

- **Server** (`server/.env`): the defaults work locally. The API listens on `127.0.0.1:3000`, stores SQLite files under `server/data/`, builds device links for `http://localhost:5173`, and serves the scanner from `scanner/dist/leaaf-scanner.exe`. `LLM_API_KEY` is the only value you would normally set. All variables, including request limits, are listed in [`server/README.md`](server/README.md#configuration).
- **Web** (`web/.env`): `VITE_API_MODE=mock` runs on fictional sample data and needs no server. `live` talks to the real API. The dev server forwards `/api` and `/downloads` to `http://127.0.0.1:3000`. To use another address, set `VITE_API_PROXY` in the shell before `npm run dev -w web`. The Vite config reads it from the process environment, not from `web/.env`.

### 4. Build the retrieval index

```sh
npm run corpus:ingest -w server   # corpus/ -> server/data/corpus.sqlite
```

This validates [`corpus/manifest.yaml`](corpus/README.md), indexes the documents, and prints any coverage gaps for the demo models. Run it again after changing `corpus/`. Without an index, the server still starts (with a warning), but the report stream answers `500`.

### 5. Run the app

**Web app only, on sample data** (no server, key or index needed):

```sh
npm run dev -w web                # http://localhost:5173, shows a "Sample data" label
```

**Full local stack**, in two terminals:

```sh
npm start -w server                       # API on http://127.0.0.1:3000
VITE_API_MODE=live npm run dev -w web     # or set it in web/.env
```

Open `http://localhost:5173`. **Scan now** creates a scan session and downloads the scanner through the server. That needs the exe from step 6, otherwise the download is a 404. To try the result screen without a scan, upload a fixture and open the returned `device_url`:

```sh
curl -s -X POST http://127.0.0.1:3000/api/devices \
  -H 'content-type: application/json' \
  --data @shared/fixtures/device-scan.laptop-complete.json
```

The fixture is a fictional model, so retrieval finds no model-specific evidence and several paths read "cannot verify". The three demo models get model-specific evidence.

### 6. Build and run the scanner

From `scanner/`:

```sh
go test ./...
GOOS=windows GOARCH=amd64 go build -ldflags "-s -w -H windowsgui" -o dist/leaaf-scanner.exe ./cmd/leaaf-scanner
```

Without `-X main.backendURL=…`, the build uploads to `http://127.0.0.1:3000`, the local server. The server serves `scanner/dist/leaaf-scanner.exe` at `/downloads/leaaf-scanner.exe`, so **Scan now** on the local web app now downloads it with the session trailer appended.

- **On Windows:** start the downloaded exe and accept the administrator prompt. If the stack runs in WSL 2, Windows reaches `127.0.0.1:3000` through WSL's localhost forwarding, which is on by default. `go run` from a terminal without administrator rights fails with "requires elevation".
- **On Linux or macOS:** `go run ./cmd/leaaf-scanner` sends a scan with every value `null`, enough to exercise the upload and session flow. `go run -tags gui ./cmd/leaaf-scanner` opens the real window (needs cgo and the Gio system libraries).

Release builds, the icon, and the administrator manifest are described in [`scanner/README.md`](scanner/README.md).

### 7. Checks before committing

```sh
npm run typecheck
npm test                       # builds shared/, then runs every workspace's Vitest suite
npm run build
(cd scanner && go vet ./... && GOOS=windows go vet ./... && go test ./...)
```

The tests use a fake LLM provider, so they need no key and no network. CI ([`.github/workflows/ci.yaml`](.github/workflows/ci.yaml)) runs the same checks on every pull request and every push to `main`, and also builds both container images. Per-workspace variants (for example `npm test -w web`) are in each workspace README.

### 8. Optional tasks

| Task | Command |
|---|---|
| Live call to the configured LLM (needs `server/.env`) | `npm run llm:smoke -w server` |
| Live fact extraction compared with the fixture | `npm run facts:smoke -w server` |
| Re-export the JSON Schemas after changing a contract | `npm run schemas -w shared`, then follow [changing a contract](shared/README.md#changing-a-contract) |
| Production build of the web app, served locally | `npm run build -w web && npm run preview -w web` |
| Container images | `docker build -f web/Dockerfile .` and `docker build -f server/Dockerfile .` ([deployment guide](docs/DEPLOYMENT.md)) |
| Reset local data | Stop the server and delete `server/data/leaaf.sqlite`. This removes stored devices, sessions, the fact and explanation caches, and the daily LLM counter. The server creates a new file on start. |

### Troubleshooting

| Symptom | Cause and fix |
|---|---|
| The report stream answers `500` | No retrieval index: run step 4. |
| **Scan now** or `/downloads/leaaf-scanner.exe` gives `404` | The exe isn't built: run step 6, or set `SCANNER_EXE_PATH`. |
| The landing page shows "Sample data" | The web app is in mock mode: set `VITE_API_MODE=live` and restart `npm run dev -w web`. |
| Every path that depends on compatibility reads "cannot verify" | No `LLM_API_KEY`, the provider failed, or the daily allowance (`LLM_DAILY_CALLS`) is used up. The server log shows which. |
| `429 rate_limited` while testing | The per-client limits are per server process: restart the server, or raise `UPLOADS_PER_HOUR` and `REPORTS_PER_HOUR` in `server/.env`. |

Further detail: [`shared/README.md`](shared/README.md) (contracts, fixtures), [`server/README.md`](server/README.md) (API, configuration, smoke tests), [`web/README.md`](web/README.md) (routes, mock and live mode), [`scanner/README.md`](scanner/README.md) (Windows build), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (images, CI, Compose).

## Documentation

- Product context: [docs/PRODUCT.md](docs/PRODUCT.md)
- Glossary: [docs/GLOSSARY.md](docs/GLOSSARY.md)
- Feature index: [docs/features/INDEX.md](docs/features/INDEX.md)
- Deployment (images, CI, Compose, Caddy): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Architecture decisions: [docs/adr/](docs/adr/)
- Workflow for agents and contributors: [AGENTS.md](AGENTS.md), [docs/WORKFLOW.md](docs/WORKFLOW.md)

