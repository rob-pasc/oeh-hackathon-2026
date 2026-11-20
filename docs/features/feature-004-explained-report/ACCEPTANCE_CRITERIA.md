# Acceptance Criteria: Explained report

- **Feature ID:** `feature-004-explained-report`
- **Verification status:** Not started

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001 | Given a ranking with at least one viable path, only the top viable path is labelled "Recommended". Given no viable path, no label is shown and the report states that no path is clearly recommended. | Automated web test | Not run | |
| AC-002 | FR-002 | The impact summary shows the recommended path's cost, extra life, and CO₂e ranges together with the baseline statement, matching the calculator output values. | Automated web test | Not run | |
| AC-003 | FR-003 | Each of the five cards shows its status, its score (when provided), and a reason. Expanding a card reveals the five named sections, and this can be done with the keyboard. | Automated web test, plus a manual keyboard check | Not run | |
| AC-004 | FR-004 | The prompt sent to the LLM contains only the listed structured inputs, with passages delimited as data, and no other user content. | Automated test inspecting the built prompt | Not run | |
| AC-005 | FR-005 | Given a mocked LLM output with one claim citing an unknown passage ID and one sentence containing "saves 250 kg CO₂e", the claim is removed and the figure-containing text is rejected or replaced before display. | Automated server test with a mocked LLM | Not run | |
| AC-006 | FR-006 | Every cited claim's evidence entry shows the document title, section or page, an excerpt, and a working link to the source URL. | Automated web test, plus a manual click-through on one demo report | Not run | |
| AC-007 | FR-007 | Given a device with `model_evidence: "none"`, the upgrade and repair cards state what could not be verified. | Automated test | Not run | |
| AC-008 | FR-008 | Given scores where switching modes changes the order, the report names the moved paths and the criteria responsible, with no LLM call. Given no order change, no change message is shown. | Automated unit and web tests | Not run | |
| AC-009 | FR-009 | Given an LLM call that times out or errors, the report still renders the ranking with template explanations and shows the unavailable notice. | Automated server and web tests with a mocked failure | Not run | |
| AC-010 | FR-010 | Opening the same report twice and toggling modes results in exactly one LLM call per device and intended use. | Automated server test counting mocked LLM calls | Not run | |
| AC-011 | NFR responsiveness | The report journey (choose use, expand card, follow source link) completes in a browser at 360 px width and at laptop width without horizontal scrolling. | Manual browser check | Not run | |
| AC-012 | Review | The diff and sample demo-model reports are self-reviewed for unsupported claims, with findings recorded below. | Self-review | Not run | |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review (see [PLAN.md § Review and integration](./PLAN.md#review-and-integration)). Not yet reviewed.

## Verification notes

Not yet verified.
