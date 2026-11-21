# leaaf: Lifecycle Evaluation and Action Finder

Most of a laptop's carbon footprint comes from making it, so the greenest laptop is usually the one you already own. Yet old laptops end up in a drawer or as e-waste, because working out what to do with them takes time and know-how. **leaaf**, our project for the ÖH Hackathon 2026 on the theme *AI for Green*, does that work for you. Run a small scanner on an old Windows, Mac or Linux laptop, and leaaf ranks what you can do with it next: concrete options grouped by an AI into categories such as *Faster storage* or *Hand it down*. These options build on five possible next lives (**upgrade**, **repair**, **pass it on**, **salvage for parts** or **recycle**) and come with cited evidence and honest cost and CO₂e ranges.

## How it works

1. **Scan.** Download the scanner for your system (Windows, macOS or Linux) from the website and run it. It reads only the hardware facts it needs (no serial numbers, accounts or personal files) and uploads them.
2. **Assess.** The server matches the laptop to a curated knowledge base of manufacturer manuals, repair guides and regulations. An LLM extracts facts from those sources, and fixed rules decide which paths are feasible and safe.
3. **Rank and explain.** Choose an intended use (for example office or gaming) and a priority (*Environment first* or *Money first*). An AI picks the categories and options that fit this laptop; the server prices them with the same calculator and ranks them. Each option is explained with its sources, AI-estimated figures are labelled, and when the AI is unavailable the five paths are shown instead. leaaf says "cannot verify" where evidence is missing.

## Status

