# Acceptance Criteria: Explained report

- **Feature ID:** `feature-004-explained-report`
- **Verification status:** Locally verified, AC-001 through AC-012

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001 | Given a ranking with at least one viable path, only the top viable path is labelled "Recommended". Given no viable path, no label is shown and the report states that no path is clearly recommended. | Automated web test | Pass | Web tests cover five cards, exactly one label and an all-conditional/unsuitable result. |
| AC-002 | FR-002 | The impact summary shows the recommended path's cost, extra life, and CO₂e ranges together with the baseline statement, matching the calculator output values. | Automated web test | Pass | Web test compares the active recommendation summary with the fixture calculator ranges and baseline. |
| AC-003 | FR-003 | Each of the five cards shows its status, its score (when provided), and a reason. Expanding a card reveals the five named sections, and this can be done with the keyboard. | Automated web test, plus a manual keyboard check | Pass | ResultsView tests and Chromium keyboard journey below. The card shows status, score, reason, steps and why. Its evidence disclosure contains sources, assumptions and safety. |
| AC-004 | FR-004 | The prompt sent to the LLM contains only the listed structured inputs, with passages delimited as data, and no other user content. | Automated test inspecting the built prompt | Pass | `server/test/report-prompt.test.ts` inspects the explanation request, including JSON-delimited passage text and exclusion of device and session IDs. |
| AC-005 | FR-005 | Given a mocked LLM output with one claim citing an unknown passage ID and one sentence containing "saves 250 kg CO₂e", the claim is removed and the figure-containing text is rejected or replaced before display. | Automated server test with a mocked LLM | Pass | `server/test/report-service.test.ts` checks mixed known/unknown citations, trusted passage metadata, removal of euro and CO₂e text across the explanation fields, and preservation of a cited hardware quantity. |
| AC-006 | FR-006 | Every cited claim's evidence entry shows the document title, section or page, an excerpt, and a working link to the source URL. | Automated web test, plus a manual click-through on one demo report | Pass | The web test checks claim text, excerpts and source links. Keyboard click-through in Chromium returned HTTP 200 for the Lenovo PSREF PDF. |
| AC-007 | FR-007 | Given a device with `model_evidence: "none"`, the upgrade and repair cards state what could not be verified. | Automated test | Pass | Unknown-device web test inspects both upgrade and repair summaries for missing model evidence. |
| AC-008 | FR-008 | Given scores where switching modes changes the order, the report names the moved paths and the criteria responsible, with no LLM call. Given no order change, no change message is shown. | Automated unit and web tests | Pass | Mode-change unit tests cover reversed and unchanged order. The web test checks the message while counting one stream and no additional fetch. |
| AC-009 | FR-009 | Given an LLM call that times out or errors, the report still renders the ranking with template explanations and shows the unavailable notice. | Automated server and web tests with a mocked failure | Pass | Mocked timeout produces assessment, template report and fallback end in the server stream test. The web test verifies the template notice alongside the ranking. |
| AC-010 | FR-010 | Opening the same report twice and toggling modes results in exactly one LLM call per device and intended use. | Automated server test counting mocked LLM calls | Pass | `server/test/report-service.test.ts` counts one explanation call across concurrent opens and SQLite cache reads with both ranking modes. A second use and a second device each make a separate call. |
| AC-011 | NFR responsiveness | The report journey (choose use, expand card, follow source link) completes in a browser at 360 px width and at laptop width without horizontal scrolling. | Manual browser check | Pass | Chromium keyboard and viewport checks below. |
| AC-012 | Review | The diff and sample demo-model reports are self-reviewed for unsupported claims, with findings recorded below. | Self-review | Pass | Demo-model review and final local self-review below. |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review (see [PLAN.md § Review and integration](./PLAN.md#review-and-integration)). Self-reviewed through the final report UI diff based on `44023ae`. See the checks and findings below.

## Verification notes

**2026-11-21, supersession note.** Feature 015 removes the impact summary, replacing FR-002 (AC-002). The AC-002 result stays as historical evidence; current evidence is in the [feature 015 plan](../feature-015-remove-recommendation-summary/PLAN.md) and [acceptance criteria](../feature-015-remove-recommendation-summary/ACCEPTANCE_CRITERIA.md).

2026-11-20: Self-reviewed the T-001 diff against FR-004 at base `021b4e1`. The model response schema derives its fields from the shared path explanation, requires all five paths, and rejects server-owned report fields. The prompt inspection test uses instruction-like text inside a passage. Runtime citation and figure checks remain in T-002.

2026-11-20: Self-reviewed the T-002 diff from `e985069` against FR-005 and FR-010. Rechecked the report service and SSE sequence with 216 passing server tests. Generation failures leave no cached result. The test provider is mocked; live output quality and fallback behavior have separate verification tasks.

### Demo-model review, 2026-11-20

Used synthetic office-use scans and the real curated corpus, assessment service and configured DeepSeek provider. These samples used 4 GB RAM, a 72% battery reading and model-specific CPUs. Each model matched the index. Both fact extraction and explanation generation ran against the provider.

- ThinkPad T480 (i5-8250U). The first report treated a service procedure as owner authorization. Revised the fact and explanation prompts to distinguish the internal and removable batteries. The second report recommended a service quote and cited Lenovo's maintenance manual, table 6, for the difference. Lenovo PSREF describes the HDD and primary M.2 configurations as mutually exclusive. The steps require checking the installed configuration before buying a drive.
- XPS 13 9360 (i5-7200U). The first report called a conditional repair the strongest option. Reserved cross-path ranking for the deterministic client. The next report described onboard memory against Dell's setup guide and referred battery identification to a provider. The service manual documents disassembly, which by itself establishes no owner-serviceability claim.
- EliteBook 840 G5 (i5-8350U). Checked the memory slots and maximum against QuickSpecs, and battery part 933321-855 against the service guide. A generated claim cited an Austrian collection policy for a calculator displacement assumption. Added a filter and a regression test for that misattribution, then replayed the reviewed output through the final validator. The unsupported claim was dropped.

All three reviewed outputs satisfied the shared schema and citation invariants after filtering. The final samples contained 10, 10 and 9 cited claims respectively. Passage-ID validation proves that a cited passage was retrieved. Semantic support and applicability to an individual device still require reading the passage.

### Final local verification, 2026-11-20

- Chromium used the live API client with the reviewed T480 report replayed over a local event stream. At 360 × 800, 1280 × 900 and 1440 × 900, selected Office, opened Upgrade with Enter, expanded the evidence disclosure with Space, and followed the focused source link with Enter. Lenovo's PSREF PDF returned HTTP 200 each time. Page scroll width equalled viewport width at all three sizes. Inspected the mobile and laptop layouts.
- Reviewed the report contract, both stream outcomes, cache handling, ranking changes, expanded cards and missing-evidence treatment. Kept feature 006's laptop card/gauge layout and its plain-language card summaries. The missing-evidence explanation appears in the summary. Sources, assumptions and safety sit in a keyboard-accessible disclosure.
- Workspace tests passed (68 shared, 219 server, 46 web), along with workspace type checks, the production web build in live API mode, and the final diff whitespace check. Separate team review of the wider feature 006 screens belongs to feature 006. Public deployment belongs to feature 005.

2026-11-21: Supersession note. Feature 008 replaces FR-001 and the report sections of FR-003 on the result screen, and extends FR-009 and FR-010 ([008 plan](../feature-008-ai-categories-and-options/PLAN.md), [008 acceptance](../feature-008-ai-categories-and-options/ACCEPTANCE_CRITERIA.md)). The criteria and results recorded here describe the explained report as built, and remain historical evidence for it; the report stream no longer sends that report.
