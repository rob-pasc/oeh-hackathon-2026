# leaaf: Lifecycle Evaluation and Action Finder

**Status:** In progress. Six MVP features are specified. The shared data contracts (`shared/`) are implemented and tested. The web app (`web/`, first version on sample data) passes its automated checks; the browser review is pending. The Windows scanner (`scanner/`) and the server's device upload API are built and tested on recorded readings, but have not yet run on a real Windows laptop. The server also has the LLM adapter, fact extraction, the sourced impact table (`data/impact.yaml`), and the assessment core (gates, impact ranges, scoring, weights in `config/weights.yaml`), and retrieval over a curated corpus of 31 sourced documents for the three demo models (ThinkPad T480, XPS 13 9360, EliteBook 840 G5) in `corpus/`, none of which a route serves yet. The assessment API and reports are not built yet. Container images for `web` (on the real API) and `server` (with the Windows scanner) are built by CI and published to GHCR on tag pushes ([deployment guide](docs/DEPLOYMENT.md)); until ranking and reports exist, a real scan ends on a result screen without paths.

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

## Development

Requires Node.js 24 or later, and Go 1.26 for `scanner/`. From the repository root:

```sh
npm install
npm test            # builds shared/, then tests all workspaces
npm run typecheck
npm run build
npm start -w server  # device API on http://127.0.0.1:3000
(cd scanner && go test ./...)
```

CI ([`.github/workflows/ci.yaml`](.github/workflows/ci.yaml)) runs the same checks, plus the scanner's `go vet` and `go test`, on every pull request and push to `main`, and also builds both container images.

See [`shared/README.md`](shared/README.md) for the contracts, the mock fixtures, and how to change a contract, [`server/README.md`](server/README.md) for the API, configuration, and the live LLM smoke test, and [`scanner/README.md`](scanner/README.md) for the Windows build.

## Documentation

- Product context: [docs/PRODUCT.md](docs/PRODUCT.md)
- Glossary: [docs/GLOSSARY.md](docs/GLOSSARY.md)
- Feature index: [docs/features/INDEX.md](docs/features/INDEX.md)
- Deployment (images, CI, Compose, Caddy): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Architecture decisions: [docs/adr/](docs/adr/)
- Workflow for agents and contributors: [AGENTS.md](AGENTS.md), [docs/WORKFLOW.md](docs/WORKFLOW.md)

