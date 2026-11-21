# Implementation Tasks: macOS and Linux scanner

- **Feature ID:** `feature-007-macos-linux-scanner`
- **Status:** In progress

This is the **authoritative progress checklist**. Draft ordered, independently verifiable tasks after scope approval. Map tasks to acceptance criteria where practical. Check a task only after its work is actually complete.

`Status` above is the feature's only lifecycle status. Use one of:

- `Specified`: specs written; readiness not yet checked.
- `Ready`: readiness checked before implementation; remaining blockers are listed below.
- `In progress`: implementation underway.
- `Implemented (verification pending)`: implementation done, but required verification, review, finding resolution, or integration checks remain. Keep those tasks unchecked.
- `Complete`: the agreed completion boundary is met, including every required current-scope acceptance criterion and review/integration check, or the user has explicitly accepted exceptions permitted by repository policy. For amendments, consult appended verification runs; historical passes do not override current failures or missing verification.

## Tasks

- [x] **T-001:** Add the optional `os.family` field and the `apple` firmware value to `shared/src/device.ts`, update field descriptions with per-system sources, add the not-applicable rule to `checkDeviceScan` and the Go normalizer, regenerate the JSON Schema, and have the Windows scanner report `windows`. (supports `AC-015`, `AC-024`)
- [ ] **T-002:** On a real Mac, decide the session-ID mechanism (zip with a session file in the bundle, or the appended trailer) and the local save location; record the decision in `PLAN.md`. (supports `AC-016`, `AC-017`)
- [x] **T-003:** Linux collector without root: sysfs/procfs readers, `scan.RawLinux`, pure normalization, fixtures from a real laptop with planted identifiers and external drives, and schema tests. (supports `AC-007`, `AC-011`, `AC-012`, `AC-014`)
- [x] **T-004:** Linux root helper: `--privileged-helper` mode (SMBIOS types 16/17, drive health), `pkexec` launch from the window process, allowlist decoding, cancel and missing-`pkexec` paths, and tests. (supports `AC-009`, `AC-010`, `AC-012`)
- [x] **T-005:** macOS collector: `system_profiler`, `ioreg`, `sw_vers` and `sysctl` readers, `scan.RawDarwin`, pure normalization, fixtures from Intel and Apple Silicon output with planted identifiers and external drives, and schema tests. (supports `AC-005`, `AC-011`, `AC-012`, `AC-014`)
- [ ] **T-006:** Window on macOS and Linux: enable the Gio build for both, open the browser as the user, save the JSON to the platform location, readable terminal error when the Linux window cannot open, and the leaf icon (macOS `.app` bundle with `Info.plist`). (supports `AC-003`, `AC-004`, `AC-016`)
- [ ] **T-007:** Server: download routes and path settings per system, session creation with the system and matching `download_url`, session ID in each artifact type, and tests; Windows route unchanged. (supports `AC-017`)
- [ ] **T-008:** Web: system detection, per-system download, links to the other downloads, run steps and disclosure, mock-mode support, "Not applicable" security chip on a Mac, and tests. (supports `AC-018`, `AC-019`, `AC-025`)
- [ ] **T-009:** Assessment and report: OS-aware `osSupport`, Pass it on reason for non-Windows devices, retrieval without Windows 11 queries for them, `os.family` in explanation prompts and templates, and tests including old records. (supports `AC-020`, `AC-021`)
- [ ] **T-010:** CI and release: scanner vet/test for all three systems, macOS runner build with universal binary and bundle, Linux cgo build on an older glibc, artifacts into the server image or release, and docs in `docs/DEPLOYMENT.md`. (supports `AC-022`)
- [ ] **T-011:** Manual verification on a real Mac (Apple Silicon, Intel if available) and a real Linux laptop: run, compare values, search the JSON for real identifiers, session run, password and cancel paths. Record evidence. (supports `AC-001`, `AC-002`, `AC-006`, `AC-008`, `AC-009`, `AC-010`, `AC-013`, `AC-016`, `AC-017`, `AC-019`)
- [ ] **T-012:** Documentation: `docs/PRODUCT.md`, the README status and prerequisites, `scanner/README.md`, the glossary if new terms appear, reciprocal notes in features 001, 003, 005 and 006 once replacements are implemented, and the feature index. (supports `AC-022`, `AC-023`)
- [ ] **T-013:** Self-review of the final diff against the plan (privacy allowlist and root helper in particular), record findings and resolutions, and rerun affected checks. (supports `AC-023`)

## Dependencies and blockers

- T-002, T-005 verification and T-011 need the team's Apple Silicon MacBook: the user runs the builds and reports back. No Intel Mac is available, so AC-001's Intel half and Intel fixtures rely on documented output until one is.
- T-010 needs a macOS runner in GitHub Actions; pushing a branch to run CI needs the user's authorization.
- T-005 fixtures can be recorded only on a Mac; until then, fixtures built from Apple's documented output formats are a stopgap and must be replaced with real recordings.

## Progress notes

- 2026-11-21: Collection returns a `scan.Reading` per system (`Raw` on Windows, `RawLinux` on Linux), so the run flow is unchanged. The Linux reader works on an `fs.FS`, so tests run on recorded trees (`internal/scan/testdata/linux/*.txt`, a small text format with symlinks) on every platform.
- 2026-11-21: Without root, total RAM is the online memory blocks (else `MemTotal`) rounded up to whole GiB; the root helper's SMBIOS module sizes replace it when granted.
- 2026-11-21: The development machine runs VS Code as a Flatpak. Its sandbox hides `/sys/firmware` and `pkexec` and reports the Flatpak runtime as the OS, so real Linux checks (T-011) must run on the host outside the sandbox.
- 2026-11-21: The macOS fixtures in `scanner/internal/scan/testdata/darwin/` are written from the documented output format, not recorded (see its README). T-005 is code-complete; AC-005 needs recordings from the team's MacBook (T-011). ioreg gives battery capacities in mAh only, so mWh uses an estimated nominal voltage (cell count from the present voltage × 3.85 V); the health percentage is the exact mAh ratio. Apple Silicon reports no memory speed, so those scans stay `partial` on that one field.

## Lifecycle history

- 2026-11-21: Implementation started after the user chose "Apple Silicon, start now" (see the [scope change log](./PLAN.md#scope-change-log)).
