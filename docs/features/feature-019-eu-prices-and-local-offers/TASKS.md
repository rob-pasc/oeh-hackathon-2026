# Implementation Tasks: European prices and local offers

- **Feature ID:** `feature-019-eu-prices-and-local-offers`
- **Status:** Specified

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [ ] **T-001:** Add `config/price-sources.yaml` with the allowlist confirmed by the user on 2026-11-22 (geizhals.eu, geizhals.at, idealo.at, idealo.de) and add the `WebPrice` and local offer contracts in `shared/` (supports `AC-001`, `AC-003`)
- [ ] **T-002:** Build `server/src/prices/`: query building, allowlisted search, LLM price extraction with citations, range, cache; tests including "ranking untouched" (supports `AC-001`–`AC-004`)
- [ ] **T-003:** Build `server/src/offers/`: per-path queries, LLM extraction of up to three offers, cache per town and path; tests (supports `AC-005`, `AC-010`)
- [ ] **T-004:** Build the location route, Nominatim client with rate limit and cache, `device_locations` table and retention purge; tests for rounding, no persisted or logged coordinates, failures (supports `AC-006`–`AC-009`)
- [ ] **T-005:** Web app: Web price on option cards, offers block in step plans, Share location button with its states, OSM attribution, mock data; component tests (supports `AC-001`, `AC-005`, `AC-006`, `AC-008`)
- [ ] **T-006:** Privacy notice DE/EN, `docs/PRODUCT.md` non-goal, server README, README status (supports `AC-010`)
- [ ] **T-007:** Live smoke run, all checks, self-review with location handling, feature index update, reciprocal notes in the feature 006 and 009 plans (supports `AC-011`, `AC-012`)

## Dependencies and blockers

- Blocked on feature 017 being implemented (search adapter, cap, labels).

## Progress notes

None yet.

## Lifecycle history

- 2026-11-22: Specified after scope approval (see the [plan's scope change log](./PLAN.md#scope-change-log)).
