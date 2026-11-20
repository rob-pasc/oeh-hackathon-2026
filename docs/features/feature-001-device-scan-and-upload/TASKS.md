# Implementation Tasks: Device scan and upload

- **Feature ID:** `feature-001-device-scan-and-upload`
- **Status:** Specified

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [ ] **T-001:** Set up the repository layout (`scanner/`, `server/`, `web/`, `shared/`) with build, test, and type-check commands, and document them in the README (supports all ACs)
- [ ] **T-002:** Define the versioned device JSON schema in `shared/`, including nullable fields and `scan_status` (supports `AC-003`, `AC-006`)
- [ ] **T-003:** Implement the Go collectors and normalization with fixture-based unit tests, including null handling (supports `AC-002`, `AC-003`)
- [ ] **T-004:** Implement the payload builder's privacy allowlist with a planted-identifier test (supports `AC-004`)
- [ ] **T-005:** Implement the local JSON write, HTTPS upload, link output, browser open, and failure exit code (supports `AC-005`, `AC-008`)
- [ ] **T-006:** Implement the upload endpoint with schema validation, a size limit, SQLite storage, and secure ID generation, with integration tests (supports `AC-006`, `AC-007`)
- [ ] **T-007:** Implement `GET /api/devices/:id` and the not-found behavior, with tests (supports `AC-010`)
- [ ] **T-008:** Build the React landing page with the download and data disclosure, and the device page with "Unknown" rendering, with tests (supports `AC-009`, `AC-011`)
- [ ] **T-009:** Run the scanner manually on a real Windows laptop as a non-admin user and record the evidence (supports `AC-001`, `AC-005`, `AC-008`)
- [ ] **T-010:** Run all checks, self-review the diff against the plan, record the findings, and update the README and the feature index (supports `AC-012`)

## Dependencies and blockers

- T-009 needs access to a Windows laptop. Not blocking for the other tasks.

## Progress notes

None yet.

## Lifecycle history

No lifecycle events recorded yet.
