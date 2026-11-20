# Acceptance Criteria: Explained report

- **Feature ID:** `feature-004-explained-report`
- **Verification status:** Partial (AC-004, AC-005, and AC-010 verified)

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001 | Given a ranking with at least one viable path, only the top viable path is labelled "Recommended". Given no viable path, no label is shown and the report states that no path is clearly recommended. | Automated web test | Not run | |
| AC-002 | FR-002 | The impact summary shows the recommended path's cost, extra life, and CO₂e ranges together with the baseline statement, matching the calculator output values. | Automated web test | Not run | |
| AC-003 | FR-003 | Each of the five cards shows its status, its score (when provided), and a reason. Expanding a card reveals the five named sections, and this can be done with the keyboard. | Automated web test, plus a manual keyboard check | Not run | |
| AC-004 | FR-004 | The prompt sent to the LLM contains only the listed structured inputs, with passages delimited as data, and no other user content. | Automated test inspecting the built prompt | Pass | `server/test/report-prompt.test.ts` inspects the explanation request, including JSON-delimited passage text and exclusion of device and session IDs. |
| AC-005 | FR-005 | Given a mocked LLM output with one claim citing an unknown passage ID and one sentence containing "saves 250 kg CO₂e", the claim is removed and the figure-containing text is rejected or replaced before display. | Automated server test with a mocked LLM | Pass | `server/test/report-service.test.ts` checks mixed known/unknown citations, trusted passage metadata, removal of euro and CO₂e text across the explanation fields, and preservation of a cited hardware quantity. |
| AC-006 | FR-006 | Every cited claim's evidence entry shows the document title, section or page, an excerpt, and a working link to the source URL. | Automated web test, plus a manual click-through on one demo report | Not run | |
| AC-007 | FR-007 | Given a device with `model_evidence: "none"`, the upgrade and repair cards state what could not be verified. | Automated test | Not run | |
| AC-008 | FR-008 | Given scores where switching modes changes the order, the report names the moved paths and the criteria responsible, with no LLM call. Given no order change, no change message is shown. | Automated unit and web tests | Not run | |
| AC-009 | FR-009 | Given an LLM call that times out or errors, the report still renders the ranking with template explanations and shows the unavailable notice. | Automated server and web tests with a mocked failure | Not run | |
| AC-010 | FR-010 | Opening the same report twice and toggling modes results in exactly one LLM call per device and intended use. | Automated server test counting mocked LLM calls | Pass | `server/test/report-service.test.ts` counts one explanation call across concurrent opens and SQLite cache reads with both ranking modes. A second use and a second device each make a separate call. |
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

2026-11-20: Self-reviewed the T-001 diff against FR-004 at base `021b4e1`. The model response schema derives its fields from the shared path explanation, requires all five paths, and rejects server-owned report fields. The prompt inspection test uses instruction-like text inside a passage. Runtime citation and figure checks remain in T-002.

2026-11-20: Self-reviewed the T-002 diff from `e985069` against FR-005 and FR-010. Rechecked the report service and SSE sequence with 216 passing server tests. Generation failures leave no cached result. The test provider is mocked; live output quality and fallback behavior have separate verification tasks.

### Demo-model review, 2026-11-20

Used synthetic office-use scans and the real curated corpus, assessment service and configured DeepSeek provider. These samples used 4 GB RAM, a 72% battery reading and model-specific CPUs. Each model matched the index. Both fact extraction and explanation generation ran against the provider.

- ThinkPad T480 (i5-8250U). The first report treated a service procedure as owner authorization. Revised the fact and explanation prompts to distinguish the internal and removable batteries. The second report recommended a service quote and cited Lenovo's maintenance manual, table 6, for the difference. Lenovo PSREF describes the HDD and primary M.2 configurations as mutually exclusive. The steps require checking the installed configuration before buying a drive.
- XPS 13 9360 (i5-7200U). The first report called a conditional repair the strongest option. Reserved cross-path ranking for the deterministic client. The next report described onboard memory against Dell's setup guide and referred battery identification to a provider. The service manual documents disassembly, which by itself establishes no owner-serviceability claim.
- EliteBook 840 G5 (i5-8350U). Checked the memory slots and maximum against QuickSpecs, and battery part 933321-855 against the service guide. A generated claim cited an Austrian collection policy for a calculator displacement assumption. Added a filter and a regression test for that misattribution, then replayed the reviewed output through the final validator. The unsupported claim was dropped.

All three reviewed outputs satisfied the shared schema and citation invariants after filtering. The final samples contained 10, 10 and 9 cited claims respectively. Passage-ID validation proves that a cited passage was retrieved. Semantic support and applicability to an individual device still require reading the passage.
