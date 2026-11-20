# Implementation Tasks: Device scan and upload

- **Feature ID:** `feature-001-device-scan-and-upload`
- **Status:** In progress

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [ ] **T-001:** Set up the repository layout (`scanner/`, `server/`, `web/`, `shared/`) with build, test, and type-check commands, and document them in the README (supports all ACs)
- [x] **T-002:** Define the versioned device JSON schema in `shared/`, including nullable fields and `scan_status` (supports `AC-003`, `AC-006`)
- [ ] **T-003:** Implement the Go collectors and normalization with fixture-based unit tests, including null handling (supports `AC-002`, `AC-003`)
- [ ] **T-004:** Implement the payload builder's privacy allowlist with a planted-identifier test (supports `AC-004`)
- [ ] **T-005:** Implement the local JSON write, HTTPS upload, link output, browser open, and failure exit code (supports `AC-005`, `AC-008`)
- [ ] **T-006:** Implement the upload endpoint with schema validation, a size limit, SQLite storage, and secure ID generation, with integration tests (supports `AC-006`, `AC-007`)
- [ ] **T-007:** Implement `GET /api/devices/:id` and the not-found behavior, with tests (supports `AC-010`)
- [ ] **T-008:** Build the React landing page with the download and data disclosure, and the device page with "Unknown" rendering, with tests (supports `AC-009`, `AC-011`)
- [ ] **T-009:** Run the scanner manually on a real Windows laptop as a non-admin user and record the evidence (supports `AC-001`, `AC-005`, `AC-008`)
- [ ] **T-011:** *(amendment)* Implement the FR-013 collectors (RAM slots and type, TPM, Secure Boot, firmware type, battery cycle count, GPU names) with fixture tests, including access-denied cases (supports `AC-013`)
- [ ] **T-010:** Run all checks, self-review the diff against the plan, record the findings, and update the README and the feature index (supports `AC-012`)

## Dependencies and blockers

- T-009 needs access to a Windows laptop. Not blocking for the other tasks.

## Progress notes

- 2026-11-20: At the user's request, the top-level folders (`scanner/`, `server/`, `web/`, `shared/`, `corpus/`, `data/`, `demo/`) were created with README placeholders only. T-001 remains open: there are no build, test, or type-check commands yet, and implementation of this feature had not started at that point.
- 2026-11-20: T-002 done. The versioned device schema and the cross-feature contracts are in `shared/` (`npm test -w shared` passes; see the [shared README](../../../shared/README.md)). T-001 is partly done: the npm workspace and the `shared` package have build, test, and type-check scripts, while `scanner/`, `server/`, and `web/` are not set up yet.
- 2026-11-20: The `server` workspace exists (TypeScript run natively by Node 24, Vitest) but so far contains only the LLM adapter; the HTTP API (T-006, T-007) is not started.
- Unverified assumption for T-003/T-011: whether `root\WMI` battery classes and `Win32_Tpm` can be read without admin rights. Test this early on a real laptop; the schema already allows `null`.

## Lifecycle history

- 2026-11-20: Scope extended by an amendment (FR-013, AC-013, T-011); see the [scope change log](./PLAN.md#scope-change-log).
- 2026-11-20: Implementation started (T-002, shared contracts).
