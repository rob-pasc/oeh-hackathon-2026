# Deployment

How leaaf is built, published, and run in production. Scope and open decisions are in [feature 005](features/feature-005-public-demo-deployment/PLAN.md). This guide does not authorize a deployment; each release to the public host needs the team's go-ahead.

**State (2026-11-20):** The images, CI, and example Compose file exist. The server image runs the device and scan-session API (feature 001) but stays behind an opt-in Compose profile. Not yet covered: seeding demo devices, putting a scanner build into the server image or volume, rate limits, and the database backup procedure. The sections below say where these are still missing.

## What is released

| Image | Built from | Serves | Port |
|---|---|---|---|
| `ghcr.io/rob-pasc/leaaf-web` | [`web/Dockerfile`](../web/Dockerfile) | The built React app via unprivileged nginx ([`web/nginx.conf`](../web/nginx.conf)), with `index.html` fallback for client routes and `/healthz` | 8080 |
| `ghcr.io/rob-pasc/leaaf-server` | [`server/Dockerfile`](../server/Dockerfile) | The Node API (TypeScript run directly by Node 24), data under `/data` | 3000 |

Both build from the repository root because they need the root lockfile and `shared/`:

```sh
docker build -f web/Dockerfile -t leaaf-web .
docker build -f web/Dockerfile --build-arg VITE_API_MODE=live -t leaaf-web .   # talk to /api
docker build -f server/Dockerfile -t leaaf-server .
```

- **Web mode:** `VITE_API_MODE` is fixed when the image is built. The default and the CI build use `mock` (sample data, labeled as such). Once the backend routes exist, add `build-args: VITE_API_MODE=live` for the web image in the workflow.
- **Server:** The image runs `node src/main.ts` with `PORT=3000`, `HOST=0.0.0.0`, and `DATABASE_PATH=/data/leaaf.sqlite`. Set `PUBLIC_BASE_URL` in `deploy/.env`. The image contains no scanner build, so `/downloads/leaaf-scanner.exe` answers 404 until `SCANNER_EXE_PATH` points at one.

## CI and publishing

[`.github/workflows/ci.yaml`](../.github/workflows/ci.yaml) runs on every pull request, every push to `main`, and every tag push:

1. `checks`: `npm ci`, then the type check, tests, and build for all workspaces.
2. `images`: builds both images for `linux/amd64` (after `checks` passes). Only on a **tag push** does it log in to GHCR and push. Each image gets the Git tag name, `sha-<short sha>`, and `latest`.

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
docker compose up -d                       # web only
# docker compose --profile server up -d    # web and server, once the team decides to run it
```

Both containers publish their ports on `127.0.0.1` only. The server's data lives in the named volume `leaaf_server-data`. `deploy/.env` both configures Compose and is passed to the server container. The server variables are described in [`server/README.md`](../server/README.md#configuration).

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
docker compose ps                                     # web is "healthy"
curl -fsS http://127.0.0.1:8080/healthz               # "ok"
curl -fsS -o /dev/null -w '%{http_code}\n' https://leaaf.green/d/example   # 200 (client route fallback)
```

Open `https://leaaf.green` in a browser and check that the landing page loads over HTTPS. The checks for the API, upload, seeding, and rate limits will be added together with those features (feature 005 plan, "Post-release checks").

## Rollback and data

- **Rollback:** Set `LEAAF_TAG` in `deploy/.env` to the previous release tag, then run `docker compose pull && docker compose up -d`. Every tag stays in GHCR. This has not been rehearsed yet (feature 005 AC-010).
- **Data:** Only the server has persistent data, in the `leaaf_server-data` volume. Pulling new images and recreating containers keeps it, but `docker compose down -v` deletes it. The server creates its SQLite database at `/data/leaaf.sqlite` on first start. The backup and restore procedure is not written yet.

## Evidence

Release runs and check results are recorded in the [feature 005 acceptance criteria](features/feature-005-public-demo-deployment/ACCEPTANCE_CRITERIA.md).
