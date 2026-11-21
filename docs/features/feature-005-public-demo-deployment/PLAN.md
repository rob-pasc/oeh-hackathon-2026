# Feature 005: Public demo deployment

- **Feature ID:** `feature-005-public-demo-deployment`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-20

## Summary

leaaf runs at a public HTTPS URL on the team's domain `leaaf.green`. The scanner download there is built to upload to it, and a few pre-scanned demo devices are seeded with cached results. A judge can open a demo report even if the live scan, the LLM, or the venue network misbehaves. *(2026-11-21: seeding was dropped; demos use live scans.)* The public upload endpoint gets basic abuse protection, secrets stay on the host, and `docs/DEPLOYMENT.md` documents how to deploy, seed, check, and roll back.

## Problem and desired outcome

- **Problem:** A localhost-only demo cannot be tried by judges, and a live demo that depends on fresh LLM calls and venue Wi-Fi can fail at the worst moment.
- **Desired outcome:** A stable public site with the full scan-to-report journey, and demo reports that work instantly from cached data *(the cached demo reports were dropped 2026-11-21)*.
- **Target users / stakeholders:** Judges and demo audience; the hackathon team running the demo; device owners trying it out.

## Approved scope

### In scope

- Hosting the server and web app at a public HTTPS URL, with persistent storage.
- A scanner build pointing at the public URL, served as the download.
- A seed command for 2–3 demo devices (plus an "uncertain model" case if useful), from stored scan JSON, with cached facts and explanations. *(Removed 2026-11-21: seeding dropped, see the scope change log.)*
- Request size limits and rate limiting on upload and assessment endpoints, and LLM spend containment.
- Secrets configured only through host environment settings.
- `docs/DEPLOYMENT.md` covering build, deploy, environment variables, ~~seeding,~~ smoke checks, backup, and rollback.
- Executing the deployment once the user authorizes it.
- *(Added 2026-11-20)* Two container images, `web` and `server`, built from the repository.
- *(Added 2026-11-20)* A GitHub Actions workflow that runs the checks (type check, tests, build) and the image builds on pull requests and on `main`, and pushes the images to the GitHub Container Registry (GHCR) when a Git tag is pushed.
- *(Added 2026-11-20)* An example production Compose file that runs both images on a host where an external Caddy terminates HTTPS and routes requests to them. The Caddy configuration itself is not part of the Compose file.

### Out of scope

- A multi-device or fleet dashboard, or a public list of demo devices (deferred). Demo links are kept in the deployment guide or demo script.
- Custom domain purchase, code signing of the scanner, CDN, or high availability.
- Monitoring and alerting beyond the host's built-in logs.
- Automatic deployment to the host (CD). CI builds and publishes the images; pulling and restarting them on the host stays a manual step. *(Narrowed 2026-11-20; originally all CI/CD automation was out of scope.)*

## Functional requirements

- **FR-001:** The web app and API are reachable at a public HTTPS URL.
- **FR-002:** The landing page's download link serves a scanner executable built with the public API URL; scanning a laptop with it creates a device record on the public deployment.
- **FR-003:** A seed command loads the demo devices from scan JSON files in the repository and stores their extracted facts and explanations for each intended use, so their reports need no live LLM call. Re-running it does not duplicate records and keeps their device IDs. *(Removed 2026-11-21: seeding dropped, see the scope change log.)*
- **FR-004:** The seeded demo reports render fully (ranking, explanations, evidence, mode toggle) while the LLM API is unreachable or disabled. *(Removed 2026-11-21: seeding dropped, see the scope change log.)*
- **FR-005:** The upload endpoint rejects bodies over the configured size limit, and the upload and assessment endpoints rate-limit requests per client (returning HTTP 429 when the limit is exceeded).
- **FR-006:** Fresh LLM calls are bounded by a configurable daily cap. When the cap is reached, new assessments use the feature 004 template fallback instead of calling the LLM.
- **FR-007:** The LLM API key and other secrets are set only in host environment configuration. None appear in the repository, the scanner binary, or responses to clients.
- **FR-008:** Device records and caches persist across application restarts and redeployments.
- **FR-009:** `docs/DEPLOYMENT.md` documents prerequisites, environment variables (names only), build and deploy steps, ~~seeding,~~ post-deploy smoke checks, backup of the SQLite database, and rollback to the previous release.
- **FR-010:** *(Added 2026-11-20; revised 2026-11-21: pull requests dropped, the team works without them)* Every push to `main` runs the type check, tests, and build for all workspaces, and builds both container images. A failure in any of them fails the workflow.
- **FR-011:** *(Added 2026-11-20)* Pushing a Git tag runs the same checks and then publishes the `web` and `server` images to GHCR. Each image is tagged with the Git tag name, the short commit SHA, and `latest`, so any earlier release can be redeployed by its tag. Pull requests and pushes to `main` build the images without publishing them.
- **FR-012:** *(Added 2026-11-20)* An example production Compose file runs the published images. The web container serves the built app with client-side route fallback. Both containers publish their ports only on the host's loopback interface for the external Caddy, and the server keeps its data on a named volume. *(Revised 2026-11-21: the file publishes both ports on all host interfaces, as the production host needs; the host firewall must keep them unreachable from outside, so only Caddy reaches them. Originally "on the host's loopback interface".)*

