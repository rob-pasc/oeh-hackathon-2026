# Acceptance Criteria: European prices and local offers

- **Feature ID:** `feature-019-eu-prices-and-local-offers`
- **Verification status:** In progress: AC-001 to AC-011 pass; the browser check of AC-006 and AC-010 and CI on `main` (AC-012) are open

Defines the feature’s acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | ----------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001      | Given an SSD option and at least two EUR offers from allowlisted sources, then its card shows "Web price from <lowest price>" with the offer count next to the impact table figures, and the opened card lists the three cheapest offers with links and the date (FR-001 as amended 2026-11-22). | Automated test with fake search and LLM; component test | Pass | `server/test/prices.test.ts` "gives each SSD, RAM and battery option a range…" and "searches only the part on the allowlisted sites"; `web/src/test/web-prices.test.tsx` "shows \"Web price from\" next to the impact table figures, with the cheapest offers and date when opened" and "lists the three cheapest offers, cheapest first" (re-run after the 2026-11-22 amendment) |
| AC-002 | FR-002      | Given web prices far from the impact table, then scores, ranking, gauge and plan totals are identical to a run without web prices. | Automated test comparing both runs | Pass | `server/test/prices.test.ts` "leaves the assessment and categories of the report exactly as without web prices": the report stream is byte-identical with and without a price service after prices were fetched; prices have their own route and never enter `CategoryResult` |
| AC-003 | FR-003      | Given offers in USD, from a non-allowlisted domain, or only one usable offer, then no Web price is shown. | Automated test | Pass | `server/test/prices.test.ts` "shows no web price with only one usable offer, USD offers or pages off the allowlist", "keeps only EUR prices from allowlisted pages…", "accepts the domains and their subdomains only" |
| AC-004 | FR-004      | Given a cached price query, then a second request within 7 days makes no search call; after 7 days it does. | Automated test with a controlled clock | Pass | `server/test/prices.test.ts` "reuses a part price for 7 days, then searches again" (controlled clock: no search at 7 days minus 1 hour, a new search after 7 days) |
| AC-005 | FR-005      | Given no shared location, then the step plan of a repair option lists up to three Austrian offers with name, town, link and the Web source · check label. | Automated test; component test | Pass | `server/test/offers.test.ts` "lists up to three Austrian offers for a repair option…"; `web/src/test/web-prices.test.tsx` "lists Austrian places in the repair option, each labelled as a web source to check" |
| AC-006 | FR-006      | Given permission is granted, then the page sends coordinates rounded to two decimals, shows "Near <town>", lists offers for that town, and "Austria-wide" restores the default. | Component test with a mocked geolocation API; browser check | Pass (component); browser check open | `web/src/test/web-prices.test.tsx` "sends coordinates rounded to two decimals, shows the town and its offers, and goes back to Austria-wide" with a mocked geolocation API (47.41237, 9.74391 → 47.41, 9.74); `server/test/offers.test.ts` location route tests. A check in a real browser is still open |
| AC-007 | FR-007      | After a location is shared, the database and server log contain no coordinates; the town is stored only for that device and removed by the 30-day purge. | Automated test inspecting tables and captured logs; retention test | Pass | `server/test/offers.test.ts` "stores and logs no coordinates" (every table dumped and the captured request log searched for the coordinate digits), "turns the coordinates into a town, stores only the town…", "deletes the town with the scan after 30 days"; `server/test/retention.test.ts` includes `device_locations` |
| AC-008 | FR-008      | Given denied permission, unavailable location, or a failing Nominatim, then Austria-wide offers stay and a short message is shown. | Component and server tests | Pass | `web/src/test/web-prices.test.tsx` denied, unavailable, server-finds-no-town and no-geolocation cases; `server/test/offers.test.ts` "keeps Austria-wide offers when no town is found or the lookup is off" and the Nominatim failure test |
| AC-009 | FR-009      | Given two location requests within one second, then Nominatim is called at most once per second, with the identifying User-Agent, and a repeated rounded pair uses the cache. | Automated test with fake Nominatim and simulated time | Pass | `server/test/offers.test.ts` "calls at most once per second overall and answers a repeated rounded pair from the cache" (simulated clock: second call ≥ 1000 ms later, a repeated rounded pair makes no call) and "asks for the rounded pair with the identifying User-Agent…" |
| AC-010 | FR-010      | Search queries for offers contain the town name, never coordinates; the privacy notice (DE/EN) describes the optional location sharing, Nominatim and the retention. | Automated query inspection; read both texts in the browser | Pass | `server/test/offers.test.ts` "searches the shared town, with the town name and nothing else"; `web/src/test/web-prices.test.tsx` "privacy notice (AC-010)" checks both languages. Reading both texts in the browser is still open |
| AC-011 | All         | Live smoke run: one price search, one offer search and one Nominatim lookup with the team's keys return usable results. | Live run, output recorded | Pass | `npm run prices:smoke -w server`, 2026-11-22, with the team's keys (LangSearch, TinyFish, DeepSeek) and public Nominatim: SSD "500 GB M.2 2280 NVMe SSD" €79.98–253.78 · 15 offers, RAM "8 GB DDR4 SO-DIMM" €71.90–137.93 · 3 offers, battery "Lenovo ThinkPad T480 Akku" €32.99 · 2 offers (all from idealo.de and geizhals.at, found by TinyFish), Nominatim 47.41, 9.74 → Dornbirn, repair offers Austria-wide (three repair cafés in Graz) and near Dornbirn (Reparaturcafe Dornbirn). The first runs found too little; the fixes are in the self-review (findings 8 to 11) |
| AC-012 | All         | Typecheck, tests and build pass locally, CI passes on the `main` push, and a self-review with location handling checked is recorded with findings and resolutions. | Commands; CI link; review record below | Not run | |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified, merged into `main`, live smoke run (see the [plan](./PLAN.md#review-and-integration)).

**Local checks (2026-11-22, 3bc0cbc):** `npm run typecheck`, `npm test` (shared 148, server 459, web 162 tests) and `npm run build` pass.

**Self-review (2026-11-22)** of the branch diff against the plan, with location handling checked in particular. This is a self-review, not independent approval; a team member's look at the location handling is recommended by the plan.

| # | Finding | Resolution |
|---|---|---|
| 1 | Coordinates: they reach only the location route's handler and the Nominatim client. The request log records method and route only, new warnings carry error kinds or HTTP status, and the Nominatim cache lives in memory. | No change needed; covered by the AC-007 test. |
| 2 | The offer cache could have tied a town to a device link. | Keys are a hash of kind and town, with no device ID; only `device_locations` holds a town per link, and it joins the purge. |
| 3 | The web price links first sat in the card's "Why" block, breaking feature 008's two-source limit there (an existing test failed). | Moved into their own "Web price" section of the opened card. |
| 4 | The location bar's `role="status"` collided with the page's mode-change status region. | Uses `aria-live="polite"` instead. |
| 5 | Austria-wide offers are not checked to be in Austria on the server; the query, the AT/de locale and the LLM instruction keep them there, and the server checks only that the page names the place (and its town). | Accepted for now; listed as a residual risk. |
| 6 | When a new location lookup finds no town, the stored town is cleared rather than kept, so the page and the server agree on Austria-wide. | Intended (FR-008); documented in the server README. |
| 7 | The privacy notice wording (consent as the legal basis, Nominatim as recipient) was drafted here. | Needs the team's confirmation before release. |
| 8 | Live run 1: the search chain moved to TinyFish only when LangSearch returned nothing, but LangSearch returned allowlisted pages without prices (forum threads, 1 TB products), so no price and no place passed. | `src/search/lookup.ts`: prices and offers ask providers one by one until enough results pass the server checks. In every live run LangSearch contributed nothing; TinyFish found all results. |
| 9 | Pages often come back with a title and little text; geizhals titles carry the lowest price ("… ab € 96,70"). Forum subdomains were allowed. | The amount check reads title and text; the allowlist accepts the domain with or without `www.` only. |
| 10 | SSD and battery lookups varied between runs. | Price queries add "Preisvergleich" and ask for 10 results; in a comparison run this raised allowlisted pages with prices from 1 to 8 for the SSD and from 2 to 7 for the battery. Offers need two places before the next provider is skipped. |
| 11 | The same product at the same price on several listing pages was counted as several offers. | Offers are unique by product title and price. |

## Verification notes

- Web price ranges can be wide (the SSD range spans budget and high-end 500 GB drives) because every matching product counts; the impact table figures stay the basis for ranking.
- LangSearch adds a search per lookup without results for prices or offers; asking TinyFish first for these lookups would save time and cap, but changes the provider order of ADR-008 and is left to the team.
- Merged into `main` on 2026-11-22 at the user's request (bdf5537, after feature 018); typecheck, tests (shared 156, server 483, web 171) and build pass on the merge. CI on the `main` push (AC-012) is open.
