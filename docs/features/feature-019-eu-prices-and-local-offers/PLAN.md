# Feature 019: European prices and local offers

- **Feature ID:** `feature-019-eu-prices-and-local-offers`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-22

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

leaaf prices options from a fixed impact table (`data/impact.yaml`) and points to Austrian repair, donation and drop-off services only through a handful of corpus documents. This feature adds two uses of the web search adapter from [feature 017](../feature-017-web-evidence-for-model-facts/PLAN.md):

1. **Web prices:** for SSD, RAM and battery options, current EUR price ranges from European shops and price comparison sites, shown as a labelled **Web price** next to the impact table figures. Ranking and plan totals keep using the impact table.
2. **Local offers:** repair cafés, repair shops, donation and drop-off points, searched for Austria by default. A new **Share location** button on the result page narrows them to the owner's town, using the browser's location turned into a town name with OpenStreetMap Nominatim. Coordinates are never stored.

It is the third of three web search features approved together on 2026-11-22 and depends on feature 017.

## Problem and desired outcome

- **Problem:** Impact table prices are fixed estimates, and the step plans name few concrete places where an owner can repair, donate or drop off a laptop.
- **Desired outcome:** Owners see what a part costs in European shops today and which places near them (or in Austria) can help, each with a link to check.
- **Target users / stakeholders:** Owners of scanned laptops, primarily in Austria.

## Approved scope

### In scope

- Web price ranges in EUR for SSD, RAM and battery options, from an allowlist of European shops and price comparison sites, shown next to the impact table figures.
- Local offers in the step plans of repair, pass it on and recycle options; Austria-wide by default.
- A **Share location** button on the result page, browser geolocation, server-side rounding and reverse geocoding to a town with Nominatim, and town-level searches.
- Caching, labels, failure handling, privacy notice lines for Nominatim and location, and documentation.

### Out of scope

- Web prices changing scores, ranking, the gauge or the "Your plan" totals (user choice 2026-11-22: "alongside").
- Purchase links, affiliate links, shopping carts or price alerts.
- Storing or logging coordinates; locations more precise than a town.
- A typed postcode field or a region selector (user chose geolocation via Nominatim).
- Prices for option kinds other than SSD, RAM and battery.

## Functional requirements

- **FR-001:** For each SSD, RAM and battery option on the result screen, the server searches European price sources for the matching part (from the option's facts, for example "M.2 2280 NVMe 1 TB" or the battery for the device's model) and extracts EUR prices. The option card shows a **Web price** range (lowest to highest found) with the number of offers, links to the sources, and the retrieval date.
- **FR-002:** Web prices never change scores, the ranking, the gauge or the plan totals; the impact table figures stay as they are and stay visible.
- **FR-003:** Only prices in EUR from an allowlist of European shops and price comparison sites count (configured in the repository, for example geizhals.eu, idealo.at, idealo.de). Fewer than two usable offers show no Web price.
- **FR-004:** Web prices are cached per part query for 7 days.
- **FR-005:** The step plans of repair, pass it on and recycle options show up to three local offers (name, town, link) found by web search, labelled **Web source · check**. Without a shared location they are searched for Austria.
- **FR-006:** The result page shows a **Share location** button. On press, the browser asks for location permission; when granted, the page sends the coordinates rounded to two decimals to the server, which turns them into a town name with Nominatim. The offers are then searched for that town, and the page shows "Near <town>" with a control to go back to Austria-wide offers.
- **FR-007:** Coordinates are never stored and never logged. Only the town name is stored, for that device link only, and it is deleted with the scan after 30 days.
- **FR-008:** When permission is denied, location is unavailable, or Nominatim fails, the page keeps the Austria-wide offers and shows a short message.
- **FR-009:** Nominatim is called from the server at most once per second overall, with an identifying `User-Agent`, and results are cached per rounded coordinate pair.
- **FR-010:** Only the town name (never coordinates) goes to the search providers. The privacy notice (German and English) states that sharing the location is optional, what Nominatim receives (coordinates rounded to about 1 km), what the search providers receive (the town name), and how long the town is kept.

## Non-functional requirements and constraints

- **Privacy:** Location is opt-in per device link. Rounded coordinates reach the server and Nominatim only; neither is persisted. The town is kept in a separate table, not in the scan JSON, so the admin details view (feature 016) does not show it unless decided otherwise.
- **Compliance:** Nominatim's usage policy (about 1 request per second, identifying User-Agent, no bulk use) must be respected; OpenStreetMap attribution is shown where the town is displayed.
- **Cost:** Price and offer searches share feature 017's daily cap.
- **Accessibility:** The Share location button and messages are keyboard-reachable and announced to screen readers.

## User journeys and edge cases

