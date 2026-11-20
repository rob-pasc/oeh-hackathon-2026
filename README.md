# leaaf: Lifecycle Evaluation and Action Finder

**Status:** In progress. Six MVP features are specified. The shared data contracts (`shared/`) are implemented and tested; the web app (`web/`, first version on sample data) is written; the scanner and server are not built yet.

ÖH Hackathon 2026 project (theme: AI for Green), planned to run at [leaaf.green](https://leaaf.green) (not deployed yet). A small Windows scanner reads an old laptop's hardware. The platform then ranks five next lives for it (upgrade, repair, pass it on, salvage for parts, recycle) in Environment first or Money first mode, with cited evidence and honest cost and CO₂e ranges.

## Planned features (build order)

1. [Device scan and upload](docs/features/feature-001-device-scan-and-upload/PLAN.md)
2. [Curated knowledge base and model-aware retrieval](docs/features/feature-002-knowledge-base-retrieval/PLAN.md)
3. [Five-path assessment and ranking](docs/features/feature-003-five-path-ranking/PLAN.md)
4. [Explained report](docs/features/feature-004-explained-report/PLAN.md)
5. [Public demo deployment](docs/features/feature-005-public-demo-deployment/PLAN.md)
6. [Web app: landing, scan session, results](docs/features/feature-006-web-app/PLAN.md)

Proposed stack (not yet adopted): a Go scanner for Windows, a TypeScript/Node backend with SQLite, a React web app (Vite, Tailwind), and a cloud LLM via the Anthropic API.

## Repository layout

| Folder | Contents | Owning feature |
|---|---|---|
| [`scanner/`](scanner/) | Go Windows hardware scanner | 001, 005 (release build) |
| [`server/`](server/) | TypeScript/Node API, storage, retrieval, assessment, reports | 001–005 |
| [`web/`](web/) | React web app | 001, 003, 004, 006 |
| [`shared/`](shared/) | Data contracts (TypeBox → JSON Schema), fixtures, and ranking helpers | 001–004 |
| [`corpus/`](corpus/) | Curated knowledge base and its manifest | 002 |
| [`data/`](data/) | Static impact table (CO₂e, prices, useful life) | 003 |
| [`demo/`](demo/) | Seeded demo device scans and caches | 005 |
| [`docs/`](docs/) | Product, workflow, feature specs, ADRs | — |

Apart from `shared/` and `web/`, the folders contain only README placeholders.

## Development

Requires Node.js 24 or later (Go is needed later for `scanner/`). From the repository root:

```sh
npm install
npm test            # all workspaces
npm run typecheck
npm run build
```

See [`shared/README.md`](shared/README.md) for the contracts, the mock fixtures, and how to change a contract.

## Documentation

- Product context: [docs/PRODUCT.md](docs/PRODUCT.md)
- Glossary: [docs/GLOSSARY.md](docs/GLOSSARY.md)
- Feature index: [docs/features/INDEX.md](docs/features/INDEX.md)
- Architecture decisions: [docs/adr/](docs/adr/)
- Workflow for agents and contributors: [AGENTS.md](AGENTS.md), [docs/WORKFLOW.md](docs/WORKFLOW.md)

