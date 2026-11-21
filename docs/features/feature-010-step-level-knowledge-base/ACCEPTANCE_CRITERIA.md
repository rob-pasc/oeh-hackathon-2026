# Acceptance Criteria: Step-level knowledge base

- **Feature ID:** `feature-010-step-level-knowledge-base`
- **Verification status:** Not started

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome                                                                                                                                                         | Verification method                                              | Result  | Evidence |
| ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------- | -------- |
| AC-001 | FR-001      | For each demo model, the manifest lists a source applicable to that model with steps for the bottom cover, the storage drive, and the battery (or a statement that it is a service part); T480 and 840 G5 have a RAM source; XPS 13 9360 has a source stating soldered RAM. | Review of the manifest and documents against a checklist, recorded below | Not run | —        |
| AC-002 | FR-002      | Generic sources with steps for backing up files, resetting Windows with all data removed, and installing Windows are in the manifest.                                                | Manifest review                                                  | Not run | —        |
| AC-003 | FR-003      | Austrian sources for a repair offer, a donation offer, and free e-waste and battery drop-off are in the manifest.                                                                   | Manifest review                                                  | Not run | —        |
| AC-004 | FR-004      | Every new manifest entry has all required fields including terms and access date, and `npm run corpus:ingest -w server` finishes without errors.                                     | Run the ingest command; `npm test -w server` (corpus tests)      | Not run | —        |
| AC-005 | FR-005      | The coverage check output and the remaining gaps per demo model and option kind are recorded in `RESEARCH.md`.                                                                      | Document review                                                  | Not run | —        |
| AC-006 | FR-006      | `RESEARCH.md` lists every source considered with its outcome (added or rejected) and the reason.                                                                                    | Document review                                                  | Not run | —        |
| AC-007 | —           | Self-review of the added documents and manifest entries, with findings recorded.                                                                                                    | Self-review                                                      | Not run | —        |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

If a later feature supersedes this behavior, preserve these criteria, results, and evidence as historical records. See the supersession rules in `docs/workflow/CHANGE_HISTORY.md`.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review ([plan](./PLAN.md#review-and-integration)). No review has been performed yet.

## Verification notes

Not yet verified.
