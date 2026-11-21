# ADR-003: The AI chooses which options exist; the server prices and ranks them

- **Status:** Accepted
- **Date adopted:** 2026-11-21
- **Related feature(s):** [feature 008](../features/feature-008-ai-categories-and-options/PLAN.md); changes a constraint of [feature 003](../features/feature-003-five-path-ranking/PLAN.md)
- **Supersedes:** None. Extends [ADR-002](adr-002-llm-openai-compatible-deepseek.md) with a third LLM task.

## Context

Feature 003 kept the LLM out of every decision: only fact extraction used it, and fixed gates decided which of the five paths were feasible. The result read like a generic menu. Irrelevant paths always appeared, and the real choices (which part, which offer) were hidden inside a path. Feature 008 asks for device-specific categories with concrete options, which no fixed rule set can enumerate. Showing them still requires honest figures and a ranking the browser can recompute when the owner switches between Environment first and Money first.

## Decision

- **The AI decides:** One LLM call per device and intended use (task `categories`) chooses 3 to 6 categories and their options. For each option it decides the status, reason, kind and difficulty. The safety and feasibility rules are given in the prompt only (user decision, 2026-11-21). The server does not re-check options against the feature 003 gates.
- **The server decides:**
  - **Figures:** Options of a priced kind (`ssd`, `ram`, `battery`, `hand_down`, `salvage`, `recycle`) are priced by the feature 003 calculator, with part details taken from the device's own gates. Options of kind `other` keep AI-supplied ranges only after range checks, are marked `ai_estimate`, and have at most medium confidence.
  - **Scores:** Criterion scores come from the feature 003 rubrics plus a fixed feasibility value per difficulty.
  - **Text checks:** Unknown citations are removed, and text with euro or CO₂e figures is replaced, as in feature 004.
  - **Ranking:** Options and categories are ranked by shared, deterministic functions (`rankOptions`, `rankCategories`), so totals and order are never taken from the AI.
- **The fallback:** When the call fails, or its answer is unusable after the checks, the five deterministic paths are shown as five categories. The demo never depends on the AI.

## Alternatives considered

| Alternative | Benefits | Why not chosen |
| ----------- | -------- | -------------- |
| Keep five fixed paths and let the AI only explain them (feature 004 as built) | Fully deterministic statuses | Generic and hides the concrete choices; the problem feature 008 addresses |
| AI chooses options, and the server also enforces the gates (validate each option against facts) | Stronger safety guarantee | Offered to the user and declined for this feature; prompt-only safety was chosen and is checked in the demo review |
| AI supplies all figures and scores | Simplest | Breaks the "honest impact" principle; figures could not be traced to sources and the mode toggle would not be reproducible |

## Consequences

- **Safety:** It now rests on the prompt for options that the gates would have ruled out. This is an accepted risk (feature 008 plan), checked by the live demo review (feature 008 AC-016). The 2026-11-21 review found no owner battery work and no fitting RAM option on soldered memory, on synthetic scans of the three demo models.
- **Determinism:** Statuses can vary between AI answers. Caching per device and use keeps one owner's view stable, and a prompt change invalidates cached answers.
- **Honesty:** AI-estimated figures appear beside calculated ones and are always labelled.
- **Cost and latency:** One more LLM call per device and use (about 10 s observed), counted against the daily budget.
- **Follow-up:** A server-side gate check remains possible later without changing the contract.

## Implementation / validation references

- Contract: `shared/src/categories.ts`, `checkCategoryResult` in `shared/src/invariants.ts`, ranking in `shared/src/ranking.ts`
- Server: `server/src/categories/` (prompt, option pricing and scoring, fallback, cached service), route in `server/src/app.ts`
- Tests: `server/test/categories.test.ts`, `shared/test/ranking.test.ts`, `shared/test/contracts.test.ts`, `web/src/test/app.test.tsx`
- Live review: `npm run categories:smoke -w server`, results in the [feature 008 acceptance criteria](../features/feature-008-ai-categories-and-options/ACCEPTANCE_CRITERIA.md)

## Supersession notes (if applicable)

None.
