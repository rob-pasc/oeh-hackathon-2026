# Acceptance Criteria: Step-level knowledge base

- **Feature ID:** `feature-010-step-level-knowledge-base`
- **Verification status:** In progress (document review done; `corpus:ingest` and `npm test -w server` still to run on a machine with Node 24)

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome                                                                                                                                                         | Verification method                                              | Result  | Evidence |
| ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------- | -------- |
| AC-001 | FR-001      | For each demo model, the manifest lists a source applicable to that model with steps for the bottom cover, the storage drive, and the battery (or a statement that it is a service part); T480 and 840 G5 have a RAM source; XPS 13 9360 has a source stating soldered RAM. | Review of the manifest and documents against a checklist, recorded below | Pass | Checklist table in [RESEARCH.md](./RESEARCH.md#audit-of-the-existing-corpus-t-001), 2026-11-21: all cells covered; T480 storage drive was the only gap and `ifixit-t480-ssd-replacement` closes it. 840 G5 battery: HP lists it as an Authorized Service Provider part. |
| AC-002 | FR-002      | Generic sources with steps for backing up files, resetting Windows with all data removed, and installing Windows are in the manifest.                                                | Manifest review                                                  | Pass | Back up: `ms-back-up-with-windows-backup`; reset with all data removed: `ms-reset-your-pc`; installing: `ms-create-installation-media`, `ms-reinstall-windows-with-installation-media` (2026-11-21). |
| AC-003 | FR-003      | Austrian sources for a repair offer, a donation offer, and free e-waste and battery drop-off are in the manifest.                                                                   | Manifest review                                                  | Pass | Repair: `at-geraete-retter-praemie`, `at-ak-wien-repair-cafes`; donation: `at-pcs-fuer-alle`; drop-off: `at-bmluk-elektroaltgeraete-kostenlose-abgabe`, `at-usp-batterien-ruecknahme` (2026-11-21). Donation is Vienna-only, see gaps. |
| AC-004 | FR-004      | Every new manifest entry has all required fields including terms and access date, and `npm run corpus:ingest -w server` finishes without errors.                                     | Run the ingest command; `npm test -w server` (corpus tests)      | Not run | Substitute check passed (41 documents, 245 passages after the second round, no problems; same manifest rules and the real `chunkMarkdown`), but `npm run corpus:ingest -w server` and `npm test -w server` need Node 24 and `typebox`, which the sandbox lacks. To be run before merge. |
| AC-005 | FR-005      | The coverage check output and the remaining gaps per demo model and option kind are recorded in `RESEARCH.md`.                                                                      | Document review                                                  | Pass | [RESEARCH.md](./RESEARCH.md#coverage-output-fr-005) records the check output and the remaining gaps per model and option kind. The real coverage output is still to be added after the ingest run. |
| AC-006 | FR-006      | `RESEARCH.md` lists every source considered with its outcome (added or rejected) and the reason.                                                                                    | Document review                                                  | Pass | [RESEARCH.md](./RESEARCH.md#sources-considered-and-rejected) lists 10 added (6 in the first round, 4 in the second) and the rejected sources with reasons. |
| AC-007 | —           | Self-review of the added documents and manifest entries, with findings recorded.                                                                                                    | Self-review                                                      | Pass | Self-review 2026-11-21: extracts compared with the rendered page text; wording kept; found and fixed two unsupported statements in RESEARCH.md (donation reach, a screw-count remark). No unlicensed source added. |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

If a later feature supersedes this behavior, preserve these criteria, results, and evidence as historical records. See the supersession rules in `docs/workflow/CHANGE_HISTORY.md`.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review ([plan](./PLAN.md#review-and-integration)). Self-review done 2026-11-21; no independent review yet.

## Verification notes

2026-11-21: documents checked by hand against the rendered pages. The ingest and server tests could not run in the authoring sandbox (Node 22, no `typebox`); run `npm run corpus:ingest -w server` and `npm test -w server` and paste the result into AC-004 and RESEARCH.md. Expect only the known 840 G5 7th-generation CPU warning from feature 002.
