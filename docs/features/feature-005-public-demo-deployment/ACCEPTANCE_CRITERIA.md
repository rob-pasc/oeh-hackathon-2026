# Acceptance Criteria: Public demo deployment

- **Feature ID:** `feature-005-public-demo-deployment`
- **Verification status:** In progress

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence. Required release checks stay `Not run` or `Blocked` until performed against the live deployment.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001 | The public URL serves the landing page over HTTPS with a valid certificate, and HTTP redirects to HTTPS. | Manual check against the live deployment (record the URL, date, and version) | Not run | |
| AC-002 | FR-002 | The scanner downloaded from the public site, run on a Windows laptop, creates a device record on the public deployment and opens its public report URL. | Manual check against the live deployment | Not run | |
| AC-003 | FR-003 | Running the seed twice yields the same demo device IDs and record count. | Automated test, plus a live check | Not run | |
| AC-004 | FR-004 | With the LLM API key unset or the provider blocked, each seeded demo report renders its ranking, explanations, evidence, and mode toggle. | Automated test locally, plus a live check with the LLM disabled | Not run | |
| AC-005 | FR-005 | An upload over the size limit is rejected, and exceeding the per-client rate limit returns HTTP 429. | Automated tests, plus a live check | Blocked | Local HTTP check passed for 413 and independent upload/report 429 responses. Route tests verify client separation, configured proxy trust, window expiry and Retry-After. Public Caddy check awaits deployment. |
| AC-006 | FR-006 | After the daily LLM cap is reached, a new assessment returns template explanations with the unavailable notice and makes no LLM call. | Automated test with a mocked counter | Pass | Local API with a one-call SQLite allowance and a fake provider returned the template and fallback end event. Restarting the process against the same database still made zero additional provider calls. Automated tests cover the unavailable notice, UTC rollover, JSON repair and transport retries. |
| AC-007 | FR-007 | A secret scan of the repository and the scanner binary finds no API key, and API responses contain no secret values. | Automated secret scan, plus a `strings` check of the binary | Pass | 2026-11-20 @ df4d128, gitleaks v8.30.1 (Docker image): `git` mode over all 56 commits found no leaks. `dir` mode over the working tree found one `generic-api-key` in the developer's local `server/.env`, which is git-ignored and excluded by `.dockerignore`, so it is in neither the repository nor an image. The Windows scanner was built with the server image's flags (`-trimpath`, `-s -w -H windowsgui`, `backendURL=https://leaaf.green`); gitleaks skips binaries, so its `strings -n 8` output (28,021 lines) was scanned: no leaks, and no `sk-ant-`, `LLM_API_KEY`, or `api_key` text. Responses: `report-stream.test.ts` "never sends the LLM API key to clients…" configures a canary key with a provider that echoes it in a 401 and checks that the report stream and the device lookup do not contain it. Recheck on the CI-built release binary at deployment. |
| AC-008 | FR-008 | A device uploaded before a restart and redeploy is still retrievable afterwards. | Live check | Not run | |
| AC-009 | FR-009 | `docs/DEPLOYMENT.md` exists and a team member can follow it to deploy, seed, and run the smoke checks without additional help. | Review of the guide, plus a walkthrough during deployment | Not run | |
| AC-010 | Release and recovery | A rollback to the previous image tag and a SQLite backup restore are rehearsed once, with the outcome recorded. | Live rehearsal | Not run | |
| AC-011 | Review | The diff, deployment guide, and security settings are self-reviewed; the user's security review or acceptance of the self-review is recorded. | Self-review, plus user review or acceptance | Not run | |
| AC-012 | FR-010 | On a pull request, the workflow runs the type check, tests, build, and both image builds, and fails when any of them fails. | GitHub Actions run on a pull request (record the run URL) | Not run | |
| AC-013 | FR-011 | Pushing a tag publishes `leaaf-web` and `leaaf-server` to GHCR with the tag name, the short SHA, and `latest`. A pull request or push to `main` publishes nothing. | GitHub Actions run on a tag push, plus the GHCR package page | Not run | |
| AC-014 | FR-012 | On the host, `docker compose up -d` with the example Compose file serves the landing page on the loopback web port. A deep link such as `/d/<id>` returns the app, not a 404, and the ports are not reachable from outside the host. | Local or live check with Docker | Not run | |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: released behavior (see [PLAN.md § Review and integration](./PLAN.md#review-and-integration)). Live checks are blocked until a host is chosen and deployment is authorized. Not yet reviewed.

## Verification notes

- 2026-11-20, T-003, self-review of the limits diff based on `336e343`. Checked that both routes enforce the limit before handlers, reject spoofed forwarding from direct clients, and share one provider budget across extraction, explanation and SDK retries. Used an atomic reservation before transport so concurrent requests cannot overspend the last call. Workspace tests passed (68 shared, 229 server, 47 web), along with type checks and the live web build. User security review for release remains open.
- The [GitHub main push run for 021b4e1](https://github.com/rob-pasc/oeh-hackathon-2026/actions/runs/44800150298) passed. PR and tag verification remain open.

- 2026-11-20, local pre-checks for AC-012 to AC-014. These are not passes; the criteria need GitHub Actions and a Docker host. Docker is not installed on the dev machine, so the Dockerfile steps were run by hand:
  - Web build stage: `npm ci --workspace web --workspace shared` with only the manifests, then `VITE_API_MODE=mock npm run build --workspace web`. Produced `dist/index.html` and hashed assets.
  - Server stages: the `shared` build (`tsc`) and `npm ci --workspace server --workspace shared --omit=dev` (6 packages). Assembled in the image's runtime layout, the server modules loaded under `NODE_ENV=production`: the impact table read from `data/`, the SQLite fact cache was created, and `@leaaf/shared` resolved from `dist/`.
  - The CI `checks` job, on a clean copy of the working tree: `npm ci`, `npm run typecheck`, and `npm test` (131 tests in 8 files) passed, and `npm run build` passed.
  - `actionlint` v1.7.7 reports no problems in `.github/workflows/ci.yaml`. The workflow and Compose YAML parse.
  - Not checked: the actual `docker build` (base image pulls, `COPY` paths, nginx config syntax), the Compose file under `docker compose`, and publishing to GHCR.
- 2026-11-20, after merging feature 001's server into `main` (Docker 29.5.3, Docker Desktop on WSL2). Pre-checks, not passes. Both images built with `docker build` from the repository root. The server image needed `HOST=0.0.0.0` and `DATABASE_PATH=/data/leaaf.sqlite` to match `server/src/main.ts`; with them, a container on a fresh volume started, created `/data/leaaf.sqlite` owned by `node`, answered `POST /api/sessions` with 201 and an unknown device with 404, and answered `/downloads/leaaf-scanner.exe` with 404 (no scanner build in the image). The web container answered `/healthz` with `ok` and `/d/example` with 200.
- 2026-11-20, scanner in the server image, live web image, Go checks in CI. Pre-checks, not passes. Locally: `go vet ./...` for Linux and Windows and `go test ./...` in `scanner/` pass; `docker compose config` lists `server` and `web` without a profile. The workflow change was not linted (`actionlint` is not installed) and has not run on GitHub. Both images built with Docker. A server container served `/downloads/leaaf-scanner.exe` with 200 (7,158,784 bytes, `MZ` header); a session download was 37 bytes longer and ended with `LEAAFSCAN1:<session ID>`. The binary contains `https://leaaf.green` and the version passed as `SCANNER_VERSION`. A Linux build with the same flags, pointed at a local listener, uploaded there with the injected version, so the `-ldflags` override takes effect (the default `127.0.0.1:3000` string remains in the binary as unused data). A text search of the binary found no `LLM_API_KEY` or key-like string; this is not the secret scan AC-007 asks for. The web bundle contains the `/api/sessions` client. The full journey in a browser was not run.
- 2026-11-21, supersession note: feature 007 changes behavior covered here (FR-002's scanner download, now one per system); see its [plan](../feature-007-macos-linux-scanner/PLAN.md#related-and-superseded-features) and [acceptance criteria](../feature-007-macos-linux-scanner/ACCEPTANCE_CRITERIA.md). The results above describe the earlier behavior and stay as recorded; the new behavior is verified in feature 007.
