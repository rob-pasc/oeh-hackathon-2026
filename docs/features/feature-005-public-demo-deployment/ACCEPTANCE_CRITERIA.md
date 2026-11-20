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
| AC-005 | FR-005 | An upload over the size limit is rejected, and exceeding the per-client rate limit returns HTTP 429. | Automated tests, plus a live check | Not run | |
| AC-006 | FR-006 | After the daily LLM cap is reached, a new assessment returns template explanations with the unavailable notice and makes no LLM call. | Automated test with a mocked counter | Not run | |
| AC-007 | FR-007 | A secret scan of the repository and the scanner binary finds no API key, and API responses contain no secret values. | Automated secret scan, plus a `strings` check of the binary | Not run | |
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

- 2026-11-20, local pre-checks for AC-012 to AC-014. These are not passes; the criteria need GitHub Actions and a Docker host. Docker is not installed on the dev machine, so the Dockerfile steps were run by hand:
  - Web build stage: `npm ci --workspace web --workspace shared` with only the manifests, then `VITE_API_MODE=mock npm run build --workspace web`. Produced `dist/index.html` and hashed assets.
  - Server stages: the `shared` build (`tsc`) and `npm ci --workspace server --workspace shared --omit=dev` (6 packages). Assembled in the image's runtime layout, the server modules loaded under `NODE_ENV=production`: the impact table read from `data/`, the SQLite fact cache was created, and `@leaaf/shared` resolved from `dist/`.
  - The CI `checks` job, on a clean copy of the working tree: `npm ci`, `npm run typecheck`, and `npm test` (131 tests in 8 files) passed, and `npm run build` passed.
  - `actionlint` v1.7.7 reports no problems in `.github/workflows/ci.yaml`. The workflow and Compose YAML parse.
  - Not checked: the actual `docker build` (base image pulls, `COPY` paths, nginx config syntax), the Compose file under `docker compose`, and publishing to GHCR.
