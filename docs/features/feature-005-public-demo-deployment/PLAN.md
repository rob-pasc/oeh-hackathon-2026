# Feature 005: Public demo deployment

- **Feature ID:** `feature-005-public-demo-deployment`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-20

## Summary

Second Life Scanner runs at a public HTTPS URL. The scanner download there is built to upload to it, and a few pre-scanned demo devices are seeded with cached results. A judge can open a demo report even if the live scan, the LLM, or the venue network misbehaves. The public upload endpoint gets basic abuse protection, secrets stay on the host, and `docs/DEPLOYMENT.md` documents how to deploy, seed, check, and roll back.

## Problem and desired outcome

- **Problem:** A localhost-only demo cannot be tried by judges, and a live demo that depends on fresh LLM calls and venue Wi-Fi can fail at the worst moment.
- **Desired outcome:** A stable public site with the full scan-to-report journey, and demo reports that work instantly from cached data.
- **Target users / stakeholders:** Judges and demo audience; the hackathon team running the demo; device owners trying it out.

## Approved scope

### In scope

- Hosting the server and web app at a public HTTPS URL, with persistent storage.
- A scanner build pointing at the public URL, served as the download.
- A seed command for 2–3 demo devices (plus an "uncertain model" case if useful), from stored scan JSON, with cached facts and explanations.
- Request size limits and rate limiting on upload and assessment endpoints, and LLM spend containment.
- Secrets configured only through host environment settings.
- `docs/DEPLOYMENT.md` covering build, deploy, environment variables, seeding, smoke checks, backup, and rollback.
- Executing the deployment once the user authorizes it.

### Out of scope

- A multi-device or fleet dashboard, or a public list of demo devices (deferred). Demo links are kept in the deployment guide or demo script.
- Custom domain purchase, code signing of the scanner, CDN, or high availability.
- Monitoring and alerting beyond the host's built-in logs.
- CI/CD automation (manual deploy is acceptable).

## Functional requirements

- **FR-001:** The web app and API are reachable at a public HTTPS URL.
- **FR-002:** The landing page's download link serves a scanner executable built with the public API URL; scanning a laptop with it creates a device record on the public deployment.
- **FR-003:** A seed command loads the demo devices from scan JSON files in the repository and stores their extracted facts and explanations for each intended use, so their reports need no live LLM call. Re-running it does not duplicate records and keeps their device IDs.
- **FR-004:** The seeded demo reports render fully (ranking, explanations, evidence, mode toggle) while the LLM API is unreachable or disabled.
- **FR-005:** The upload endpoint rejects bodies over the configured size limit, and the upload and assessment endpoints rate-limit requests per client (returning HTTP 429 when the limit is exceeded).
- **FR-006:** Fresh LLM calls are bounded by a configurable daily cap. When the cap is reached, new assessments use the feature 004 template fallback instead of calling the LLM.
- **FR-007:** The LLM API key and other secrets are set only in host environment configuration. None appear in the repository, the scanner binary, or responses to clients.
- **FR-008:** Device records and caches persist across application restarts and redeployments.
- **FR-009:** `docs/DEPLOYMENT.md` documents prerequisites, environment variables (names only), build and deploy steps, seeding, post-deploy smoke checks, backup of the SQLite database, and rollback to the previous release.

## Non-functional requirements and constraints

- **Reliability:** Demo reports load in under 2 seconds from cache on the public host.
- **Security:** HTTPS only; rate limits; no secrets in client artifacts; logs do not contain full device IDs together with client IPs.
- **Cost:** The hosting and LLM spend fit a hackathon budget; the daily LLM cap enforces the latter.
- **Privacy:** Only feature 001's minimal payload is stored. The landing page's data disclosure stays accurate for the public deployment.

## User journeys and edge cases

1. **Judge tries the site:** Opens the public URL, downloads the scanner, scans a laptop, and sees the report.
2. **Network failure during the demo:** The presenter opens a seeded demo device link; the report and toggle work from cache.
3. **LLM outage or cap reached:** New scans get template explanations with a notice; seeded devices are unaffected.
4. **Spam uploads:** Rapid uploads from one client get HTTP 429; oversized bodies are rejected.
5. **Bad release:** The smoke checks fail after a deploy, and the team rolls back to the previous release following the guide; the database is untouched or restored from backup.

