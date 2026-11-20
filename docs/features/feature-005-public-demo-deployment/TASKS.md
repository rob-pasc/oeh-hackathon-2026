# Implementation Tasks: Public demo deployment

- **Feature ID:** `feature-005-public-demo-deployment`
- **Status:** Specified

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

## Dependencies and blockers

- **Blocking:** Hosting provider undecided (T-001); deployment requires explicit user authorization (T-008).
- Requires features 001–004 implemented; seeding requires the demo models to be chosen.

## Progress notes

None yet.

## Lifecycle history

No lifecycle events recorded yet.
