# Feature 003: Five-path assessment and ranking

- **Feature ID:** `feature-003-five-path-ranking`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-20

## Summary

After choosing what the device will be used for, the owner sees all five next-life paths (upgrade, repair, pass it on, salvage for parts, recycle) assessed for their specific device. Safety and compatibility gates mark paths as **Viable**, **Conditional**, or **Not suitable**, with reasons. A calculator estimates cost, extra useful life, and CO₂e as ranges against a stated baseline, using a curated static data table. Viable and conditional paths are scored on four criteria and ranked using **Environment first** or **Money first** weights; the owner switches between them with a toggle.

Rules enforce hard constraints, the calculator produces the numbers, and feature 002 retrieval supplies the sourced facts. The LLM is used here only to extract structured facts from retrieved passages, and every fact must cite a passage.

## Problem and desired outcome

- **Problem:** Owners cannot weigh upgrade versus repair versus passing on versus recycling. Typical "CO₂ saved" claims are inflated and double-counted.
- **Desired outcome:** A per-device, per-use ranking whose order can be justified criterion by criterion, with honest ranges, and that never makes an infeasible or unsafe option look attractive.
- **Target users / stakeholders:** Individual device owners; judges assessing environmental credibility.

## Approved scope

### In scope

- An intended-use picker with four options: office/browsing, school/university, programming/development, pass to someone else.
- Structured fact extraction from retrieved passages, with mandatory source citations.
- Deterministic feasibility and safety gates producing a suitability status and reasons per path.
- A curated static impact table (CO₂e ranges, sample part prices, new-device baseline, useful-life ranges), each entry with its source.
- A cost, extra-useful-life, and CO₂e calculator per path, against an explicit baseline.
- Four-criterion scoring with documented rubrics; Environment first and Money first weight sets in one config.
- A minimal ranked result view on the device page with a mode toggle and a per-criterion breakdown. The rich explained cards belong to feature 004.
- A confidence level (high, medium, low) per path, with reasons.

### Out of scope

- Free text explaining the ranking, and citations rendered as rich cards (feature 004).
- User-adjustable weight sliders (possible later amendment).
- Live prices, part purchase links, and local recycler or recipient lookup.
- A full lifecycle assessment, or use-phase energy modelling beyond what the static table covers.
- Aggregating impact across several devices (fleet dashboard, deferred).

## Functional requirements

- **FR-001:** The device page asks "What do you want to use this computer for?" with four options: office/browsing, school/university, programming/development, pass to someone else. Ranking is shown only after a choice, and the choice can be changed, which recomputes the ranking.
- **FR-002:** From the retrieved passages (feature 002), the system extracts structured facts per device into a fixed schema (for example RAM soldered or upgradeable, maximum RAM, storage slot type, battery user-replaceable, supported OS versions). A fact is only kept if it references at least one retrieved passage ID that supports it. Extracted facts are cached per device model.
- **FR-003:** Each of the five paths receives exactly one suitability status: `viable`, `conditional`, or `not_suitable`, with at least one human-readable reason.
- **FR-004:** A path that depends on a compatibility fact that cannot be verified (no supporting fact, or `model_evidence: "none"`) is never `viable`. It is `conditional`, with the reason "cannot verify …".
- **FR-005:** A path contradicted by a verified fact is `not_suitable`, citing that fact. Example: an upgrade that relies only on adding RAM when the RAM is soldered.
- **FR-006:** Safety gates never produce a path that asks the owner to perform hazardous work themselves. A repair involving a non-user-replaceable or swollen battery is at most `conditional`, with "professional repair" as its next step.
- **FR-007:** A static impact table holds, for each entry, a low and high value, a unit, a source reference, and an access date. It covers: the production CO₂e of a comparable new laptop, the production CO₂e of the parts used by any path (SSD, RAM, battery), sample part prices, the price of a comparable new laptop, and the extra-useful-life range per path and use.
- **FR-008:** For each viable or conditional path, the calculator outputs a cost range in euros, an extra-useful-life range in years, and a CO₂e range in kg relative to the baseline "the owner buys a comparable new laptop now". It also outputs the list of assumptions used. Each output value traces back to impact table entries.
- **FR-009:** Avoided new-device production is credited to a path only under its stated displacement assumption. For "pass it on", the credit is labelled conditional on the recipient otherwise buying new. Impact figures of alternative paths are never summed or presented as cumulative savings.
- **FR-010:** Each viable or conditional path gets a 0–100 score for each of four criteria (environmental impact, additional useful life, economic value, practical feasibility), using documented rubrics that take the intended use into account.
- **FR-011:** Weights live in one config: Environment first is 45/25/10/20 and Money first is 15/20/45/20 (environment / useful life / economic / feasibility). Weights are labelled illustrative and validated to sum to 100% per mode at startup.
- **FR-012:** The total score is the weighted sum. The ranked view lists viable paths by score, then conditional paths by score marked "Conditional", then not-suitable paths without a score, with their reasons.
- **FR-013:** Switching between Environment first and Money first recomputes the scores and order in the browser without a page reload or a new LLM call. The per-criterion breakdown for each path stays visible.
- **FR-014:** Each path shows a confidence level (high, medium, low) with reasons, lowered by missing scan fields, `model_evidence: "none"`, or impact entries with wide ranges.

## Non-functional requirements and constraints