**In progress.** The full journey works locally, from scan to ranked, explained options: the result screen shows AI-chosen categories and options (feature 008), with the five paths as fallback. Opening an option shows a concrete, sourced step plan (feature 009). SSD, RAM and battery options are never rated better than the rule-based assessment allows (feature 011). The scanner has completed one scan on a real Windows 11 laptop. The macOS and Linux scanners pass their automated tests but have not scanned a real Mac or Linux laptop yet. The latest release images (`v0.2.0`) are published to GHCR. The public site at [leaaf.green](https://leaaf.green) is not deployed yet.

| # | Feature | Status |
|---|---|---|
| 001 | [Device scan and upload](docs/features/feature-001-device-scan-and-upload/PLAN.md) | In progress: the remaining Windows checks |
| 002 | [Knowledge base and retrieval](docs/features/feature-002-knowledge-base-retrieval/PLAN.md) | In progress: needs real scans of the demo models |
| 003 | [Five-path assessment and ranking](docs/features/feature-003-five-path-ranking/PLAN.md) | In progress: sourcing the impact data for the demo models |
| 004 | [Explained report](docs/features/feature-004-explained-report/PLAN.md) | Complete |
| 005 | [Public demo deployment](docs/features/feature-005-public-demo-deployment/PLAN.md) | In progress: the hosting provider isn't chosen yet |
| 006 | [Web app](docs/features/feature-006-web-app/PLAN.md) | Implemented, awaiting the team's browser review |
| 007 | [macOS and Linux scanner](docs/features/feature-007-macos-linux-scanner/PLAN.md) | Implemented, awaiting real scans on a Mac and a Linux laptop |
| 008 | [AI categories and options](docs/features/feature-008-ai-categories-and-options/PLAN.md) | Complete |
| 009 | [Concrete step plans](docs/features/feature-009-concrete-step-plans/PLAN.md) | Complete |
| 010 | [Step-level knowledge base](docs/features/feature-010-step-level-knowledge-base/PLAN.md) | Implemented, awaiting its review (ingestion and corpus tests pass on `main`) |
| 011 | [Gauge follows the tab, capped option statuses](docs/features/feature-011-tab-gauge-and-capped-option-status/PLAN.md) | Complete |
| 012 | [Processor check for gaming](docs/features/feature-012-gaming-cpu-check/PLAN.md) | Specified: the threshold and its source are still open |
| 016 | [Admin scan overview](docs/features/feature-016-admin-scan-overview/PLAN.md) | Implemented on `feat/adminpage`, awaiting merge and the check on the live site |

The demo focuses on three laptop models: ThinkPad T480, Dell XPS 13 9360 and HP EliteBook 840 G5.

## Tech stack

- **Scanner:** Go, with a [Gio](https://gioui.org) window: a Windows executable, a Linux executable and a universal macOS app
- **Server:** TypeScript on Node 24, Fastify and SQLite (with full-text search for retrieval)
- **Web app:** React, Vite and Tailwind CSS
- **LLM:** DeepSeek `deepseek-flash`, called through an OpenAI-compatible adapter ([ADR-002](docs/adr/adr-002-llm-openai-compatible-deepseek.md))

## Repository layout

| Folder | Contents |
|---|---|
| [`scanner/`](scanner/) | Go hardware scanner for Windows, macOS and Linux |
| [`server/`](server/) | API, storage, retrieval, assessment and reports |
| [`web/`](web/) | React web app |
| [`shared/`](shared/) | Data contracts (TypeBox → JSON Schema), fixtures and ranking helpers |
| [`corpus/`](corpus/) | Curated knowledge base and its manifest |
| [`data/`](data/) | Impact table (CO₂e, prices, useful life) |
| [`config/`](config/) | Ranking weights (illustrative) |
| [`deploy/`](deploy/) | Example production Compose file and env template |
| [`demo/`](demo/) | Seeded demo devices (placeholder so far) |
| [`docs/`](docs/) | Product, workflow, feature specs and ADRs |

## Development setup

All commands run from the repository root unless a step says otherwise.

### 1. Prerequisites

| Tool | Needed for | Notes |
|---|---|---|
| Node.js 24 or later, with npm | `shared/`, `server/`, `web/` | The server runs its `.ts` sources directly on Node 24 and uses the built-in `node:sqlite`, so older versions don't work. |
| Go 1.26 | `scanner/` only | `scanner/go.mod` pins Go 1.26.5. Not needed if you only work on the web app or server. |
| A DeepSeek API key | Optional | Without it, the server assesses without extracted facts and explains with templates (see [step 3](#3-configure-the-environment)). |
| Docker | Optional | Only to build or run the container images ([deployment guide](docs/DEPLOYMENT.md)). |
| A Windows 10 or 11 x64 machine, a Mac with macOS 12 or later, or an x64 Linux desktop | Optional | Only to run the real scanner (see [step 6](#6-build-and-run-the-scanner)). Building the Linux or macOS window needs cgo and the [Gio libraries](https://gioui.org/doc/install); the macOS app can only be built on a Mac. |

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
- **On Linux:** `go build -o dist/leaaf-scanner-linux ./cmd/leaaf-scanner` builds the window (needs cgo and the Gio libraries), which the server serves at `/downloads/leaaf-scanner-linux`. After **Start scan** it asks for root once through `pkexec`. `go run -tags console ./cmd/leaaf-scanner` is the terminal build.
- **On macOS:** `go run ./cmd/leaaf-scanner` opens the window. `scanner/packaging/macos/build.sh http://127.0.0.1:3000 0.1.0-local dist` builds the zipped app the server serves at `/downloads/leaaf-scanner-macos.zip`.

Release builds, the icon, the administrator manifest and the Linux root helper are described in [`scanner/README.md`](scanner/README.md).

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
| **Scan now** or a `/downloads/…` link gives `404` | That system's scanner isn't built: run step 6, or set `SCANNER_EXE_PATH`, `SCANNER_LINUX_PATH` or `SCANNER_MACOS_PATH`. |
| The landing page shows "Sample data" | The web app is in mock mode: set `VITE_API_MODE=live` and restart `npm run dev -w web`. |
| Every path that depends on compatibility reads "cannot verify" | No `LLM_API_KEY`, the provider failed, or the daily allowance (`LLM_DAILY_CALLS`) is used up. The server log shows which. |
| `429 rate_limited` while testing | The per-client limits are per server process: restart the server, or raise `UPLOADS_PER_HOUR` and `REPORTS_PER_HOUR` in `server/.env`. |

Further detail: [`shared/README.md`](shared/README.md) (contracts, fixtures), [`server/README.md`](server/README.md) (API, configuration, smoke tests), [`web/README.md`](web/README.md) (routes, mock and live mode), [`scanner/README.md`](scanner/README.md) (builds for each system), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (images, CI, Compose).

## Documentation

- Product context: [docs/PRODUCT.md](docs/PRODUCT.md)
- Glossary: [docs/GLOSSARY.md](docs/GLOSSARY.md)
- Feature index: [docs/features/INDEX.md](docs/features/INDEX.md)
- Deployment (images, CI, Compose, Caddy): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Architecture decisions: [docs/adr/](docs/adr/)
- Workflow for agents and contributors: [AGENTS.md](AGENTS.md), [docs/WORKFLOW.md](docs/WORKFLOW.md)