## Proposed technical approach

Not yet adopted; the host is undecided.

- **Packaging:** One Docker image. Node serves the API and the built React assets, SQLite lives on a mounted persistent volume, and the corpus index is built into the image or the volume.
- **Host:** **Open.** Candidates are a small VPS with Docker and a reverse proxy (Caddy for automatic HTTPS), or a PaaS with persistent volumes (for example Fly.io, Render, Railway). Chosen with the user before deployment.
- **Scanner build:** Cross-compile with `GOOS=windows GOARCH=amd64` and inject the public URL with `-ldflags`; the binary is published as a static asset.
- **Seeding:** `npm run seed` reads `demo/devices/*.json`, fixed demo device IDs, and pre-generated caches stored in `demo/cache/`.
- **Rate limiting:** In-process per-IP limits (for example `@fastify/rate-limit`); a daily LLM counter in SQLite.
- **Tests:** Automated tests for the size limit, 429 behavior, seed idempotency, cached render with the LLM disabled, and the daily cap fallback; a secret scan of the repository and the scanner binary; manual smoke checks on the public URL.

## Dependencies and risks

- **Dependency:** Features 001–004 implemented.
- **Blocking:** Hosting provider not chosen; deployment requires explicit user authorization and host credentials, which the user provides.
- **Blocking for seeding:** Demo models chosen and scanned (feature 002, T-006).
- **Risk:** An unsigned exe downloaded from a new domain triggers browser and SmartScreen warnings. Mitigation: guidance on the landing page; the demo laptop is prepared in advance.
- **Risk:** SQLite on ephemeral PaaS storage loses data. Mitigation: a persistent volume is required (FR-008), with backup documented.

## Review and integration

- **Completion boundary:** Released behavior, meaning the public deployment is live and the post-deploy checks pass.
- **Review:** Self-review of the diff, the deployment guide, and the security settings (rate limits, secrets), recorded in `ACCEPTANCE_CRITERIA.md`. Because this exposes a public endpoint that triggers paid API calls, the user is asked to review the security settings before go-live. They may accept the self-review instead.
- **CI/merge:** No CI. Local tests and type checks must pass. Deploying, pushing, and merging each need explicit user authorization.

## Release and recovery (when applicable)

- **Guide:** `docs/DEPLOYMENT.md`, created by this feature.
- **Rollout order:**
  1. Build the image and the scanner.
  2. Provision the persistent volume and secrets.
  3. Deploy.
  4. Run the seed.
  5. Run the smoke checks.
  6. Publish the demo links to the team.
- **Data and migrations:** Initial deployment only, with no existing data to migrate. Schema changes must stay additive during the hackathon.
- **Irreversible steps:** None planned. Uploaded device records exist only on the volume; deleting the volume loses them.
- **Rollback:** Redeploy the previous image tag. If a release corrupts the database, restore the last SQLite backup; uploads after that backup are lost. Rollback is unverified until rehearsed once (see AC-010).
- **Post-release checks:**
  - The landing page loads over HTTPS.
  - The download returns the exe.
  - A test upload returns a link.
  - The seeded demo reports render with the LLM disabled.
  - The 429 behavior triggers.
- **Stop condition:** Any failed check. Recover by rollback.
- **Execution:** Release execution and live verification are in scope, pending user authorization and host choice.

## Assumptions and open questions

- **Blocking:** Which hosting provider, and who owns the account and credentials?
- **Open:** Rate limit values and the daily LLM cap. Proposed: 10 uploads per IP per hour, and 200 LLM calls per day.
- **Open:** Whether to keep the public deployment running after the hackathon. Default: until the user decides otherwise.

## Scope change log

| Date       | Change                 | User approval                                                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Initial approved scope | User replied "accept" to the five-feature MVP proposal in the specification conversation, 2026-11-20 |

## Related and superseded features

None superseded. Deploys features [001](../feature-001-device-scan-and-upload/PLAN.md)–[004](../feature-004-explained-report/PLAN.md). FR-006 relies on [feature 004](../feature-004-explained-report/PLAN.md) FR-009 (template fallback) without changing it.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Deployment guide: `docs/DEPLOYMENT.md` (to be created by this feature)
- Related ADRs: None yet
