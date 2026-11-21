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
- *(amendment 2026-11-20)* The graphics card's gaming performance class, game-specific requirements, and adding a graphics card to a desktop.
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
- **FR-015** *(amendment 2026-11-20)*: The intended uses also include `general` (an everyday computer without a specific purpose) and `gaming`, so the contract's `IntendedUse` has six values. Together with feature 006 FR-008, FR-009, FR-021, and FR-023 this replaces the four-option list of FR-001 (see "Related and superseded features"). All other requirements apply to both new uses.
- **FR-016** *(amendment 2026-11-20)*: `general` uses the same RAM need (8 GB) and rubric rules as `office`. Its extra-useful-life entries reuse the `office` values and say so in their derivation.
- **FR-017** *(amendment 2026-11-20)*: `gaming` needs 16 GB of RAM and a dedicated graphics card, detected from the scan's GPU names. With integrated graphics only, upgrade and repair are `conditional` with the reason that integrated graphics cannot meet gaming needs. With no GPU names in the scan, they are `conditional` with a "cannot verify the graphics" reason. Pass it on, salvage, and recycle are assessed as for any other use.
- **FR-018** *(amendment 2026-11-20)*: The impact table has extra-useful-life entries for `gaming` on every path. The upgrade and repair entries are marked as estimates, because the cited reuse sources (ADEME, Fraunhofer IZM) have no gaming figures. The pass it on, salvage, and recycle entries do not depend on the current use and reuse the existing values, as FR-017 requires. Upgrade and repair for `gaming` show lower confidence than for `office` on the same device, with a reason naming the estimate.

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

The assessment pipeline and its adopted contracts are implemented. Real-device checks and model-specific impact coverage are pending.

- **Contracts (adopted 2026-11-20):** `Fact`/`FactSet` in [`shared/src/facts.ts`](../../../shared/src/facts.ts) and `Assessment` in [`shared/src/assessment.ts`](../../../shared/src/assessment.ts). Cross-field rules (weights sum to 100, not-suitable paths have no score or impact, `low <= high`, displacement sign rules) are in `shared/src/invariants.ts`. Ordering (`rankPaths`) is in `shared/src/ranking.ts`, so that the server and the browser toggle produce the same order. The payload carries criterion scores and both weight sets, never totals.
- **Location:** `server/src/assessment/` for facts, gates, calculator, and scoring; `data/impact.yaml` for the static impact table; `config/weights.yaml` for weights; `docs/` or code comments for rubrics.
- **Fact extraction:** Uses the provider-neutral `LlmClient.completeJson` in `server/src/llm/` ([ADR-002](../../adr/adr-002-llm-openai-compatible-deepseek.md)): DeepSeek `deepseek-flash` in JSON mode, with thinking disabled by default since 2026-11-20 (it was enabled before; see the open questions). DeepSeek does not enforce schemas, so the adapter puts the output schema in the prompt, validates every answer, and repairs once before raising `LlmError`. Each fact has `{key, value, source_passage_ids[]}`. **Implemented (T-001)** in `server/src/facts/`: the server drops a fact if any cited passage ID was not retrieved, merges repeated keys with equal values, and drops keys with conflicting values. Results are cached in SQLite (built-in `node:sqlite`, table `fact_cache`) under the normalized model plus a hash of the prompt version and the prompt input (passages and CPU), so a corpus or prompt change re-extracts. Only the model identity, form factor, and CPU name are sent with the passages. When the LLM fails, `LlmError` propagates and nothing is cached; the caller can continue with no facts, which makes compatibility-dependent paths "cannot verify" (FR-004).
- **Pure-function core:** `gates(scan, facts, use)` → statuses; `calculate(path, scan, facts, impactTable, use)` → ranges; `score(...)`. The browser receives criterion scores and both weight sets, so the toggle is a client-side recomputation. **Implemented (T-002, T-004 to T-006)** in `server/src/assessment/` with `config/weights.yaml`; the rules and rubrics are in [`DESIGN.md`](./DESIGN.md). Hardware facts are ignored without model evidence, and recycling is `conditional` while a reuse path is still possible (waste hierarchy).
- **Ranges:** Carry low and high through the calculations (interval arithmetic). Scoring uses the range midpoint, normalized against the device's set of paths; the rubric documents how.
- **Tests:** Table-driven unit tests for the gates (soldered RAM, unknown model, battery safety), calculator (no cross-path summation, conditional credit), weight validation, and scoring determinism; a web test for the toggle without a refetch; fact-extraction validation tests using a mocked LLM.