## Non-functional requirements and constraints

- **Reliability:** Demo reports load in under 2 seconds from cache on the public host. *(Removed 2026-11-21: seeding dropped, see the scope change log.)*
- **Security:** HTTPS only; rate limits; no secrets in client artifacts; logs do not contain full device IDs together with client IPs.
- **Cost:** The hosting and LLM spend fit a hackathon budget; the daily LLM cap enforces the latter.
- **Privacy:** Only feature 001's minimal payload is stored. The landing page's data disclosure stays accurate for the public deployment.

## User journeys and edge cases

1. **Judge tries the site:** Opens the public URL, downloads the scanner, scans a laptop, and sees the report.
2. **Network failure during the demo:** The presenter opens a seeded demo device link; the report and toggle work from cache. *(Removed 2026-11-21: seeding dropped, see the scope change log.)*
3. **LLM outage or cap reached:** New scans get template explanations with a notice; seeded devices are unaffected. *(2026-11-21: no seeded devices any more.)*
4. **Spam uploads:** Rapid uploads from one client get HTTP 429; oversized bodies are rejected.
5. **Bad release:** The smoke checks fail after a deploy, and the team rolls back to the previous release following the guide; the database is untouched or restored from backup.

## Proposed technical approach

Partly adopted (2026-11-20): the packaging, the host type, and the CI below. The rest is still a proposal.

- **Packaging (decided 2026-11-20, replaces the earlier one-image proposal):** Two images built from the repository root.
  - `web`: the Vite build served by unprivileged nginx on port 8080, with fallback to `index.html` for client-side routes. `VITE_API_MODE` is a build argument; the default and the CI build use `live` (decided 2026-11-20). Until features 003 and 004 add the report stream, a real scan reaches the result screen but it shows a connection error instead of the ranked paths.
  - `server`: Node 24 running the TypeScript sources directly, with `shared/` built and production dependencies only, on port 3000, with SQLite on a mounted volume. Since feature 001 added `server/src/main.ts` (merged 2026-11-20), the image sets `HOST=0.0.0.0` and `DATABASE_PATH=/data/leaaf.sqlite` for it. The example Compose file runs it by default with the web container (decided 2026-11-20).
