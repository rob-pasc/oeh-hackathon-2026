# Feature 008: AI categories and options

- **Feature ID:** `feature-008-ai-categories-and-options`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-21

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

Today the result screen always shows the same five paths (upgrade, repair, pass it on, salvage for parts, recycle) as fixed tabs and cards. With this feature an AI call chooses the categories that make sense for the scanned device and the chosen intended use, for example "Faster storage", "Battery" or "Windows 11". Each category groups concrete options (for example "Swap the HDD for a 500 GB SSD"). Each option carries a status, a reason, and cost, extra-life and CO₂e ranges. These come from the existing calculator where the impact table can price the option, and otherwise from an AI estimate that is labelled as such. Options are scored with the existing criteria and weights, and the categories are ranked on the Overview. The Environment first / Money first toggle keeps working in the browser.

When the AI is unavailable, the screen falls back to today's five deterministic paths, so the demo never breaks. The concrete step plans inside each option are specified separately in [feature 009](../feature-009-concrete-step-plans/PLAN.md).

## Problem and desired outcome

- **Problem:** The five fixed paths read like a generic menu. Some are irrelevant for a given device, and the real options (which part, which offer) are hidden inside a path. The per-action options of feature 006 FR-017 exist only as mock data, because the server never sends them.
- **Desired outcome:** An owner sees a short, ranked set of categories that fit their laptop, each with concrete options and honest figures. AI-estimated figures are visibly marked.
- **Target users / stakeholders:** Owners of old Windows laptops; hackathon judges and demo audience.

## Approved scope

### In scope

- One AI call per device and intended use that returns 3–6 categories, each with one or more options.
- Option figures from the existing calculator when the option's kind is priced by the impact table, and AI-estimated ranges labelled "AI estimate" otherwise.
- Criterion scores derived from the figures with the existing rubrics, and feasibility derived from the AI's difficulty rating. Categories are ranked by their best option.
- Dynamic toolbar tabs (Overview plus one tab per category), the Overview listing the ranked categories, and category tabs listing option cards.
- Safety and feasibility rules given to the AI in the prompt only (user decision, 2026-11-21).
- A fallback to the five deterministic paths and template text when the AI is unavailable.
- Caching per device and intended use, and sample data for mock mode.

### Out of scope

- Step plans inside options (feature 009) and new knowledge-base documents (feature 010).
- Server-side validation of AI categories against the feasibility and safety gates. The user chose prompt-only enforcement; a server backstop was offered and not taken.
- Live price lookups, shop links, or purchasing.
- Users editing, adding, or hiding categories.
- Changes to the scanner, the scan page, or the scan contract.
- Weight sliders or new ranking criteria.

## Functional requirements