## Dependencies and risks

- **Dependency:** Feature 001 (scan schema, device page) and feature 002 (retrieval results, `model_evidence`).
- **Impact coverage:** Generic CO₂e sources and the three demo models are selected. T-008 still needs model-specific part prices and a sourced professional battery labour range.
- **Risk:** The rubrics or weights could double-count lifespan, which is already part of the CO₂e estimate. Mitigation: document how each criterion is derived; adjust after testing on the demo devices.
- **Risk:** LLM extraction may misread passages. Mitigation: required passage IDs, a deterministic schema, and manual checking of extracted facts for the demo models.
- **Risk:** Size. With 14 requirements this exceeds the usual guideline of about 10 criteria; the user accepted it as one feature because the gates, calculator, and scoring are not verifiable without each other.

## Review and integration

- **Completion boundary:** Locally verified handoff with self-review.
- **Review:** Self-review of the diff, the rubrics, and the impact table sources, recorded in `ACCEPTANCE_CRITERIA.md`. The team's circular-economy members are encouraged, but not required, to review the rubrics and weights.
- **CI/merge:** CI ([`.github/workflows/ci.yaml`](../../../.github/workflows/ci.yaml), added by feature 005 on 2026-11-20) runs the workspace checks and the scanner's Go checks on pull requests and pushes to `main`. Server and web tests and type checks must pass locally. Pushing and merging need user authorization.

## Release and recovery (when applicable)

Not applicable to this feature: deployment is owned by feature 005.

## Assumptions and open questions

- Assumption: The weights are the adopted initial defaults, explicitly illustrative and tunable by the team (user decision, 2026-11-20).
- Assumption: The financial perspective is the current owner's out-of-pocket cost versus buying new. For "pass it on", the owner's cost is about zero, and any resale value is excluded.
- **Resolved (2026-11-20, research requested by the user):** CO₂e sources and boundaries. Production is cradle-to-gate plus distribution, end of life has no recycling credits, and reuse figures follow ADEME (2022) as recommended by Fraunhofer IZM (2022). Every entry in [`data/impact.yaml`](../../../data/impact.yaml) cites its sources and shows its derivation. The team's component research was cross-checked; where the sources disagreed (for example battery, SSD, and RAM CO₂e, and pre-shortage part prices), the values were changed and the earlier estimate noted.
- **Resolved (2026-11-20, user decision when the shared contracts were defined together, 2026-11-20):** v1 fact keys are the memory facts (`ram_soldered`, `ram_slots_total`, `ram_max_gb`, `ram_type`), storage facts (`storage_slots`), battery facts (`battery_user_replaceable`, `battery_replacement_part_available`), and software support facts (`windows11_supported_cpu`, `latest_supported_os`, `vendor_bios_updates_ended`). Adding keys later is an additive contract change.
- **Resolved (2026-11-20, user decision):** CO₂e per path is shown as three ranges: the path's own emissions, the shared baseline, and `avoided_vs_baseline` (the credited baseline minus the path). How much of the baseline is credited follows `displacement` (`assumed`, `conditional`, or `none`). This implements FR-008 and FR-009.
- **Resolved (2026-11-20, user decision):** The LLM is reached through an OpenAI-compatible adapter, currently DeepSeek `deepseek-flash` via its official API. Thinking is configurable per task and on for extraction ([ADR-002](../../adr/adr-002-llm-openai-compatible-deepseek.md)).
- **Resolved (2026-11-20, user decision, revising the previous item):** thinking is off for fact extraction by default. With it on, the first live assessment took 26.4 s, above the 20 s performance target; with it off, 1.8 s, with identical facts on the T480 and the fixture laptop. Recorded in ADR-002.