- **Determinism:** Given the same scan, intended use, facts, impact table, and mode, scores and order are identical. Only fact extraction uses the LLM, and its output is cached.
- **Honesty:** No precise single-number CO₂e claims; ranges with a baseline always appear together. Values sourced from weak evidence are flagged.
- **Transparency:** Rubrics, weights, and the impact table are human-readable files in the repository, so judges can inspect them.
- **Security:** The LLM API key stays on the backend. Only passages and the device's hardware fields are sent to the LLM.
- **Performance:** The first assessment, including fact extraction, should take under 20 seconds; the mode toggle under 200 ms.

## User journeys and edge cases

1. **Upgradeable laptop, office use:** HDD, 8 GB RAM, healthy battery, and a model that the manual confirms has an M.2 slot. Upgrade is viable and ranks first in Environment first.
2. **Soldered RAM, programming use:** Programming needs 16 GB, but the RAM is soldered at 8 GB. The RAM upgrade is `not_suitable` with a cited reason; pass it on (to an office user) may rank higher.
3. **Unknown model:** With no model evidence, upgrade and repair are `conditional` ("cannot verify compatibility"), confidence is low, and recycle and pass it on remain assessable from generic evidence.
4. **Mode switch:** A device where a costly battery repair wins in Environment first, while pass it on wins in Money first. The toggle reorders without a reload. The order must not be forced to change if the data does not support it.
5. **Use change:** Switching from "office" to "pass to someone else" changes the baseline assumptions and can change the order.
6. **Desktop PC:** With no battery fields, the battery repair path is not applicable and is marked `not_suitable` with "no battery detected".

## Proposed technical approach

Not yet adopted; to be confirmed during implementation.

- **Location:** `server/src/assessment/` for facts, gates, calculator, and scoring; `data/impact.yaml` for the static impact table; `config/weights.yaml` for weights; `docs/` or code comments for rubrics.
- **Fact extraction:** Claude via the Anthropic API with tool use / structured output against a JSON schema. Each fact has `{key, value, source_passage_ids[]}`. Code validation drops facts whose passage IDs were not in the retrieved set. Results are cached in SQLite by normalized model.
- **Pure-function core:** `gates(scan, facts, use)` → statuses; `calculate(path, scan, facts, impactTable, use)` → ranges; `score(...)`. The browser receives criterion scores and both weight sets, so the toggle is a client-side recomputation.
- **Ranges:** Carry low and high through the calculations (interval arithmetic). Scoring uses the range midpoint, normalized against the device's set of paths; the rubric documents how.
- **Tests:** Table-driven unit tests for the gates (soldered RAM, unknown model, battery safety), calculator (no cross-path summation, conditional credit), weight validation, and scoring determinism; a web test for the toggle without a refetch; fact-extraction validation tests using a mocked LLM.

## Dependencies and risks

- **Dependency:** Feature 001 (scan schema, device page) and feature 002 (retrieval results, `model_evidence`).
- **Blocking for the real impact table:** The demo models need to be chosen (part types and prices), and defensible CO₂e sources need to be found (manufacturer product environmental reports, studies). The structure and tests can proceed with placeholder entries clearly marked as such.
- **Risk:** The rubrics or weights could double-count lifespan, which is already part of the CO₂e estimate. Mitigation: document how each criterion is derived; adjust after testing on the demo devices.
- **Risk:** LLM extraction may misread passages. Mitigation: required passage IDs, a deterministic schema, and manual checking of extracted facts for the demo models.
- **Risk:** Size. With 14 requirements this exceeds the usual guideline of about 10 criteria; the user accepted it as one feature because the gates, calculator, and scoring are not verifiable without each other.

## Review and integration

- **Completion boundary:** Locally verified handoff with self-review.
- **Review:** Self-review of the diff, the rubrics, and the impact table sources, recorded in `ACCEPTANCE_CRITERIA.md`. The team's circular-economy members are encouraged, but not required, to review the rubrics and weights.
- **CI/merge:** No CI yet. Server and web tests and type checks must pass locally. Pushing and merging need user authorization.

## Release and recovery (when applicable)

Not applicable to this feature: deployment is owned by feature 005.

## Assumptions and open questions

- Assumption: The weights are the adopted initial defaults, explicitly illustrative and tunable by the team (user decision, 2026-11-20).
- Assumption: The financial perspective is the current owner's out-of-pocket cost versus buying new. For "pass it on", the owner's cost is about zero, and any resale value is excluded.
- **Open:** Which CO₂e sources and boundaries to use for the new-laptop baseline and the parts. Decided during impact table curation and recorded with sources.
- **Open:** Exact fact schema keys. Finalized when the demo models' documents are known.
- **Open:** LLM model choice for extraction. Proposed default: a current Claude model via the Anthropic API.

## Scope change log

| Date       | Change                 | User approval                                                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Initial approved scope | User replied "accept" to the five-feature MVP proposal in the specification conversation, 2026-11-20 |

## Related and superseded features

None superseded. Depends on [feature 001](../feature-001-device-scan-and-upload/PLAN.md) and [feature 002](../feature-002-knowledge-base-retrieval/PLAN.md). Its result view is extended by [feature 004](../feature-004-explained-report/PLAN.md).

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: None yet
- Terms: [`docs/GLOSSARY.md`](../../GLOSSARY.md)