- **FR-001:** For a device and intended use, the server makes one AI call (the category call) that returns between 3 and 6 categories. Each category has a stable ID, a short device-specific label chosen by the AI (at most 24 characters), a one-sentence summary, and at least one option.
- **FR-002:** Each option has a stable ID, a title, a status (`viable`, `conditional` or `not_suitable`, shown as Good fit, Depends, Not a fit), a one-sentence reason, a kind, and a difficulty (`diy_easy`, `diy_moderate` or `professional`). An option that is not a fit has a reason and no figures and no score.
- **FR-003:** The kind is one of a fixed list that the impact table can price (`ssd`, `ram`, `battery`, `hand_down`, `salvage`, `recycle`) or `other`. For a priced kind, the server computes the option's cost, extra-life and CO₂e ranges with the existing calculator against the existing baseline, and the figures trace back to impact table entries.
- **FR-004:** For an option of kind `other`, the AI supplies the cost, extra-life and CO₂e ranges. The server accepts them only if each has `low <= high` and no negative cost or life; otherwise the option keeps no figures and no score. These figures are marked as AI estimates in the payload.
- **FR-005:** Each option that is a fit or depends gets the four criterion scores of feature 003. Environment, useful life and economic come from the existing rubrics applied to the option's figures. Feasibility comes from the difficulty: `diy_easy`, `diy_moderate` and `professional` map to fixed values recorded in the rubric documentation. An option with AI-estimated figures has at most medium confidence, with a reason naming the estimate.
- **FR-006:** A category's status is the best status among its options, and its score in the current mode is the highest total score among its options of that status. The Overview lists categories with a Good fit option by score, then categories whose best option depends, by score, then categories with no fitting option, without a score.
- **FR-007:** The first category on the Overview carries the label **Recommended** when it has a Good fit option. When no category has one, nothing is labelled Recommended and the Overview says that no option is clearly recommended.
- **FR-008:** Switching between Environment first and Money first re-ranks the categories and the options inside each category in the browser, without a page reload or a new AI call.
- **FR-009:** The toolbar shows Overview followed by one tab per category, labelled with the AI's label, in the Overview's current order. Selecting a category tab shows a non-clickable category header (label, status, summary, best option's figures and score) followed by one card per option, sorted Good fit, Depends, Not a fit and by score within each.
- **FR-010:** An option card shows its title, status, reason, cost range, extra-life range, CO₂e range and score where they exist. Figures that are AI estimates carry a visible "AI estimate" label on the card and on the gauge. Opening the card shows the option's "Why" text with at most two cited sources; the step plan area is owned by feature 009.
- **FR-011:** The gauge follows the option the user last opened. Before any option is opened, it shows the best option of the first category on the Overview.
- **FR-012:** The category call receives the scan fields, intended use, the five-path assessment of feature 003 (statuses, reasons, scores and figures), the extracted facts, and the retrieved passages. Its prompt states the safety rules: no hazardous self-repair, refer repairs to a service provider unless the manual explicitly authorizes the owner, never assume that a part fits, and no option that a verified fact contradicts. The server checks only the payload shape (FR-001 to FR-004), removes cited passage IDs that were not supplied, and rejects text that contains a numeric euro or CO₂e figure, as in feature 004 FR-005.
- **FR-013:** When the category call cannot be made or fails (no API key, provider error, timeout, invalid answer after repair, or daily budget used up), the result screen shows the five deterministic paths of feature 003 as five categories, with one option per path, using the assessment's statuses, figures and scores and the template text, plus the notice "AI explanation unavailable".
- **FR-014:** Category results are cached per device and intended use. Reopening the result screen or switching modes does not trigger a new category call. A prompt change invalidates older cached results.
- **FR-015:** In mock mode, the result screen shows fictional sample categories and options for the example laptop, including at least one AI-estimated option and one option that is not a fit.

## Non-functional requirements and constraints

- **Latency:** The Overview's categories should arrive within the category call's deadline (proposed: its own timeout, default 40 s). The five-path assessment is still sent first so the page has content immediately.
- **Honesty:** AI-estimated figures are always distinguishable from calculated ones. CO₂e stays a range against the stated baseline and is never summed across options.
- **Accessibility and motion:** Dynamic tabs keep the keyboard and screen-reader behaviour, the reduced-motion rules, and the thinking line of feature 006.
- **Cost:** The category call counts against the existing daily LLM budget.
- **Privacy:** No new data leaves the server beyond what feature 004 already sends to the provider.

## User journeys and edge cases

- **Happy path (ThinkPad T480, office):** The Overview shows, for example, "Faster storage" (SSD swap, Good fit, calculated figures), "Memory" (add an 8 GB stick, Good fit), "Battery" (service replacement, Depends), and "Hand it down" (donate to PCs für alle). Money first moves "Hand it down" up.
- **Soldered RAM (XPS 13 9360):** The AI should not offer a RAM option, or should mark it Not a fit. Because enforcement is prompt-only, this is checked in the demo review, not guaranteed by the server.
- **Option outside the table (for example "Install Windows 11"):** Its figures carry "AI estimate" and its confidence is at most medium.
- **Invalid AI estimate (low > high):** The option shows no figures and no score; the rest of the category is unaffected.
- **Fewer than 3 or more than 6 categories, or a missing field:** The answer is invalid; the adapter's repair attempt runs, and on failure FR-013 applies.
- **No category has a Good fit option:** No Recommended label, plus the statement of FR-007.
- **AI unavailable:** The five paths appear as categories with the notice (FR-013).

## Proposed technical approach

Adopted during implementation (2026-11-21) unless marked otherwise:

- **Contract:** A new `CategoryResult` in `shared/src/` with `categories[].options[]`, each option carrying `kind`, `difficulty`, `status`, `reason`, `why`, `claims`, `impact` (the existing `Impact` shape or `null`), `impact_source: 'calculator' | 'ai_estimate'`, and criterion scores. It is sent as a new `categories` event on the existing report stream (`/api/devices/:id/report`) after the `assessment` event, replacing the `report` event for the result screen. The web app's proposed `PathOption` type is replaced by the shared contract, which resolves feature 006 T-016.
- **Server:** A new `server/src/categories/` module with the prompt builder, validation, the mapping from kind to calculator inputs (reusing `server/src/assessment/calculator.ts` and `scoring.ts`), the fallback that converts the assessment into five categories, and an additive SQLite table `category_cache` keyed by device, intended use and prompt hash.
- **Ranking:** `shared/src/ranking.ts` gains functions to rank options and categories with the existing weights, so the browser toggle and the server agree.
- **Web:** The toolbar builds its tabs from the categories; the Overview, category tab and option cards reuse the existing path card, summary block and option card components.
- **ADR:** Letting AI output decide which options exist and their status changes the determinism constraint of feature 003. Record an ADR once this is implemented.
- **Settled during implementation (2026-11-21, routine choices within scope):**
  - **Timeout and thinking:** The category call has its own deadline, `LLM_CATEGORY_TIMEOUT_MS` (default 40 s), covering transport retries and the repair attempt. One HTTP attempt may use the whole deadline. Thinking is off by default (`LLM_THINKING_CATEGORIES=disabled`), like the explanation.
  - **Feasibility per difficulty:** `diy_easy` 80, `diy_moderate` 60, `professional` 55, minus the existing conditional penalty of 20. Recorded in the [feature 003 rubric documentation](../feature-003-five-path-ranking/DESIGN.md#scoring-rubrics-0100-each).
  - **Tab order:** The tabs follow the Overview's current order, as FR-009 says.
  - **Pricing a priced kind:** The plan for the single part follows the device's own gates: drive interface, RAM module size, and a professional battery job whenever the gate or the AI calls for one. So an AI option never gets cheaper figures than the gates allow.
  - **AI estimate shape:** The AI's CO₂e range is what the option itself causes. The server derives the avoided CO₂e with the calculator's displacement convention: credited when the option adds life; only in the high end when it may add none or the device is passed on. A negative CO₂e is rejected along with FR-004's checks.
  - **Fallback option kinds:** Each fallback option carries its `path`. The kinds are `battery`, `hand_down`, `salvage` and `recycle` for the matching paths, and `other` for upgrade, which may combine an SSD and RAM. Their figures are calculator figures.
  - **Unusable answers:** Repeated IDs get a numbered suffix. On a Mac or Linux device, options whose title or reason is about Windows 11 are dropped. When fewer than three categories remain after the checks, the FR-013 fallback applies, and nothing is cached.
  - **Cache:** `category_cache` stores the AI's checked answer keyed by device and use, plus a hash of the prompt version, system prompt and output schema. Figures and scores are recomputed on every read.
  - **Report event:** The report stream sends `assessment`, `categories` and `end`; it no longer calls the explanation service or sends `report`. Until feature 009 delivers step plans, option cards show no "What to do" steps (FR-010 assigns that area to 009).

## Dependencies and risks

- **Prompt-only safety (accepted risk):** The AI could rank an unsafe or infeasible option highly, for example a RAM upgrade on soldered RAM or owner battery work. This departs from the product principle "infeasible or unsafe paths are never scored attractively". Mitigation is limited to the prompt and the demo review (AC-016).
- **AI-estimated figures:** These weaken the "honest impact" principle; mitigated by the visible label and lowered confidence.
- **Latency and output size:** The category call returns more structure than today's explanation call and may exceed the 25 s default.
- **Product wording:** `docs/PRODUCT.md`, the README and the landing page describe "five next lives"; they need updating when this is implemented.
- **Additive migration:** a new `category_cache` table; existing data is untouched.
- Depends on features 002 (retrieval), 003 (assessment, calculator, rubrics) and 004 (LLM client, citation checks, template fallback).

## Review and integration

Completion boundary: locally verified handoff, with self-review of the final diff against this plan (no independent reviewer required by repository policy). Required checks: `npm run typecheck`, `npm test`, `npm run build`, and the scanner checks if scanner code changes (not expected). The CI workflow runs the same checks on a pull request; opening a PR, pushing, and merging are outside this scope and need the user's request.

## Release and recovery (when applicable)

Not applicable: no deployment exists yet (feature 005 owns it). The `category_cache` table is additive and can be dropped to reset.

## Assumptions and open questions

- The five-path assessment stays computed for every report; it is the AI's context and the fallback.
- The fixed list of priced kinds matches the current impact table (SSD, RAM, battery, hand-down, salvage, recycle). New kinds need new impact entries.
- Open: category call timeout, and whether thinking is enabled (see the proposed approach).
- Open: feasibility values per difficulty, to be recorded in the feature 003 rubric documentation.

## Scope change log

| Date       | Change                 | User approval                                                                                                                                                                                                                       |
| ---------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21 | Initial approved scope | User answered the discovery questions (free categories, calculator + AI estimate, rank the categories, prompt-only safety, categories first and steps on open, tabs with options inside, fallback to five paths) and replied "accept" to the proposal and the three-feature split, 2026-11-21 |
| 2026-11-21 | Renumbered from feature 007 to feature 008 when merging into `main`, because `feature-007-macos-linux-scanner` already held 007 there and the three features shifted together (docs/workflow/ALLOCATION.md, duplicate numbers). Requirement, acceptance and task IDs, scope and history are unchanged. | User asked to merge the branches into `main`, 2026-11-21 |

## Related and superseded features

All replacements below are **planned**; none is effective until this feature is implemented.

- [`feature-003-five-path-ranking`](../feature-003-five-path-ranking/PLAN.md): **FR-012** (ranked view of the five paths) is replaced on the result screen by FR-006 here when categories arrive, and stays in force for the fallback (FR-013). The constraint "Only fact extraction uses the LLM" is replaced for which options exist, their status, and AI-estimated figures. FR-002 to FR-011, FR-013 and FR-014 stay in force: the assessment is still computed, used as AI input and for the fallback, and its rubrics and weights score the options.
- [`feature-004-explained-report`](../feature-004-explained-report/PLAN.md): **FR-001** (five paths in ranked order with the Recommended label) is replaced by FR-006 and FR-007 here when the AI is available. **FR-002** (impact summary for the recommended path) applies to the best option of the recommended category. **FR-009** (template fallback) is extended by FR-013. **FR-010** (caching) is extended by FR-014. FR-004 to FR-006 stay in force for the category call's text and citations.
- [`feature-006-web-app`](../feature-006-web-app/PLAN.md): **FR-005** and **FR-006** (left column lists the five path cards) are replaced by the ranked categories of FR-006 here. **FR-015** (fixed path tags) is replaced by FR-009 here. **FR-017** (option cards per path, proposed payload) is replaced by option cards per category with a shared contract (FR-009, FR-010); this resolves 006 T-016. **FR-039** (mode-change explanation of moved paths) applies to categories. FR-022 (non-clickable summary block) and FR-045 (thinking line) carry over unchanged.
- [`feature-009-concrete-step-plans`](../feature-009-concrete-step-plans/PLAN.md) builds the step plans inside the options of this feature.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: [ADR-002](../../adr/adr-002-llm-openai-compatible-deepseek.md) (LLM provider); a new ADR is expected at implementation (see the proposed approach)
- Related features: [002](../feature-002-knowledge-base-retrieval/PLAN.md), [003](../feature-003-five-path-ranking/PLAN.md), [004](../feature-004-explained-report/PLAN.md), [006](../feature-006-web-app/PLAN.md), [009](../feature-009-concrete-step-plans/PLAN.md), [010](../feature-010-step-level-knowledge-base/PLAN.md)
