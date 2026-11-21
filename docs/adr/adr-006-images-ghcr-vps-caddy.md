# ADR-006: Two container images on GHCR, run with Compose on a VPS behind an external Caddy

- **Status:** Accepted
- **Date adopted:** 2026-11-20 (user decision in feature 005's scope revision; recorded as an ADR on 2026-11-21)
- **Related feature(s):** [005](../features/feature-005-public-demo-deployment/PLAN.md) (owner, FR-010 to FR-012)
- **Supersedes:** None

## Context

The demo needs a public URL (`leaaf.green`) for the web app, the API and the scanner downloads, with secrets kept on the server, persistent SQLite data, and a way to redeploy an earlier release. The team already runs a Caddy instance outside this repository that terminates HTTPS.

## Decision

- **Images:** The project ships two images: `web` (the built app served by nginx with client-side route fallback) and `server` (the Node API with the corpus index, impact table and Windows scanner built in).
- **CI and releases:** One GitHub Actions workflow runs the checks and builds both images on pull requests and pushes to `main`. On a Git tag it publishes them to GHCR, tagged with the tag name, the short commit SHA and `latest`.
- **Hosting:** A VPS runs both images with the example Compose file (`deploy/compose.yaml`). Their ports are published on loopback only, and the server keeps its data on a named volume.
- **Routing:** The external Caddy, configured outside this repository, routes `/api/*` and `/downloads/*` to `server` and everything else to `web`, so the browser sees one origin.
- **Deploying:** Deployment itself is manual; CI does not deploy.

## Alternatives considered

| Alternative | Benefits | Why not chosen |
| ----------- | -------- | -------------- |
| One combined image | One artifact to run | The web app and API scale, update and fail independently; two images keep each simple |
| Caddy inside the Compose file | Self-contained | The team's Caddy already exists and serves other sites; managing it here would duplicate it |
| Automatic deployment from CI | No manual step | Needs host credentials in CI and a chosen provider; excluded from feature 005's scope |

## Consequences

- Any release can be redeployed by its image tag, and the deployment guide owns rollback.
- The trusted proxy address must be configured, so rate limits see client IPs (`TRUSTED_PROXY_IP`).
- **Open:** The VPS provider and account ownership (feature 005 T-001), and whether the GHCR packages are public or pulled with a read-only token. Until then, nothing is publicly deployed.

## Implementation / validation references

- `web/Dockerfile`, `web/nginx.conf`, `server/Dockerfile`, `.github/workflows/ci.yaml`, `deploy/compose.yaml`, `deploy/.env.example`
- Procedure: [docs/DEPLOYMENT.md](../DEPLOYMENT.md); release `v0.2.0` images are published to GHCR (README status)

## Supersession notes (if applicable)

None.
