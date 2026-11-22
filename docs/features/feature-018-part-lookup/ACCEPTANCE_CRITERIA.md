# Acceptance Criteria: Part lookup

- **Feature ID:** `feature-018-part-lookup`
- **Verification status:** In progress (AC-009 and AC-011 open)

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001      | Given an uploaded scan with a CPU named in the corpus, when the lookup runs, then the CPU is found in the corpus and no web search is made for it. | Automated test with the test corpus and a fake provider | Pass | `server/test/parts.test.ts` "AC-001": the CPU cites `os-cpu-list`, no query names 8250U (0f76369) |
| AC-002 | FR-002      | Given a drive not named in the corpus, when the lookup runs, then exactly one web search is made, its query contains only the drive identifier, and the cap and fallback rules of feature 017 apply. | Automated test with fake providers | Pass | `server/test/parts.test.ts` "AC-002" (4 tests): one query for the GPU with only its name and fixed words, pages not naming the part ignored, fallback asked, cap reached → No match without a search |
| AC-003 | FR-003      | Given the LLM returns a sentence for a part without a valid citation, then that part reads "No match"; cited sentences are kept; one LLM call is made per device. | Automated test with a fake LLM | Pass | `server/test/parts.test.ts` "AC-003" (2 tests): wrong-part and unknown citations read No match, cited sentences kept, one `part_lookup` call |
| AC-004 | FR-004      | Given lookups for all four outcomes, when the result screen shows the scan specs, then each part shows the right badge, and parts with a sentence show it with a working source link. | Automated component test; browser check in mock mode | Pass | `web/src/test/parts.test.tsx` "AC-004" (4 tests); headless Chromium screenshots of the mock result screen at 1440 and 390 px, pending and finished (2026-11-22, dcecae8) |
| AC-005 | FR-005      | Given a lookup that times out, then the rest of the result screen is shown without waiting and the affected parts read "No match". | Automated test | Pass | `server/test/parts.test.ts` "AC-005" (2 tests): a hanging search ends within the deadline as No match and is retried; LLM and provider errors end as No match without throwing. The lookup is a separate route from the report stream |
| AC-006 | FR-006      | Given a second device with the same CPU within 30 days, then no new search or LLM call is made for the CPU. | Automated test with a controlled clock | Pass | `server/test/parts.test.ts` "AC-006": second device, other model, 29 days later: no search, no LLM call; a new CPU asks only about that CPU; after 30 days a new call |
| AC-007 | FR-007      | Without an LLM key, the scan specs equal those before this feature; without search keys, only corpus lookups run. | Automated test | Pass | `server/test/parts.test.ts`: route answers `{device_id, parts: []}` without the service; without search only corpus lookups run. `web/src/test/parts.test.tsx`: the card's HTML with an empty list equals the card without lookups |
| AC-008 | FR-008      | In mock mode, the result screen shows sample lookups with all four badges. | Browser check in mock mode | Pass | `web/src/test/parts.test.tsx` "AC-008": Looking up…, then 2 × Knowledge base, 2 × Web search · check, 1 × No match; same in the headless Chromium check |
| AC-009 | FR-009      | The privacy notice (DE/EN) says that part names, and no other scan data, go to the search providers. | Read both texts in the browser | Not run | Texts added (DE/EN) and checked by `web/src/test/parts.test.tsx` "privacy notice (FR-009)"; the team's read in the browser is open |
| AC-010 | All         | A live lookup with the team's keys returns at least one Web search · check result for a part outside the corpus. | Live smoke run, output recorded | Pass | `npm run parts:smoke -w server`, 2026-11-22: 5 parts in 6925 ms, 4 × Web search · check (CPU, DDR4, HD Graphics 620, NVMe SSD), battery Knowledge base; recorded in `server/README.md` |
| AC-011 | All         | Typecheck, tests and build pass locally, CI passes on the `main` push, and a self-review is recorded with findings and resolutions. | Commands; CI link; review record below | Not run | Local typecheck, tests (shared 149, server 442, web 155) and build pass; self-review below. Merge into `main` and CI on the push need the user's request |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified, merged into `main`, live smoke run (see the [plan](./PLAN.md#review-and-integration)).

**Self-review** (agent, not independent) of `main..feat/part-lookup` at dcecae8 plus the documentation commit, against the plan's requirements and exclusions, 2026-11-22:

| Finding | Disposition |
| ------- | ----------- |
| The scan has no drive or battery model names, so FR-001 could not be met as written | Asked the user; clarified FR-001 (lookup by type), recorded in the plan's scope change log |
| A per-part cache keyed only by identifier would show a sentence drawn from one model's manual (for example its battery section) for every other model | Fixed before commit: the cache key includes the corpus passages used; covered by the test "uses model-specific corpus passages only for that model" |
| The live run produced a misleading drive sentence ("most older laptops lack an M.2 slot") | Prompt rule added against claims about other devices; second live run checked |
| Two devices with the same uncached part at the same moment each search and ask the LLM | Accepted: rare, bounded by the daily caps, and the second result overwrites the first in the caches |
| While loading, "Looking up…" shows on every part row, even one the server will skip (for example a virtual display adapter only) | Accepted: the row then shows nothing, as before the feature |
| Web page URLs reach the page as links | No change needed: both providers keep only http(s) URLs (`isHttpUrl`), and sentences render as text |
| Exclusions | Checked: no scanner change, the scan page's live card unchanged, no effect on assessment or ranking, no prices |

CI on the `main` push and the merge are not done (need the user's request).

## Verification notes

- 2026-11-22: `npm run typecheck`, `npm test` and `npm run build -w web` pass on `feat/part-lookup`. The scanner is unchanged, so its checks were not run.
- The browser checks of AC-004 and AC-008 ran in a headless Chromium (Playwright) against `vite` in mock mode, by the agent; a look by the team in a normal browser is still welcome but not required by the criteria.
