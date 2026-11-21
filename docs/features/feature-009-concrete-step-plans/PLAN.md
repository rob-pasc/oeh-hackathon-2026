# Feature 009: Concrete step plans

- **Feature ID:** `feature-009-concrete-step-plans`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-21

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

Today a path's "What to do" is one or two vague sentences, such as "If considering salvage, have a qualified service provider remove reusable parts." With this feature, opening an option (from [feature 008](../feature-008-ai-categories-and-options/PLAN.md)) produces a curated, numbered plan: do x, then y, then z. Each step has an imperative title and a short explanation, plus the tools, parts and time it needs. Each step also carries a safety flag and links to the knowledge-base passages it is based on. The AI writes the plan from the retrieved passages and its own reasoning. Technical steps without a source are removed, so the plan never presents an unsourced procedure as fact.

## Problem and desired outcome

- **Problem:** Next steps are generic one-liners ("you could …") with no sources. The explanation prompt asks for brief fields, and steps cannot carry citations.
- **Desired outcome:** An owner can follow a concrete, ordered plan for the option they chose, see what they need and how long it takes, and check each technical step against its source.
- **Target users / stakeholders:** Owners of old Windows laptops; hackathon judges and demo audience.

## Approved scope

### In scope

- A structured step contract: title, detail, tools, parts, time, safety flag, step kind, and cited passages.
- Generating the plan when an option is opened, with caching per device, intended use and option.
- Grounding: steps cite where possible; technical steps without a valid citation are removed; general steps may come from the AI's own reasoning.
- Step blocks in the option card, with per-step source links and safety flags.
- Template step plans for the fallback and for failed step calls, and sample plans for mock mode.

### Out of scope

- Choosing categories and options (feature 008) and curating new sources (feature 010).
- Server-side safety validation of step content; safety is enforced through the prompt, as decided for feature 008.
- Shop links, prices per part, or ordering parts.
- Photos, videos, or interactive progress tracking (checking off steps).
- Translations; plans are in English like the rest of the interface.

## Functional requirements

- **FR-001:** Opening an option card for the first time requests that option's step plan. The server makes one AI call (the step call) per device, intended use and option, and caches the result. Reopening the card, reloading the page, or switching modes does not make a new call. A prompt change invalidates older cached plans.
- **FR-002:** A step plan is an ordered list of 1 to 12 steps, shown as numbered blocks. Each step has an imperative title (at most 80 characters) and a detail of one to three sentences saying how to do it.
- **FR-003:** A step may list the tools it needs (for example "Phillips #0 screwdriver"), the parts it needs with their specification (for example "8 GB DDR4-2400 SO-DIMM"), and an estimated time as a range in minutes. Empty lists and a missing time are not shown.
- **FR-004:** Each step has a safety flag: `none`, `caution` or `professional`. A `caution` step shows a visible warning sentence. A `professional` step is marked "Professional only" and its detail says to have a service provider do it.
- **FR-005:** Each step has a kind (`technical` or `general`) and a list of cited passage IDs. The server removes cited IDs that were not supplied to the step call. It then removes every `technical` step that is left without a citation. Technical means opening the device, handling internal parts, part specifications, or compatibility.
- **FR-006:** If removals leave no steps, the card shows "No verified steps for this option yet. Ask a service provider to confirm it." instead of the plan.
- **FR-007:** Each step with citations shows its sources as links (document title, opening the source URL in a new tab).
- **FR-008:** Step text (title, detail, tools, parts) contains no numeric euro or CO₂e figure; a step call answer that contains one is rejected, as in feature 004 FR-005.
- **FR-009:** The step call receives the scan fields, intended use, the option (title, kind, difficulty, status, reason), the extracted facts, and passages retrieved for that option. Its prompt asks for concrete, ordered, device-specific instructions without hedging ("do x", not "you could do x"). It repeats the safety rules of feature 008 FR-012 and asks to name local Austrian offers when the passages provide them.
- **FR-010:** While the plan loads, the card shows the thinking line and step placeholders of feature 006 FR-045.
- **FR-011:** When the step call cannot be made or fails (no API key, provider error, timeout, invalid answer after repair, or daily budget used up), the card shows a template plan for the option's kind with the notice "AI steps unavailable". Template plans exist for every priced kind of feature 008 FR-003 and a generic one for `other`. Template plans use the same step structure; their technical steps cite corpus passages or are flagged `professional`.
- **FR-012:** The fallback categories of feature 008 FR-013 use the template plans of FR-011 without calling the AI.
- **FR-013:** In mock mode, every sample option of feature 008 FR-015 has a sample step plan that uses tools, parts, time, all three safety flags, and source links somewhere in the set.

## Non-functional requirements and constraints

- **Latency:** A step plan should appear within the step call's deadline (proposed default 25 s). Only one plan is generated at a time per opened card.
- **Cost:** Step calls count against the daily LLM budget. Generating plans only on open keeps the number of calls proportional to what users look at.
- **Accessibility:** Steps are an ordered list for screen readers; the safety flag is announced as text, not only by colour.
- **Safety principle:** The product principle that hazardous self-repair is never recommended is enforced through the prompt and the `professional` flag. There is no server-side content check (accepted risk, see feature 008).

