# Implementation Tasks: European prices and local offers

- **Feature ID:** `feature-019-eu-prices-and-local-offers`
- **Status:** In progress

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Add `config/price-sources.yaml` with the allowlist confirmed by the user on 2026-11-22 (geizhals.eu, geizhals.at, idealo.at, idealo.de) and add the `WebPrice` and local offer contracts in `shared/` (supports `AC-001`, `AC-003`)
- [x] **T-002:** Build `server/src/prices/`: query building, allowlisted search, LLM price extraction with citations, range, cache; tests including "ranking untouched" (supports `AC-001`–`AC-004`)
- [x] **T-003:** Build `server/src/offers/`: per-path queries, LLM extraction of up to three offers, cache per town and path; tests (supports `AC-005`, `AC-010`)
- [x] **T-004:** Build the location route, Nominatim client with rate limit and cache, `device_locations` table and retention purge; tests for rounding, no persisted or logged coordinates, failures (supports `AC-006`–`AC-009`)
- [x] **T-005:** Web app: Web price on option cards, offers block in step plans, Share location button with its states, OSM attribution, mock data; component tests (supports `AC-001`, `AC-005`, `AC-006`, `AC-008`)
- [x] **T-006:** Privacy notice DE/EN, `docs/PRODUCT.md` non-goal, server README, README status (supports `AC-010`)
- [ ] **T-007:** Live smoke run, all checks, self-review with location handling, feature index update, reciprocal notes in the feature 006 and 009 plans (supports `AC-011`, `AC-012`)

## Dependencies and blockers

- Feature 017 is implemented (verification pending); this feature builds on its adapter and cap.

## Progress notes

- 2026-11-22: T-001 and T-002 done. Prices are served on their own route, `GET /api/devices/:id/prices`, so the category result is untouched (FR-002). The part follows the plan the impact table prices: a 500 GB SSD with the gate's interface and the slot's M.2 length from the facts, the gate's RAM module with the memory type from the facts or the scan (LPDDR gets no price), and "<manufacturer> <model> Akku" for batteries, whose pages must name the exact model. The search interface gained `includeDomains` (LangSearch `includeDomains`, TinyFish `include_domains`) and an optional `locale` (TinyFish only); hosts are also checked on the server. One LLM call (new task `web_extraction`, thinking off) lists the offers; the server keeps an offer only from an allowlisted page, in EUR, within plausible bounds per kind, and when the exact amount appears in that page's text. Checked offers are cached per part for 7 days in `web_price_cache`, empty results included; failures are not cached.
- 2026-11-22: T-003 and T-004 done. Offers are served on `GET /api/devices/:id/options/:optionId/offers` rather than inside the step plan, since the shared town changes them without changing the steps. An option's offer kind is its closest path (repair, pass_on or recycle). Austria-wide searches pass `locale` AT/de; town searches send only the kind's words and the town. The server keeps a place only when its page names it, and a town only when the page names that too; at most three. `local_offer_cache` keys are a hash of kind and town, so no row links a town to a device. Location: `GET`/`POST`/`DELETE /api/devices/:id/location`; Nominatim `reverse` (jsonv2, zoom 10, German names) behind a one-request-per-second queue and an in-memory cache per rounded pair, so coordinates never reach the database. A failed or empty lookup clears the stored town (Austria-wide). `NOMINATIM_URL=none` turns the lookup off. `device_locations` joins the retention purge.
- 2026-11-22: T-005 done. Option cards show a "Web price" chip with the range and offer count in the header, next to the impact table figures; the header is a button, so the site links and retrieval date sit in the opened card's own "Web price" section (outside "Why", which keeps its two-source limit). Repair, pass it on and recycle options load their offers when opened, and again when the town changes; each place is labelled "Web source · check". A location bar above the options shows "Austria-wide" with **Share location**, or "Near <town>" with an **Austria-wide** button and the OpenStreetMap attribution; messages use an `aria-live` region, since the page's `role="status"` region belongs to mode changes. Mock mode serves fictional prices and places on example domains.
- 2026-11-22: T-006 done. The privacy notice (DE/EN) gained a paragraph on price and offer searches in section 4 and a new section 5 on optional location sharing (rounded coordinates to Nominatim, which sees the server's IP; town only stored, per result link, deleted after 30 days or on "Austria-wide"; consent as legal basis); later sections were renumbered and the recipients section names Nominatim. The legal wording is the team's to confirm. `docs/PRODUCT.md` narrows the non-goal to purchasing; server README and root README are updated.

## Lifecycle history

- 2026-11-22: Specified after scope approval (see the [plan's scope change log](./PLAN.md#scope-change-log)).
- 2026-11-22: Implementation started on branch `feat/pricesandoffers`.
