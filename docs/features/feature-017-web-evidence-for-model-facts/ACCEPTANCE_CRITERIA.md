# Acceptance Criteria: Web evidence for model facts

- **Feature ID:** `feature-017-web-evidence-for-model-facts`
- **Verification status:** Not started

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement    | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | -------------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001         | Given search is configured and a device whose model has corpus evidence for storage but none for memory, when it is assessed, then exactly one web search runs (for memory) and none for storage. | Automated test with a fake provider | Not run | |
| AC-002 | FR-002         | Given the primary provider fails with an error, a 429, a timeout, or returns no usable result, when a topic is searched, then the fallback provider is asked and its results are used; with both failing, the topic reads "cannot verify". | Automated test with fake providers | Not run | |
| AC-003 | FR-002         | Given `SEARCH_PROVIDER=tinyfish` and `SEARCH_FALLBACK=langsearch`, when a topic is searched, then TinyFish is asked first, without code changes in the assessment. | Automated configuration test | Not run | |
| AC-004 | FR-003         | Given results naming "ThinkPad T480s" only and one naming "ThinkPad T480", when a T480 is searched, then only the T480 page reaches fact extraction. | Automated test of the model-match filter | Not run | |
| AC-005 | FR-004         | Given the extraction rejects a web passage as describing another model, when a fact cites only that passage, then the fact is dropped; a fact also citing a confirmed passage is kept. | Automated test with a fake LLM | Not run | |
| AC-006 | FR-005         | Given an uncovered model and confirmed web passages stating two free RAM slots, when assessed, then the memory upgrade path's gate uses the fact as it would a corpus fact (not "cannot verify"). | Automated assessment test | Not run | |
| AC-007 | FR-006         | Given web passages only, when extraction returns `battery_user_replaceable: true`, then the fact is dropped; when it returns `false`, the fact is kept and the battery path is not more permissive than without it. | Automated test | Not run | |
| AC-008 | FR-007         | Given an option citing a web passage, when the result screen shows its sources, then the citation reads "Web source" with page title, a working link and the retrieval date; corpus citations look as before. | Automated component test; browser check in mock mode | Not run | |
| AC-009 | FR-008         | Given a search result cached for a model and topic, when a second device of the same model is assessed within 30 days, then no provider call is made; after 30 days a call is made again. | Automated test with a controlled clock | Not run | |
| AC-010 | FR-009         | Given `SEARCH_DAILY_CALLS=2` and two calls already made today (UTC), when another topic needs a search, then no provider is called and the assessment completes as without search. | Automated test | Not run | |
| AC-011 | FR-010         | Given a provider that never answers and `SEARCH_TIMEOUT_MS=100`, when a device is assessed, then the assessment completes within the deadline plus normal processing, with the affected topics reading "cannot verify". | Automated test with simulated time | Not run | |
| AC-012 | FR-011         | Given no provider keys, when the server starts, then it logs once that web search is off, and assessments of the fixtures equal those before this feature. | Automated startup and regression test | Not run | |
| AC-013 | FR-012         | Given a full scan fixture, when its searches run, then every query sent contains only manufacturer, model and topic terms (no device ID, no other scan values). | Automated test inspecting the fake provider's received queries | Not run | |
| AC-014 | FR-012         | The privacy notice in German and English names LangSearch and TinyFish, what is sent, and that no personal data is sent. | Read both texts in the browser | Not run | |
| AC-015 | FR-013         | Given the stream reports a running web search, when the result screen waits, then the thinking line shows "Searching the web…" (German „Suche im Web…“). | Automated component test | Not run | |
| AC-016 | FR-014         | With the team's keys in `server/.env`, `npm run search:smoke -w server` reports results and kept results for each provider and exits 0; with a wrong key it reports the error and exits non-zero. | Live run, output recorded | Not run | |
| AC-017 | All            | `npm run typecheck`, `npm test` and `npm run build` pass locally, and CI passes on the `main` push containing the feature. | Commands; CI run link | Not run | |
| AC-018 | All            | Self-review of the final diff against this plan is recorded with findings and resolutions, checking query privacy, the battery rule and the model-match filter in particular. | Review record below | Not run | |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified, merged into `main`, live smoke run (see the [plan](./PLAN.md#review-and-integration)). Release to leaaf.green is outside this boundary. No review performed yet.

## Verification notes

Not yet verified.
