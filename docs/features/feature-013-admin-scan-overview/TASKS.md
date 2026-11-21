# Implementation Tasks: Admin scan overview

- **Feature ID:** `feature-013-admin-scan-overview`
- **Status:** Specified

This is the **authoritative progress checklist**. Draft ordered, independently verifiable tasks after scope approval. Map tasks to acceptance criteria where practical. Check a task only after its work is actually complete.

`Status` above is the feature's only lifecycle status. Use one of:

- `Specified`: specs written; readiness not yet checked.
- `Ready`: readiness checked before implementation; remaining blockers are listed below.
- `In progress`: implementation underway.
- `Implemented (verification pending)`: implementation done, but required verification, review, finding resolution, or integration checks remain. Keep those tasks unchecked.
- `Complete`: the agreed completion boundary is met, including every required current-scope acceptance criterion and review/integration check, or the user has explicitly accepted exceptions permitted by repository policy. For amendments, consult appended verification runs; historical passes do not override current failures or missing verification.

## Tasks

- [ ] **T-001:** Shared contracts: admin login body, session and scan-list response schemas in `shared/`, routes documented in `shared/src/api.ts`, JSON Schemas exported. (supports `AC-011`, `AC-013`)
- [ ] **T-002:** Server configuration: `loadAdminConfig` (both variables required, 16-character minimum, warning without the password) and conditional route registration. (supports `AC-001`, `AC-003`)
- [ ] **T-003:** Server authentication: constant-time credential check, in-memory sessions with 12-hour expiry, cookie helper with the required flags, login, logout and session routes, JSON-only bodies, `no-store` on admin responses. (supports `AC-004`, `AC-005`, `AC-008`, `AC-009`, `AC-010`, `AC-014`, `AC-015`)
- [ ] **T-004:** Server rate limits for failed logins: per client and global 15-minute windows with `Retry-After`. (supports `AC-006`, `AC-007`)
- [ ] **T-005:** Server scan list: `DeviceStore.list` and `count`, `GET /api/admin/scans` with paging, and the updated route inventory test. (supports `AC-011`, `AC-012`, `AC-013`, `AC-016`)
- [ ] **T-006:** Web admin page: `/admin` route, login form with the generic error and the rate-limit message, scan table with pagination and device links, log out, "not set up" state, `noindex`, live and mock client calls, and tests. (supports `AC-001`, `AC-002`, `AC-004`, `AC-010`, `AC-011`, `AC-012`, `AC-014`)
- [ ] **T-007:** Privacy notice (DE/EN) cookie section and a test that public pages set no cookie. (supports `AC-017`)
- [ ] **T-008:** Documentation: `server/.env.example`, `deploy/.env.example`, `server/README.md`, `docs/DEPLOYMENT.md` (setup and post-release checks), README status, notes on features 001, 005 and 006, feature index. (supports `AC-018`)
- [ ] **T-009:** Self-review of the final diff (authentication, sessions, rate limits, logging), record findings and their resolution, rerun the checks. (supports `AC-019`)
- [ ] **T-010:** After the release: post-release checks on the deployed site. (supports `AC-018`)

## Dependencies and blockers

- T-010 needs a release and deployment, which need the user's authorization, and `ADMIN_USERNAME`/`ADMIN_PASSWORD` set on the host.
- Per-client limits in production depend on `TRUSTED_PROXY_IP` being set correctly (see the plan's dependencies).

## Progress notes

No implementation yet.

## Lifecycle history

No lifecycle events recorded yet.
