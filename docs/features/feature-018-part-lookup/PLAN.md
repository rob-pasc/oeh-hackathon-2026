# Feature 018: Part lookup

- **Feature ID:** `feature-018-part-lookup`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-22

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

The result screen lists the scanned parts (processor, memory, graphics, storage, battery) but says nothing about them. Feature 006 designed a part lookup with "Parts list" and "AI search · check" badges, but only mock mode shows it; the backend was never built. This feature looks up each detected part after the upload: in the curated corpus first, and on the web through the search adapter of [feature 017](../feature-017-web-evidence-for-model-facts/PLAN.md) when the corpus has nothing on it. The result screen's scan specs then show one sentence per part with a badge and a source link.

It is the second of three web search features approved together on 2026-11-22 and depends on feature 017.

## Problem and desired outcome

- **Problem:** Owners see raw part names such as "Intel Core i5-8250U" or "SK hynix PC401 NVMe" without knowing what they mean for the laptop's future.
- **Desired outcome:** Each part on the result screen has one short, sourced sentence (for example its generation, interface or typical lifespan) and shows where that sentence came from.
- **Target users / stakeholders:** Owners of scanned laptops; the demo audience.

## Approved scope

### In scope

- A lookup per detected part after the upload: corpus first, web search when the corpus results are lacking.
- One LLM call per scan that writes one cited sentence per part.
- Badges, sentence and source link per part in the result screen's scan specs.
- Caching per normalized part name, sharing feature 017's daily cap and fallback chain.
- Mock-mode sample data, documentation and the privacy notice lines for part names.

### Out of scope

- Live part events during the scan: the scanner is not changed, and the scan page's "Found so far" card (feature-006-web-app / FR-026) keeps its current live behavior (user choice 2026-11-22: "After upload, on results").
- The team's Excel parts list from the feature 006 design (replaced by the corpus as first source, user choice 2026-11-22).
- Using part lookups to change assessments, gates or ranking.
- Price lookups (feature 019).

## Functional requirements

- **FR-001:** After a device is uploaded, the server looks up each part the scan contains (processor, memory, graphics, each internal drive, battery) in the corpus by its normalized identifier.
- **FR-002:** When the corpus has no passage naming a part's normalized identifier, the server searches the web for it through feature 017's search adapter, using the same provider order, daily cap and timeout rules. Only the part identifier goes into the query.
- **FR-003:** One LLM call per device writes at most one sentence per part from the found passages and cites at least one of them. A sentence without a valid citation is dropped and that part reads "No match".
- **FR-004:** In the result screen's scan specs, each part shows a badge: **Knowledge base** (cited corpus passage), **Web search · check** (cited web passage), **No match**, or **Looking up…** while pending. Parts with a sentence show it and a link to the cited source.
- **FR-005:** The lookup does not delay the rest of the result screen; failures, a reached cap or a timeout end in "No match" for the affected parts.
- **FR-006:** Lookups are cached per normalized part identifier for 30 days; a later scan with the same part makes no new search or LLM call for it.
- **FR-007:** Without a configured LLM, no lookup runs and the scan specs look as before this feature. Without a search provider, only corpus lookups run.
- **FR-008:** Mock mode shows sample lookups with all four badges.
- **FR-009:** The privacy notice (German and English) states that part names, but no other scan data, are sent to the search providers.

## Non-functional requirements and constraints

- **Privacy:** Part identifiers (CPU, GPU, drive and battery model names, memory type and size) are not personal data; no serial numbers are collected by the scanner. Per-device lookup results are deleted with the scan after 30 days; the per-part cache holds no device reference.
- **Cost:** At most five parts plus extra drives per scan; one LLM call per device, counted against `LLM_DAILY_CALLS`.
- **Performance:** The lookup runs in the background; the result screen is usable before it ends.

## User journeys and edge cases

1. **Corpus part:** A T480 scan lists "Intel Core i5-8350U"; the corpus's Windows 11 processor list names it, so the badge reads Knowledge base with a sentence and a link to Microsoft's list.
2. **Web part:** A drive "SK hynix PC401" is not in the corpus; the web search finds a spec page, and the badge reads Web search · check.
3. **Nothing usable:** A battery identifier yields no results; the badge reads No match.
4. **Second scan of the same model:** All lookups come from the cache.
5. **No LLM key locally:** The scan specs look as before.

## Proposed technical approach

Proposal based on repository inspection on 2026-11-22 (revision `dc51543`); not adopted yet.

- A `server/src/parts/` module: identifier normalization per part kind, corpus lookup through the existing retriever (FTS query on the identifier), web fallback through feature 017's adapter, one structured LLM call (`task: 'part_lookup'`) with the existing citation check, cache table `part_cache` and per-device results table `part_lookups` (both additive; the device table joins the retention purge in `server/src/retention.ts`).
- Delivery: a new report stream event `parts` (or a `GET /api/devices/:id/parts` route polled by the page); to be settled during implementation.
- Web: `SpecsCard` gains the badge, sentence and link per part, reusing the badge styles of `PartsCard`; `DetectedPart` in `web/src/api/types.ts` is aligned with the server contract in `shared/`.

## Dependencies and risks

- **Dependency:** Feature 017 (search adapter, cap, Web source passages) must be implemented first.
- **Risk:** Part identifiers from WMI or sysfs are noisy (vendor prefixes, trailing codes); normalization decides the hit rate.
- **Risk:** One more LLM call per new device uses the daily LLM allowance faster.

## Review and integration

- **Completion boundary:** Locally verified and merged into `main`, with a live smoke run of a part lookup against the configured providers. Release is a separate, later step authorized by the user.
- **Review:** Self-review of the final diff against this plan, recorded in `ACCEPTANCE_CRITERIA.md`.
- **CI/merge:** `npm run typecheck`, `npm test`, `npm run build`; CI passes on the `main` push. Merging needs the user's request.

## Release and recovery (when applicable)

Additive tables only; without an LLM key or provider keys the feature degrades as in FR-007. No feature-specific release steps beyond feature 017's key configuration.

## Assumptions and open questions

- Assumption: the corpus "lacks" a part when no passage contains its normalized identifier; to be tuned if the hit rate is poor.
- Open: stream event versus separate route for delivery (implementation choice).

## Scope change log

| Date       | Change                 | User approval |
| ---------- | ---------------------- | ------------- |
| 2026-11-22 | Initial approved scope | User chose "Accept" for the three-feature web search proposal (017–019), 2026-11-22, after choosing the part lookup, corpus first then web, and "After upload, on results" |

## Related and superseded features

- **[Feature 006](../feature-006-web-app/PLAN.md) FR-026:** unchanged. Its live "Found so far" card still has no part events; this feature shows lookups on the result screen instead. The "Parts list" (Excel) source named in feature 006's DESIGN.md proposal is not built; the corpus takes its place for the result screen. No 006 requirement is replaced.
- **Depends on:** [feature 017](../feature-017-web-evidence-for-model-facts/PLAN.md).

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: none yet (the search adapter ADR is created by feature 017)
- Design reference: [feature 006 DESIGN.md, proposed part event](../feature-006-web-app/DESIGN.md)