## User journeys and edge cases

- **T480 RAM option:** For example: 1. Shut down and disable the built-in battery in the BIOS (caution, source: hardware maintenance manual). 2. Remove the bottom cover (Phillips #0, ~10 min, source). 3. Insert the 8 GB DDR4-2400 SO-DIMM into the free slot (source: iFixit). 4. Reattach the cover and check that Windows shows 16 GB (general).
- **Hand down (general steps):** For example, back up your files, reset Windows with "Remove everything" (source: Microsoft), and bring the laptop to PCs für alle (source). Back-up steps need no citation.
- **Battery in an XPS 13 9360:** The internal battery replacement is flagged `professional`.
- **All technical steps uncited:** The empty-plan message of FR-006 appears.
- **Step call fails:** The template plan appears with "AI steps unavailable" (FR-011).

## Proposed technical approach

Proposed, not yet adopted:

- **Contract:** `StepPlan` in `shared/src/` with `steps[]` (`title`, `detail`, `tools[]`, `parts[]`, `minutes: Range | null`, `safety`, `kind`, `passage_ids[]`) plus `source: 'llm' | 'template'`, `notice`, and the cited passages.
- **Route:** `GET /api/devices/:id/options/:optionId/steps?intended_use=…` returning JSON (or SSE if the thinking line needs progress). Option IDs come from the cached `CategoryResult` of feature 008.
- **Retrieval:** Per option, query the existing index with the option's title and kind plus the facets of the closest path, with the existing model-aware filters (`server/src/retrieval/retrieve.ts`).
- **Server:** A new `server/src/steps/` module with the prompt, validation (FR-005, FR-008), templates (FR-011), and an additive SQLite table `step_cache` keyed by device, intended use, option ID and prompt hash.
- **Web:** A step list component in the option card that replaces today's one-line "What to do" items.
- **Unresolved:** JSON or SSE for the route; whether to prefetch the plan of the recommended option.

## Dependencies and risks

- Depends on feature 008 (options and their IDs) and benefits from feature 010 (step-level sources). Without new sources, many technical steps will be removed and plans will be short.
- Prompt-only safety (accepted risk): a step could still describe hazardous work as `caution` instead of `professional`. This is checked in the demo review (AC-015).
- The AI may mark a technical step as `general` to avoid removal. The demo review checks for this.
- Additive migration: a new `step_cache` table; existing data is untouched.

## Review and integration

Completion boundary: locally verified handoff, with self-review of the final diff against this plan. Required checks: `npm run typecheck`, `npm test`, `npm run build`. Pushing, opening a PR, and merging need the user's request.

## Release and recovery (when applicable)

Not applicable: no deployment exists yet (feature 005 owns it). The `step_cache` table is additive and can be dropped to reset.

## Assumptions and open questions

- Option IDs from feature 008 are stable within a cached category result.
- Open: JSON or SSE for the step route; prefetching the recommended option's plan.
- Open: the step call's timeout and whether thinking is enabled.

## Scope change log

| Date       | Change                 | User approval                                                                                                                                                                                    |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-21 | Initial approved scope | User asked for "do x, then y, then z" steps drawn from the knowledge base and the AI's reasoning, chose "cite where possible" and all four step fields, and replied "accept" to the proposal, 2026-11-21 |
| 2026-11-21 | Renumbered from feature 008 to feature 009 when merging into `main`, because `feature-007-macos-linux-scanner` already held 007 there and the three features shifted together (docs/workflow/ALLOCATION.md, duplicate numbers). Requirement, acceptance and task IDs, scope and history are unchanged. | User asked to merge the branches into `main`, 2026-11-21 |

## Related and superseded features

All replacements below are **planned**; none is effective until this feature is implemented.

- [`feature-004-explained-report`](../feature-004-explained-report/PLAN.md): the "What to do next" section of **FR-003** (one-line `next_steps` strings without citations) is replaced, for options, by the structured step plans here. FR-005's figure rule carries over (FR-008 here). FR-009's template fallback is extended by FR-011.
- [`feature-006-web-app`](../feature-006-web-app/PLAN.md): the step blocks of **FR-015** and the "What to do" steps of **FR-017** are replaced by the step blocks of FR-002 to FR-007 here. FR-045 (thinking line) applies unchanged (FR-010).
- [`feature-008-ai-categories-and-options`](../feature-008-ai-categories-and-options/PLAN.md): this feature fills the step plan area of 008 FR-010 and the fallback of 008 FR-013.
- [`feature-010-step-level-knowledge-base`](../feature-010-step-level-knowledge-base/PLAN.md) supplies the sources these steps cite.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: [ADR-002](../../adr/adr-002-llm-openai-compatible-deepseek.md) (LLM provider)
- Related features: [004](../feature-004-explained-report/PLAN.md), [006](../feature-006-web-app/PLAN.md), [008](../feature-008-ai-categories-and-options/PLAN.md), [010](../feature-010-step-level-knowledge-base/PLAN.md)
