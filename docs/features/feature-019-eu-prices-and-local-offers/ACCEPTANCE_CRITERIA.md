# Acceptance Criteria: European prices and local offers

- **Feature ID:** `feature-019-eu-prices-and-local-offers`
- **Verification status:** Not started

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001      | Given an SSD option and at least two EUR offers from allowlisted sources, then its card shows a Web price range with the offer count, source links and date next to the impact table figures. | Automated test with fake search and LLM; component test | Not run | |
| AC-002 | FR-002      | Given web prices far from the impact table, then scores, ranking, gauge and plan totals are identical to a run without web prices. | Automated test comparing both runs | Not run | |
| AC-003 | FR-003      | Given offers in USD, from a non-allowlisted domain, or only one usable offer, then no Web price is shown. | Automated test | Not run | |
| AC-004 | FR-004      | Given a cached price query, then a second request within 7 days makes no search call; after 7 days it does. | Automated test with a controlled clock | Not run | |
| AC-005 | FR-005      | Given no shared location, then the step plan of a repair option lists up to three Austrian offers with name, town, link and the Web source · check label. | Automated test; component test | Not run | |
| AC-006 | FR-006      | Given permission is granted, then the page sends coordinates rounded to two decimals, shows "Near <town>", lists offers for that town, and "Austria-wide" restores the default. | Component test with a mocked geolocation API; browser check | Not run | |
| AC-007 | FR-007      | After a location is shared, the database and server log contain no coordinates; the town is stored only for that device and removed by the 30-day purge. | Automated test inspecting tables and captured logs; retention test | Not run | |
| AC-008 | FR-008      | Given denied permission, unavailable location, or a failing Nominatim, then Austria-wide offers stay and a short message is shown. | Component and server tests | Not run | |
| AC-009 | FR-009      | Given two location requests within one second, then Nominatim is called at most once per second, with the identifying User-Agent, and a repeated rounded pair uses the cache. | Automated test with fake Nominatim and simulated time | Not run | |
| AC-010 | FR-010      | Search queries for offers contain the town name, never coordinates; the privacy notice (DE/EN) describes the optional location sharing, Nominatim and the retention. | Automated query inspection; read both texts in the browser | Not run | |
| AC-011 | All         | Live smoke run: one price search, one offer search and one Nominatim lookup with the team's keys return usable results. | Live run, output recorded | Not run | |
| AC-012 | All         | Typecheck, tests and build pass locally, CI passes on the `main` push, and a self-review with location handling checked is recorded with findings and resolutions. | Commands; CI link; review record below | Not run | |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified, merged into `main`, live smoke run (see the [plan](./PLAN.md#review-and-integration)). No review performed yet.

## Verification notes

Not yet verified.
