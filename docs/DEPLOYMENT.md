# Deployment

How leaaf is built, published, and run in production. Scope and open decisions are in [feature 005](features/feature-005-public-demo-deployment/PLAN.md). This guide does not authorize a deployment; each release to the public host needs the team's go-ahead.

**Local deployment status (2026-11-20).** The live web app and server support scanner sessions, uploads, ranked assessments and explained reports. The server enforces upload, per-client and daily provider limits. The repository and scanner secret scan passed locally (feature 005 AC-007). Demo seeding, backup and restore rehearsal, and public deployment verification remain open.

## Release images

| Image | Built from | Serves | Port |
|---|---|---|---|
| `ghcr.io/rob-pasc/leaaf-web` | [`web/Dockerfile`](../web/Dockerfile) | The built React app via unprivileged nginx ([`web/nginx.conf`](../web/nginx.conf)), with `index.html` fallback for client routes and `/healthz` | 8080 |
| `ghcr.io/rob-pasc/leaaf-server` | [`server/Dockerfile`](../server/Dockerfile) | The Node API (TypeScript run directly by Node 24), data under `/data`, the retrieval index built from `corpus/` at image build time (`CORPUS_INDEX_PATH=/app/corpus-index/corpus.sqlite`; an invalid manifest fails the build), and the Windows scanner at `/downloads/leaaf-scanner.exe` | 3000 |

Both build from the repository root because they need the root lockfile and `shared/`:

```sh
docker build -f web/Dockerfile -t leaaf-web .
docker build -f web/Dockerfile --build-arg VITE_API_MODE=mock -t leaaf-web-mock .   # sample data, no backend
docker build -f server/Dockerfile --build-arg SCANNER_VERSION=0.1.0 -t leaaf-server .
```

- **Web mode:** `VITE_API_MODE` is fixed when the image is built. The default and the CI build use `live`, which calls `/api` and `/downloads` on the same origin. `mock` serves the labeled sample data without a backend and is for local use only.
- **Server:** The image runs `node src/main.ts` with `PORT=3000`, `HOST=0.0.0.0`, and `DATABASE_PATH=/data/leaaf.sqlite`. Set `PUBLIC_BASE_URL` in `deploy/.env`.
- **Scanner:** A Go build stage cross-compiles the Windows scanner with the backend URL `SCANNER_BACKEND_URL` (default `https://leaaf.green`) and the version `SCANNER_VERSION` compiled in, and puts it at `SCANNER_EXE_PATH` (`/app/scanner/leaaf-scanner.exe`). CI passes the Git tag, or `sha-<short sha>` on other runs, as the version. The binary holds no secrets.

## CI and publishing

[`.github/workflows/ci.yaml`](../.github/workflows/ci.yaml) runs on every pull request, every push to `main`, and every tag push:

1. `checks`: `npm ci`, then the type check, tests, and build for all workspaces.
2. `scanner`: `go vet` for Linux and Windows, then `go test` in `scanner/`.
3. `images`: builds both images for `linux/amd64` (after both jobs pass). Only on a **tag push** does it log in to GHCR and push. Each image gets the Git tag name, `sha-<short sha>`, and `latest`.

To release, tag a commit on `main` and push the tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

Then wait for the workflow run to go green. The packages appear under the repository owner's GitHub packages. New GHCR packages are **private**. The host must log in (below) or the packages must be made public in their package settings.

## Host setup

You need Docker with Compose v2.24 or later, and Caddy running outside this setup (it terminates HTTPS for `leaaf.green`). Copy the [`deploy/`](../deploy/) folder to the host, then:

```sh
cd deploy
cp .env.example .env                 # LEAAF_TAG, ports, LLM_API_KEY etc.; never commit it
# For private packages, log in with a token that has only read:packages:
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin
docker compose pull
docker compose up -d
```

Both containers publish their ports on `127.0.0.1` only. The server's data lives in the named volume `leaaf_server-data`. `deploy/.env` both configures Compose and is passed to the server container. The server variables are described in [`server/README.md`](../server/README.md#configuration).

### Client IP configuration

Set `TRUSTED_PROXY_IP` in the server environment to the exact immediate peer address the API sees from Caddy. A host proxy reaching a published container port may appear as the Docker bridge gateway. Only use this setting on an ingress path accessible exclusively to the proxy. Keep the API bound to loopback on the host and keep Caddy’s default handling of incoming forwarded headers. With the setting empty the API counts the socket peer, so everyone behind a proxy shares its allowance. Confirm separation from two real client addresses before go-live.

The per-client windows reset if the server restarts. An additive SQLite table, `llm_daily_usage`, keeps the daily allowance across restarts. Earlier images can ignore the table, but rolling back to an image that predates limits removes enforcement.

### External Caddy routes

Caddy should send `/api/*` and `/downloads/*` (the scanner) to the server, and everything else to the web container, so the browser sees one origin. Example site block:

```caddyfile
leaaf.green {
	@server path /api/* /downloads/*
	handle @server {
		reverse_proxy 127.0.0.1:3000
	}
	handle {
		reverse_proxy 127.0.0.1:8080
	}
}
```

Caddy streams Server-Sent Events (the report and scan-session routes) without extra settings. If Caddy runs in a container itself, `127.0.0.1` points at the Caddy container rather than the host. In that case, attach both services to a Docker network shared with Caddy and proxy to `web:8080` and `server:3000` instead.

## Post-release checks

Run these after every `docker compose up -d`:

```sh
docker compose ps                                     # web is "healthy", server is "running"
curl -fsS http://127.0.0.1:8080/healthz               # "ok"
curl -fsS -o /dev/null -w '%{http_code}\n' https://leaaf.green/d/example   # 200 (client route fallback)
curl -fsS -X POST https://leaaf.green/api/sessions    # {"session_id": ..., "download_url": ...}
curl -fsS -o /dev/null -w '%{http_code} %{size_download}\n' https://leaaf.green/downloads/leaaf-scanner.exe   # 200, several MB
```

Open `https://leaaf.green` in a browser and check that the landing page loads over HTTPS without the "Sample data" label. For the rate-limit smoke check, use a dedicated test client and repeatedly request the report for a missing device with a valid use. Expect 404 until the configured report allowance is spent, then 429 with a positive Retry-After. From a second client IP the first request should still return 404. Repeat on the upload route with an empty JSON object (400 until 429). This checks both client separation through Caddy and the limits without storing scans or calling the provider. Add a seeded-report check when the seed command is available.

## Rollback and data

- **Rollback:** Set `LEAAF_TAG` in `deploy/.env` to the previous release tag, then run `docker compose pull && docker compose up -d`. Every tag stays in GHCR. This has not been rehearsed yet (feature 005 AC-010).
- **Data:** Only the server has persistent data, in the `leaaf_server-data` volume. Pulling new images and recreating containers keeps it, but `docker compose down -v` deletes it. The server creates its SQLite database at `/data/leaaf.sqlite` on first start. The backup and restore procedure is not written yet.

## Evidence

Release runs and check results are recorded in the [feature 005 acceptance criteria](features/feature-005-public-demo-deployment/ACCEPTANCE_CRITERIA.md).