## Scope change log

| Date       | Change                 | User approval                                                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Initial approved scope | User replied "accept" to the five-feature MVP proposal in the specification conversation, 2026-11-20 |
| 2026-11-20 | Amendment: `general` and `gaming` intended uses (FR-015 to FR-018, AC-016 to AC-020, T-011 to T-014), plus the exclusion of GPU performance classes. FR-015 replaces FR-001's four-option list together with feature 006. Other requirements and exclusions are unchanged. | User chose "Add both to contract" when asked how the assessment route should handle the web app's `general` and `gaming` tags, then replied "accept" to the proposed scope, 2026-11-20 |
| 2026-11-20 | Clarification during implementation: FR-018 and AC-019 marked every gaming life entry as an estimate, which contradicted FR-017 (pass it on, salvage, and recycle are assessed as for any other use, including their confidence). Only the upgrade and repair entries are estimates. Their values (1–2 years) are below development use (1–3 years). This resolves a conflict in the approved text and adds no scope. | Agent clarification, reported to the user in the implementation summary |

## Related and superseded features

FR-001's list of four options is replaced by FR-015 here together with feature 006 FR-008, FR-009, FR-021, and FR-023 (six options, `general` as the default, ranking shown at once for the default). Effective since 2026-11-20, when T-011 to T-014 were implemented on `main`; the rest of FR-001 (changing the use recomputes the ranking) stays in force. Depends on [feature 001](../feature-001-device-scan-and-upload/PLAN.md) and [feature 002](../feature-002-knowledge-base-retrieval/PLAN.md). Its result view is extended by [feature 004](../feature-004-explained-report/PLAN.md).

**Gaming processor check added by [feature 012](../feature-012-gaming-cpu-check/PLAN.md)** (implemented on `main` 2026-11-21). FR-017 is extended: for gaming, a processor below the floor documented in [DESIGN](DESIGN.md#gate-rules) makes upgrade and repair `not_suitable`. The RAM and graphics parts of FR-017, and AC-018, are unchanged.

**Windows 11 rules limited to Windows devices by [feature 007](../feature-007-macos-linux-scanner/PLAN.md#related-and-superseded-features) FR-015 and FR-016** (implemented on `main` 2026-11-21, commit "feat(server): keep Windows 11 rules to Windows devices"). For a `macos` or `linux` device, the Upgrade, Repair and Pass it on rows of [DESIGN](DESIGN.md) no longer use Windows 11 CPU support; Pass it on is conditional with security updates as "cannot verify". Windows devices and records without `os.family` are assessed as before; all other rules are unchanged.

**FR-012 replaced on the result screen by [feature 008](../feature-008-ai-categories-and-options/PLAN.md#related-and-superseded-features) FR-006** (implemented 2026-11-21 on branch `feat/ai-categories` (commits cf09cde "feat(server): build AI categories and options on the report stream" and c91862d "feat(web): show AI categories with option cards and tabs"); merged into `main` 2026-11-21 (merge commit 17c04b4) and effective there). When the category call succeeds, the result screen ranks AI categories and options instead of the five paths. The five-path ranked view stays in force while the categories are loading and as the fallback (008 FR-013). The constraint "Only fact extraction uses the LLM" is replaced for which options exist, their status, and AI-estimated figures ([ADR-003](../../adr/adr-003-ai-chosen-options.md)). FR-002 to FR-011, FR-013 and FR-014 stay in force: the assessment is still computed, it is the category call's input and the fallback, and its rubrics and weights score the options. The feasibility values per difficulty are recorded in [DESIGN](DESIGN.md#scoring-rubrics-0100-each).

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Design (gate rules, calculator, rubrics, confidence): [`DESIGN.md`](./DESIGN.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: [Shared contracts](../../adr/adr-001-shared-contracts-typebox.md) and [LLM adapter](../../adr/adr-002-llm-openai-compatible-deepseek.md)
- Terms: [`docs/GLOSSARY.md`](../../GLOSSARY.md)
