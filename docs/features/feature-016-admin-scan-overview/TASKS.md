# Implementation Tasks: Admin scan overview

- **Feature ID:** `feature-016-admin-scan-overview`
- **Status:** Implemented (verification pending)

This is the **authoritative progress checklist**. Draft ordered, independently verifiable tasks after scope approval. Map tasks to acceptance criteria where practical. Check a task only after its work is actually complete.

`Status` above is the feature's only lifecycle status. Use one of:

- `Specified`: specs written; readiness not yet checked.
- `Ready`: readiness checked before implementation; remaining blockers are listed below.
- `In progress`: implementation underway.
- `Implemented (verification pending)`: implementation done, but required verification, review, finding resolution, or integration checks remain. Keep those tasks unchecked.
- `Complete`: the agreed completion boundary is met, including every required current-scope acceptance criterion and review/integration check, or the user has explicitly accepted exceptions permitted by repository policy. For amendments, consult appended verification runs; historical passes do not override current failures or missing verification.

## Tasks

- [x] **T-001:** Shared contracts: admin login body, session and scan-list response schemas in `shared/`, routes documented in `shared/src/api.ts`, JSON Schemas exported. (supports `AC-011`, `AC-013`)
- [x] **T-002:** Server configuration: `loadAdminConfig` (both variables required, 16-character minimum, warning without the password) and conditional route registration. (supports `AC-001`, `AC-003`)
- [x] **T-003:** Server authentication: constant-time credential check, in-memory sessions with 12-hour expiry, cookie helper with the required flags, login, logout and session routes, JSON-only bodies, `no-store` on admin responses. (supports `AC-004`, `AC-005`, `AC-008`, `AC-009`, `AC-010`, `AC-014`, `AC-015`)
- [x] **T-004:** Server rate limits for failed logins: per client and global 15-minute windows with `Retry-After`. (supports `AC-006`, `AC-007`)
- [x] **T-005:** Server scan list: `DeviceStore.list` and `count`, `GET /api/admin/scans` with paging, and the updated route inventory test. (supports `AC-011`, `AC-012`, `AC-013`, `AC-016`)
- [x] **T-006:** Web admin page: `/admin` route, login form with the generic error and the rate-limit message, scan table with pagination and device links, log out, "not set up" state, `noindex`, live and mock client calls, and tests. (supports `AC-001`, `AC-002`, `AC-004`, `AC-010`, `AC-011`, `AC-012`, `AC-014`)
- [x] **T-007:** Privacy notice (DE/EN) cookie section and a test that public pages set no cookie. (supports `AC-017`)
- [x] **T-008:** Documentation: `server/.env.example`, `deploy/.env.example`, `server/README.md`, `docs/DEPLOYMENT.md` (setup and post-release checks), README status, notes on features 001, 005 and 006, feature index. (supports `AC-018`)
- [x] **T-009:** Self-review of the final diff (authentication, sessions, rate limits, logging), record findings and their resolution, rerun the checks. (supports `AC-019`)
- [ ] **T-010:** After the release: post-release checks on the deployed site. (supports `AC-018`)

- [x] **T-011:** *(revision 2026-11-21)* Fallback log: additive `ai_fallbacks` table, reason mapping, `onFallback` in the category and step services, wiring in `main.ts`, and tests. (supports `AC-024`)
- [x] **T-012:** *(revision 2026-11-21)* Admin insights: `AdminScanDetail` and `ai_usage` contracts, `GET /api/admin/scans/:id`, category and step status, fallbacks and AI usage queries, route inventory update, and tests. (supports `AC-020`, `AC-021`, `AC-022`, `AC-023`, `AC-025`, `AC-026`)
- [x] **T-013:** *(revision 2026-11-21)* Web: Details per row with formatted JSON, Copy JSON, AI status and fallbacks, AI calls today, live and mock client, and tests. (supports `AC-020`, `AC-022`, `AC-023`, `AC-025`)
- [x] **T-014:** *(revision 2026-11-21)* Docs: server README routes, the plan's approach, and a re-run of the existing admin checks for regressions. (supports `AC-019`)
- [x] **T-015:** *(revision 2026-11-21)* Self-review of the revision and finding resolution. (supports `AC-019`)

## Dependencies and blockers

- T-010 needs a release and deployment, which need the user's authorization, and `ADMIN_USERNAME`/`ADMIN_PASSWORD` set on the host.
- Per-client limits in production depend on `TRUSTED_PROXY_IP` being set correctly (see the plan's dependencies).

## Progress notes

- 2026-11-21: Server and contracts done. `ApiError` gains the codes `unauthorized` and `unsupported_media_type`. Fastify refuses bodies it has no parser for (such as form-encoded) with 400 before the login route runs; `text/plain` reaches the route and gets 415. Either way no session starts (AC-015). The request-log serializer moved into `app.ts` as `REQUEST_LOG_SERIALIZERS`, so the log test uses the production serializer.
- 2026-11-21: Web page done. `ApiClientError` gains an optional `retryAfter` from the 429 header, so the form can say how long to wait. Mock mode accepts the sample login `admin` / `sample-admin-password` and shows it on the form; the live server never knows it. The page sets a `robots` meta tag while shown, and the server adds `X-Robots-Tag` to every admin API response.
- 2026-11-21 (revision): The explanation report (feature 004) is no longer wired into the server, so only the category and step calls record fallbacks. A step template shown because the categories already fell back is not recorded twice. The fallback log is a new additive table `ai_fallbacks`; the insights module reads the service caches and treats a missing table as empty.

## Lifecycle history

- 2026-11-21: Implementation started after the user replied "ok lets go".
- 2026-11-21: Implementation and self-review done on `feat/adminpage`. Status Implemented (verification pending): the browser checks of AC-002 and AC-017, merge into `main`, and the post-release check (T-010, AC-018) are open. Evidence: [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md#review-and-integration-evidence).
- 2026-11-21: Scope extended by the [revision](./PLAN.md#scope-change-log) (FR-013 to FR-017); status back to In progress for T-011 to T-015.
- 2026-11-21: Revision implemented and self-reviewed (AC-020 to AC-026 pass). Status Implemented (verification pending): the browser checks of AC-002 and AC-017, merge into `main`, and the post-release check (T-010, AC-018) are still open.
