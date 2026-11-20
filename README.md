# Second Life Scanner

**Status:** Specified. Five MVP features are approved and specified; implementation has not started.

ÖH Hackathon 2026 project (theme: AI for Green). A small Windows scanner reads an old laptop's hardware. The platform then ranks five next lives for it (upgrade, repair, pass it on, salvage for parts, recycle) in Environment first or Money first mode, with cited evidence and honest cost and CO₂e ranges.

## Planned features (build order)

1. [Device scan and upload](docs/features/feature-001-device-scan-and-upload/PLAN.md)
2. [Curated knowledge base and model-aware retrieval](docs/features/feature-002-knowledge-base-retrieval/PLAN.md)
3. [Five-path assessment and ranking](docs/features/feature-003-five-path-ranking/PLAN.md)
4. [Explained report](docs/features/feature-004-explained-report/PLAN.md)
5. [Public demo deployment](docs/features/feature-005-public-demo-deployment/PLAN.md)

Proposed stack (not yet adopted): a Go scanner for Windows, a TypeScript/Node backend with SQLite, a React web app, and a cloud LLM via the Anthropic API.

## Documentation

- Product context: [docs/PRODUCT.md](docs/PRODUCT.md)
- Glossary: [docs/GLOSSARY.md](docs/GLOSSARY.md)
- Feature index: [docs/features/INDEX.md](docs/features/INDEX.md)
- Workflow for agents and contributors: [AGENTS.md](AGENTS.md), [docs/WORKFLOW.md](docs/WORKFLOW.md)

Setup and usage instructions will be added with feature 001.