- **Host type (decided 2026-11-20):** A VPS running Docker Compose behind an external Caddy managed outside this repository. Caddy routes `/api/*` and `/downloads/*` to `server` and everything else to `web`, so the browser sees one origin. The provider and account ownership are still open (T-001). *(2026-11-21: the host is the team's own server in Vorarlberg, Austria, operated by team member Marco Stadelmann, not a rented VPS; it runs the same Compose setup behind Caddy. Source: the privacy notice in `web/src/legal/`, confirmed by the user.)*
- **CI (decided 2026-11-20):** One GitHub Actions workflow, `.github/workflows/ci.yaml`. It also runs the scanner's `go vet` (Linux and Windows) and `go test`. On a tag push, images are pushed to `ghcr.io/<owner>/leaaf-web` and `ghcr.io/<owner>/leaaf-server` for `linux/amd64`.
- **Domain (decided 2026-11-20):** `leaaf.green`, already registered by the team, so no domain purchase is needed. The scanner release build points at `https://leaaf.green`. DNS records for the chosen host are set up in T-008.
- **Scanner build (adopted 2026-11-20):** A Go stage in `server/Dockerfile` cross-compiles with `GOOS=windows GOARCH=amd64` and injects the public URL and the release version with `-ldflags`. The server serves the binary at `/downloads/leaaf-scanner.exe`, appending the session trailer when asked.
- **Seeding:** `npm run seed` reads `demo/devices/*.json`, fixed demo device IDs, and pre-generated caches stored in `demo/cache/`. *(Removed 2026-11-21: seeding dropped, see the scope change log.)*
- **Rate limiting:** Independent in-process hourly windows for uploads and reports. The API trusts forwarded client addresses only from the configured Caddy peer. An additive SQLite table atomically reserves each outgoing provider attempt against the UTC day. Cached results and the existing template fallback remain available at the cap.
- **Tests:** Automated tests for the size limit, 429 behavior, ~~seed idempotency, cached render with the LLM disabled,~~ and the daily cap fallback; a secret scan of the repository and the scanner binary; manual smoke checks on the public URL.

## Dependencies and risks

- **Dependency:** Features 001–004 implemented.
- ~~**Blocking:** Hosting provider not chosen; deployment requires explicit user authorization and host credentials, which the user provides.~~ *(Resolved 2026-11-21: the team's own server, see the host type above.)*
- ~~**Blocking for seeding:** The three models are selected. Seeding still needs real scans (feature 002, T-006).~~ Seeding dropped 2026-11-21.
- **Risk:** An unsigned exe downloaded from a new domain triggers browser and SmartScreen warnings. Mitigation: guidance on the landing page; the demo laptop is prepared in advance.
- **Risk:** SQLite on ephemeral PaaS storage loses data. Mitigation: a persistent volume is required (FR-008), with backup documented.

## Review and integration

- **Completion boundary:** Released behavior, meaning the public deployment is live and the post-deploy checks pass.
- **Review:** Self-review of the diff, the deployment guide, and the security settings (rate limits, secrets), recorded in `ACCEPTANCE_CRITERIA.md`. Because this exposes a public endpoint that triggers paid API calls, the user is asked to review the security settings before go-live. They may accept the self-review instead.
- **CI/merge:** The GitHub Actions workflow (FR-010) must pass, in addition to local tests and type checks. Deploying, pushing, and merging each need explicit user authorization.

## Release and recovery (when applicable)

- **Guide:** `docs/DEPLOYMENT.md`, created by this feature.
- **Rollout order:**
  1. Build the image and the scanner.
  2. Provision the persistent volume and secrets.
  3. Deploy.
  4. ~~Run the seed.~~ (dropped 2026-11-21)
  5. Run the smoke checks.
  6. Publish the demo links to the team.
- **Data and migrations:** Initial deployment only, with no existing data to migrate. Schema changes must stay additive during the hackathon.
- **Irreversible steps:** None planned. Uploaded device records exist only on the volume; deleting the volume loses them.
- **Rollback:** Redeploy the previous image tag. If a release corrupts the database, restore the last SQLite backup; uploads after that backup are lost. Rollback is unverified until rehearsed once (see AC-010).
- **Post-release checks:**
  - The landing page loads over HTTPS.
  - The download returns the exe.
  - A test upload returns a link.
  - ~~The seeded demo reports render with the LLM disabled.~~ (dropped 2026-11-21)
  - The 429 behavior triggers.
- **Stop condition:** Any failed check. Recover by rollback.
- **Execution:** Release execution and live verification are in scope. *(2026-11-21: `v0.5.0` is deployed at `https://leaaf.green`; the date of the first deployment is not recorded here. Seeding was dropped the same day.)*

## Assumptions and open questions

- **Decided 2026-11-21:** The host is the team's own server in Vorarlberg, operated by Marco Stadelmann, who holds its access. (Previously blocking: "Which VPS provider, and who owns the account?")
- **Settled 2026-11-21 (observed):** Both GHCR packages are public, so the host needs no login to pull. (Previously open: public packages or a read-only token.)
- **Decided 2026-11-20:** Configurable defaults are 10 uploads and 60 report requests per client per hour, and 200 provider attempts per UTC day. The upload ceiling defaults to 32 KiB. See the [server configuration](../../../server/README.md#request-limits).
- **Open:** Whether to keep the public deployment running after the hackathon. Default: until the user decides otherwise.

## Scope change log

| Date       | Change                 | User approval                                                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Initial approved scope | User replied "accept" to the five-feature MVP proposal in the specification conversation, 2026-11-20 |
| 2026-11-20 | Scope revision before implementation. Adds two images (`web`, `server`), a CI workflow that publishes them to GHCR (FR-010, FR-011), and an example production Compose file for an external Caddy (FR-012). Narrows the CI/CD exclusion to automatic deployment only. Adopts two-image packaging instead of one image, and a VPS with external Caddy as the host type. The server image is prepared but not runnable until feature 001 adds the HTTP entry point. The web image builds in mock mode for now. | User chose "Accept and implement" in the docker/CI conversation, 2026-11-20. They chose "Dockerfile only" for the server ("let's just wait with the backend / server") and asked to publish only when a tag is pushed |
| 2026-11-20 | Decisions within FR-002, FR-010, and FR-012, no requirement changed. CI also runs the scanner's Go checks. The server image builds and serves the scanner release (FR-002). The web image is built against the real API, and the example Compose file runs the server by default. Accepted consequence: until features 003 and 004 exist, a real scan ends on a result screen with a connection error instead of the ranked paths. | User asked to fix the three gaps reported after the merge ("Fix these. Commit on main") and chose "Real API only" over a separate demo image or an opt-in switch, 2026-11-20 |

| 2026-11-21 | FR-010 and AC-012 no longer require a pull request run: the workflow is verified on pushes to `main` (the `pull_request` trigger stays in the workflow but is unused). FR-012 and AC-014 accept ports published on all interfaces with the host firewall keeping them closed (production change 6c85995). The host is recorded as the team's own server. | User, 2026-11-21: "remove that need entirely, we do not work with PRs here in this repo/team"; for the ports the user chose "Accept and document"; for the host "Marco's own server" |

| 2026-11-21 | Seeding removed before it was implemented: FR-003 and FR-004 with AC-003 and AC-004, task T-004, the seed parts of FR-009, AC-009, T-006 and T-008, journeys 2 and 3, the reliability goal and the seed steps of the rollout. The live site serves real scans. Struck-through text keeps the original scope readable. | User, 2026-11-21: chose "Drop it" for the seed command, after the live site was working |

## Related and superseded features

None superseded. Deploys features [001](../feature-001-device-scan-and-upload/PLAN.md)–[004](../feature-004-explained-report/PLAN.md). FR-006 relies on [feature 004](../feature-004-explained-report/PLAN.md) FR-009 (template fallback) without changing it.

**FR-002 extended by [feature 007](../feature-007-macos-linux-scanner/PLAN.md#related-and-superseded-features) FR-012 and FR-017** (implemented on `main` 2026-11-21, commits "feat(server): serve the scanner for Windows, macOS and Linux" and "ci(scanner): build and ship the macOS and Linux scanners"): the server image also serves a Linux scanner built in the Dockerfile and a macOS app built by a CI macOS job. The Windows build and its URL are unchanged.

**Deployment settings extended by [feature 016](../feature-016-admin-scan-overview/PLAN.md#related-and-superseded-features)** (merged into `main` on 2026-11-21 (commit "Merge branch 'feat/adminpage' into main")): `deploy/.env.example` and the deployment guide gain `ADMIN_USERNAME` and `ADMIN_PASSWORD` and admin post-release checks. The deployment itself is unchanged; without the variables the admin area stays off.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Deployment guide: `docs/DEPLOYMENT.md` (to be created by this feature)
- Related ADRs: [ADR-006](../../adr/adr-006-images-ghcr-vps-caddy.md) (two images on GHCR behind an external Caddy; the host is now the team's own server, see its note)
