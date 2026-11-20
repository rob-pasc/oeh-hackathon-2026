# Implementation Tasks: Public demo deployment

- **Feature ID:** `feature-005-public-demo-deployment`
- **Status:** In progress

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [ ] **T-001:** Get the user's choice of hosting provider and account ownership, and record it in the plan (supports `AC-001`)
- [ ] **T-002:** Add the Dockerfile and production config (static web assets, persistent volume path, environment variables) (supports `AC-001`, `AC-008`)
- [ ] **T-003:** Implement the size limits, per-client rate limits, and daily LLM cap with fallback, with tests (supports `AC-005`, `AC-006`)
- [ ] **T-004:** Implement the idempotent seed command and the demo device and cache files, with tests including an LLM-disabled render (supports `AC-003`, `AC-004`)
- [ ] **T-005:** Add the scanner release build with the public URL and serve it as the download; run a secret scan of the repository and the binary (supports `AC-002`, `AC-007`)
- [ ] **T-006:** Write `docs/DEPLOYMENT.md` (deploy, seed, smoke checks, backup, rollback) (supports `AC-009`)
- [ ] **T-007:** Self-review and request the user's security review or acceptance before go-live (supports `AC-011`)
- [ ] **T-008:** With user authorization, deploy, seed, and run the post-release smoke checks, recording the version and evidence (supports `AC-001`–`AC-005`, `AC-008`)
- [ ] **T-009:** Rehearse the rollback and backup restore, recording the outcome (supports `AC-010`)
- [ ] **T-010:** Update the README status and the feature index with the public deployment state (supports `AC-009`, `AC-011`)
- [x] **T-011:** *(Added 2026-11-20)* Add the `web` and `server` Dockerfiles, the nginx config, and `.dockerignore` (supports `AC-012`, `AC-014`; covers the image part of T-002)
- [x] **T-012:** *(Added 2026-11-20)* Add `.github/workflows/ci.yaml` with the checks, the image builds, and publishing to GHCR on tag pushes (supports `AC-012`, `AC-013`)
- [x] **T-013:** *(Added 2026-11-20)* Add the example production Compose file and document the images, the CI, the Compose setup, and the external Caddy routes in `docs/DEPLOYMENT.md` (supports `AC-014`, `AC-009`)
- [ ] **T-014:** *(Added 2026-11-20)* Verify on GitHub: a PR run, a tag push that publishes, and the Compose file on a Docker host (supports `AC-012`–`AC-014`)

## Dependencies and blockers

- **Blocking:** VPS provider undecided; the host type (VPS with external Caddy) is decided (T-001). Deployment requires explicit user authorization (T-008).
- The `server` image runs, but has no scanner build to serve (`SCANNER_EXE_PATH`).
- Requires features 001–004 implemented; seeding requires the demo models to be chosen.

## Progress notes

- 2026-11-20: T-011 to T-013 done. The steps of both image builds and the CI checks were run locally outside Docker, because Docker isn't installed on the dev machine. Details are in the [verification notes](./ACCEPTANCE_CRITERIA.md#verification-notes). No image has been built with Docker yet; the first PR run covers that (T-014). The web part of T-002 is covered by T-011. The production config for the server (data path, port) is prepared but waits for the server's entry point.
- 2026-11-20: Feature 001's server entry point was merged into `main`. The server image now sets `HOST` and `DATABASE_PATH` for it, the Caddy example routes `/downloads/*` to the server, and both images were built and started with Docker for the first time (see the [verification notes](./ACCEPTANCE_CRITERIA.md#verification-notes)). The Compose profile still keeps the server opt-in.

## Lifecycle history

- 2026-11-20: Scope revised before implementation (images, CI to GHCR, example Compose file; see the [scope change log](./PLAN.md#scope-change-log)). Implementation of T-011 to T-013 authorized by the user in the same conversation.
- 2026-11-20: Implementation started (status Specified → In progress).
