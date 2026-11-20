# Acceptance Criteria: Five-path assessment and ranking

- **Feature ID:** `feature-003-five-path-ranking`
- **Verification status:** In progress

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001 | Given a device page, no ranking is shown until an intended use is chosen. Choosing one of the four options shows a ranking, and changing the option recomputes it. | Automated web test, plus a manual browser check | Not run | |
| AC-002 | FR-002 | Given a mocked LLM response containing a fact that cites a passage ID that was not retrieved, then that fact is discarded and the facts with valid citations are kept. A second assessment of the same model makes no new LLM call. | Automated server test with a mocked LLM | Pass | 2026-11-20: `server/test/facts.test.ts` ("drops one citing an unretrieved passage", "reuses cached facts … without an LLM call"), `npm test -w server` 36/36 passing |
| AC-003 | FR-003 | For any assessed device, all five paths appear, each with exactly one status and at least one reason. | Automated unit test over the fixture devices | Pass | 2026-11-20: `server/test/assessment.test.ts` ("produces a valid assessment…", 20 scenario × use cases, schema and `checkAssessment` checked) |
| AC-004 | FR-004 | Given `model_evidence: "none"`, then upgrade and repair are `conditional` with a "cannot verify" reason, and no compatibility-dependent path is `viable`. | Automated unit test | Pass | 2026-11-20: `assessment.test.ts` ("makes compatibility-dependent paths conditional…") |
| AC-005 | FR-005 | Given the fact "RAM soldered" with a passage citation, and an upgrade that relies only on RAM, then upgrade is `not_suitable` and its reason cites that fact. | Automated unit test, plus a manual check on the soldered-RAM demo model once chosen | Not run | 2026-11-20 (automated part passes): `assessment.test.ts` ("marks an upgrade that relies only on RAM not suitable…"). The manual check on a soldered-RAM demo model waits for the model choice. |
| AC-006 | FR-006 | Given the fact "battery not user-replaceable" or a battery-swelling indication, the battery repair path is at most `conditional`, its next step is professional repair, and no output instructs the owner to open the battery. | Automated unit test | Pass | 2026-11-20: `assessment.test.ts` ("sends a worn battery that is … to a professional"), for a non-replaceable and an unknown battery. The scan has no swelling signal yet, so the swelling case cannot occur. |
| AC-007 | FR-007 | Every impact table entry has a low value, a high value, a unit, a source reference, and an access date. Entries still using placeholder values are flagged as placeholders and fail the coverage check for the real demo models. | Automated validation test of `impact.yaml` | Blocked | 2026-11-20 (generic part passes): `server/test/impact.test.ts` passes. Every entry is validated, and the coverage check flags the one remaining placeholder (`service.battery_replacement.price`). The demo-model part is blocked until the models are chosen (T-008). |
| AC-008 | FR-008 | For each viable or conditional path, the cost, extra life, and CO₂e are output as low/high ranges with the baseline statement, and every value maps to impact table entries. | Automated unit test checking the provenance of each output | Pass | 2026-11-20: `assessment.test.ts` ("outputs ranges with the baseline…"; every `impact_refs` entry resolved in the scenario test) |
| AC-009 | FR-009 | "Pass it on" shows its avoided-production credit labelled as conditional on displacement, and no output field or view sums CO₂e or savings across paths. | Automated unit test, plus a review of the result view | Not run | 2026-11-20 (automated part passes): `assessment.test.ts` ("credits pass it on only conditionally and never sums paths"). The review of the result view is open. |
| AC-010 | FR-010, FR-011 | Each mode's weights sum to 100, and a config whose weights do not sum to 100 makes startup fail. Each viable or conditional path has four criterion scores between 0 and 100. | Automated unit tests | Pass | 2026-11-20: `assessment.test.ts` ("gives each viable or conditional path four scores…", "weights (AC-010)"); `main.ts` loads the weights at startup and a live start was checked |
| AC-011 | FR-012 | The ranked view orders viable paths by score, then conditional paths marked "Conditional", then not-suitable paths without any score. | Automated web test | Pass | 2026-11-20: `web/src/test/lib.test.ts` (path views ordered viable, conditional, not suitable; no total for not-suitable paths), `npm test -w web` 39/39 passing. The order comes from the shared `rankPaths`. |
| AC-012 | FR-013 | Switching modes re-renders the scores and order with no network request and no page reload, and the order matches the weighted sums computed from the criterion scores. | Automated web test asserting no fetch, plus a manual check | Not run | 2026-11-20 (automated part passes): `web/src/test/app.test.tsx` ("reorders by the Money first weights without a new request"): one report stream, no `fetch`, card order equal to `rankPaths` with the Money first weights. The manual browser check is open. |
| AC-013 | FR-010, FR-001 | Given the same device with "office" use and with "programming" use (8 GB soldered RAM), the criterion scores differ, consistent with the use-specific rubric. | Automated unit test | Pass | 2026-11-20: `assessment.test.ts` ("scores the same soldered-RAM laptop differently…") |
| AC-014 | FR-014 | A device with `null` battery health and `model_evidence: "none"` shows lower confidence, with these reasons listed, than the same device with complete data and model evidence. | Automated unit test | Pass | 2026-11-20: `assessment.test.ts` ("confidence (AC-014)") |
| AC-015 | Review | The diff, rubrics, and impact table sources are self-reviewed, with findings recorded below. | Self-review | Not run | |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review (see [PLAN.md § Review and integration](./PLAN.md#review-and-integration)). The real-model part of AC-005 and the coverage part of AC-007 depend on the demo model choice. Not yet reviewed.

## Verification notes

- 2026-11-20 (`feat/five-path-ranking`): `npm run typecheck` and `npm test` pass (shared 68, server 119, web 30 tests). The server started locally with the weights and impact table loaded and answered `GET /api/devices/:id` with 404 for an unknown ID.
- 2026-11-20 (T-007, `main` + working tree): `npm test` (shared 68, server 187, web 39), `npm run typecheck`, and `npm run build` pass. `server/test/report-stream.test.ts` covers the assessment service (matched and unknown model, LLM failure, no LLM) and the stream route (`assessment` then `end`, error event, 400 for an unknown use, 404). Live run against the real corpus index and DeepSeek: a T480-like scan (fixture laptop with T480 identity, i5-8250U) streamed `assessment` then `end` with `model_evidence: "model_specific"`; upgrade viable (NVMe M.2 slot), repair conditional (replacement battery not verified), pass it on viable, salvage and recycle conditional. The first request took 26.4 s with thinking enabled for extraction, **above the 20 s target**; the second, served from the fact cache, took 0.03 s. Server logs recorded route patterns only, no device ID.