1. **Prices:** A T480 has an SSD upgrade option; its card shows "Web price €52–89 · 6 offers · geizhals.eu, idealo.at · 2026-11-22" next to the impact table range.
2. **Too few offers:** Only one offer is found; no Web price is shown (FR-003).
3. **Austria-wide offers:** A repair option's step plan lists three Austrian repair cafés from the web.
4. **Share location:** The owner presses Share location, allows it, and the list changes to "Near Dornbirn" with offers there. Pressing "Austria-wide" returns to the default.
5. **Denied or failed:** The browser denies permission; the page keeps the Austria-wide offers with a short note.
6. **Outside Austria:** The town is in Germany; offers are searched for that town as for any other.

## Proposed technical approach

Proposal based on repository inspection on 2026-11-22 (revision `dc51543`); not adopted yet.

- **Prices:** `server/src/prices/`: query building from option kind and facts, search with `includeDomains` set to the allowlist (`config/price-sources.yaml`), one structured LLM call extracting `{ price_eur, url, title }` per offer with the citation check, range and count computed on the server. Delivered as an addition to the option payload or a separate route; `shared/` gains a `WebPrice` contract.
- **Offers:** `server/src/offers/`: query per option path (`repair café <town|Österreich>`, `Laptop spenden <town>`, `Elektroaltgeräte Sammelstelle <town>`), LLM extraction of up to three offers with citations, cache per town and path. Step plans (feature 009) gain an offers block below their steps.
- **Location:** `POST /api/devices/:id/location` with `{ lat, lon }` (rounded again on the server) → Nominatim `reverse?format=json&zoom=10` → town; a `device_locations (device_id, town, created_at)` table joins the retention purge; `DELETE` resets to Austria-wide. The web app uses `navigator.geolocation.getCurrentPosition` with low accuracy.
- **Tests:** fake search, fake LLM and fake Nominatim for price extraction, allowlist, minimum offers, cache, ranking untouched, offer lists, location rounding, no coordinates persisted or logged, failures, rate limit; component tests for the Web price, offers and the button states.

## Dependencies and risks

- **Dependency:** Feature 017 (adapter, cap, Web source label).
- **Risk:** Price pages are partly rendered by JavaScript; search page text may miss prices. The minimum of two offers limits misleading ranges.
- **Risk:** Comparing like for like (for example a 2280 NVMe of 1 TB) depends on the facts; a wrong size or interface gives a wrong price range.
- **Risk:** Nominatim is a volunteer-run service; heavy use could be blocked. The rate limit and cache keep use low.
- **Risk:** Searching for local offers is weaker for small towns; the list may be empty, then the Austria-wide list is shown.

## Review and integration

- **Completion boundary:** Locally verified and merged into `main`, with a live smoke run of a price and an offer search and one Nominatim lookup. Release is a separate, later step authorized by the user.
- **Review:** Self-review of the final diff against this plan, with location handling (no coordinates persisted or logged) checked in particular, recorded in `ACCEPTANCE_CRITERIA.md`. Because location is privacy-sensitive, a short look by a team member is recommended, not required by repository policy.
- **CI/merge:** `npm run typecheck`, `npm test`, `npm run build`; CI passes on the `main` push. Merging needs the user's request.

## Release and recovery (when applicable)

Additive tables only. Location data is deleted with the scan (30 days) and can be removed earlier by dropping `device_locations`. No feature-specific release steps beyond feature 017's key configuration.

## Assumptions and open questions

- Assumption: "European standard" prices means EUR prices from European shops and price comparison sites, without a country preference (user, 2026-11-22).
- Assumption: two decimals (about 1 km) is precise enough to find the town and coarse enough to protect the owner.
- Open: the initial price source allowlist (proposal: geizhals.eu, geizhals.at, idealo.at, idealo.de, plus manufacturer part shops); to be confirmed during implementation.
- Open: whether the admin details view (feature 016) should show the shared town (default: no).

## Scope change log

| Date       | Change                 | User approval |
| ---------- | ---------------------- | ------------- |
| 2026-11-22 | Initial approved scope | User chose "Accept" for the three-feature web search proposal (017–019), 2026-11-22, after choosing European standard prices from EU shops shown alongside the impact table, Austria as the default for local offers, and an optional Share location button using Nominatim |

## Related and superseded features

- **Planned replacement of a non-goal in [`docs/PRODUCT.md`](../../PRODUCT.md):** "live price scraping or purchasing" becomes "purchasing"; live price lookups are displayed alongside the impact table. Planned until implemented.
- **Planned extension of [feature 009](../feature-009-concrete-step-plans/PLAN.md):** step plans of repair, pass it on and recycle options gain a local offers block; the steps themselves do not change.
- **Planned extension of [feature 006](../feature-006-web-app/PLAN.md) FR-046** (legal pages): the privacy notice gains the location and Nominatim lines.
- **Unchanged:** [feature 003](../feature-003-five-path-ranking/PLAN.md) FR-007 (impact table) and the ranking and plan figures of features 008 and 013.
- **Depends on:** [feature 017](../feature-017-web-evidence-for-model-facts/PLAN.md).

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: none yet
- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
