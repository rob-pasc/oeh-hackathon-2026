# Feature 004: Explained report

- **Feature ID:** `feature-004-explained-report`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-20

## Summary

The ranked result from feature 003 becomes a readable report. A highlighted recommendation and an impact summary sit above the fold, followed by one expandable card per path: what to do next, why it ranks there, the evidence (clickable sources), the assumptions, and safety and feasibility notes. An LLM writes the plain-language explanations **only from the verified facts, calculator outputs, and retrieved passages**. It cites its sources and says what cannot be verified. When the mode toggle reorders the paths, the report explains which criteria caused the change. If the LLM is unavailable, the report still works with template text.

## Problem and desired outcome

- **Problem:** Scores and statuses alone don't help an owner act or trust the result. Free LLM text risks hallucinated compatibility or carbon claims.
- **Desired outcome:** An owner understands the recommended next step and its trade-offs in under a minute, and can follow every technical claim back to a source.
- **Target users / stakeholders:** Individual device owners; judges checking evidence and honesty.

## Approved scope

### In scope

- A report layout: device summary, recommended path, impact summary, and five ranked cards.
- Expandable card sections: next steps, why it ranks here, evidence, assumptions, safety and feasibility.
- LLM-generated explanations constrained to structured inputs, with claim-level source references and validation.
- "Cannot verify" statements where evidence is missing.
- A deterministic explanation of ranking changes when the mode is switched.
- A template-text fallback when the LLM fails or times out.
- Caching of explanations per device and intended use.

### Out of scope

- Chat or follow-up questions to the AI.
- PDF export or sharing features beyond the existing device link.
- Purchase links or local drop-off locations.
- Translations (the report is in English).
- Changing ranking logic or numbers (owned by feature 003).

## Functional requirements

- **FR-001:** The report shows the five paths in the feature 003 ranked order. The top viable path carries a "Recommended" label. If no path is viable, nothing is labelled Recommended and the report says so.
- **FR-002:** Above the cards, an impact summary shows, for the recommended path, the cost range, the extra-useful-life range, and the CO₂e range together with the baseline statement.
- **FR-003:** Each card shows its status, its score where feature 003 provides one, and a one-sentence reason. When expanded, it shows the sections "What to do next", "Why it ranks here", "Evidence", "Assumptions", and "Safety and feasibility".
- **FR-004:** The LLM receives only the scan fields, intended use, statuses, criterion scores, calculator outputs, extracted facts, and retrieved passages. It returns structured explanation text in which each technical claim references source passage IDs.
- **FR-005:** Explanation claims whose cited passage IDs are not among the provided passages are removed before display. Explanation text containing a numeric CO₂e or euro figure is rejected, so that displayed figures come only from the calculator fields.
- **FR-006:** The "Evidence" section lists each cited passage with its document title, section or page, an excerpt, and a link to the source URL.
- **FR-007:** When a path's status or confidence comes from missing evidence, its card states explicitly what could not be verified.
- **FR-008:** When switching modes changes the order, the report states which paths moved and which weighted criteria caused the move, computed deterministically from the scores and weights, without an LLM call.
- **FR-009:** If the LLM call fails or exceeds a timeout, the report renders the ranking with template-based explanations from the structured data and shows a notice that the AI explanation is unavailable.
- **FR-010:** Explanations are cached per device and intended use. Reopening the report or switching modes does not trigger a new LLM call.

## Non-functional requirements and constraints

- **Honesty:** No technical claim without a citation; no figures invented by the LLM.
- **Accessibility:** Cards can be expanded with the keyboard, statuses are not shown by color alone, and contrast is sufficient.
- **Responsiveness:** The report is readable on a laptop screen and a phone (360 px width).
- **Performance:** The first explanation should be shown within about 20 seconds of choosing a use, with the deterministic ranking visible immediately.
- **Security:** The LLM API key stays on the backend; passages are treated as data, not instructions, in prompts.

## User journeys and edge cases

1. **Recommended upgrade:** The owner sees "Recommended: Upgrade", with the summary "€X–Y, +2–3 years, CO₂e range vs buying new". They expand it: install the SSD in the M.2 slot (service manual §, link), clone the drive, and here are the assumptions.
2. **Soldered RAM:** The upgrade card reads "Not suitable: RAM is soldered (source)". It has no score and is placed at the bottom.
3. **Unknown model:** Cards say "We could not verify whether this model's storage is replaceable", and confidence is low.
4. **Toggle:** Switching to Money first moves "Pass it on" above "Repair", with "Economic value weight 10% → 45%; repair costs €X–Y" displayed.
5. **LLM outage:** The ranking and template explanations appear, with a notice.
6. **No viable path:** For example, everything is conditional or not suitable, and the report says no path is clearly recommended and why.

## Proposed technical approach

Not yet adopted; to be confirmed during implementation.

- **Delivery (adopted 2026-11-20, user decision):** Server-Sent Events. `GET /api/devices/:id/report?intended_use=…` first sends an `assessment` event (so the ranking is visible at once), then a `report` event (from the LLM or the template), then `end`, or `error` instead. Cached results are streamed the same way without delay. Contracts are `Report`, `StreamEnd`, and the routes in [`shared/src/report.ts`](../../../shared/src/report.ts) and [`shared/src/api.ts`](../../../shared/src/api.ts). The "Recommended" label uses `recommendedPath` from `shared/src/ranking.ts`.
- **Backend:** `server/src/report/`. A prompt builder that passes the structured input as data, and a call through the provider-neutral `LlmClient.completeJson` ([ADR-002](../../adr/adr-002-llm-openai-compatible-deepseek.md): DeepSeek `deepseek-flash`, JSON mode, thinking disabled by default for latency), validated against the `Report` contract (`{path, sections: {next_steps, why, assumptions, safety}, claims: [{text, source_passage_ids}]}`). A validator applies FR-005. Cached in SQLite by `(device_id, intended_use)`. Timeout of about 25 s, then the fallback.
- **Template fallback:** Deterministic sentence templates per status and reason type, in the same output shape.
- **Mode-change explanation:** A pure function comparing the two orders and the per-criterion weighted contributions.
- **Web:** Report and card components with expandable sections that build on feature 003's ranked view; source links open in a new tab.
- **Tests:** Validator tests (unknown citation removed, figure rejected), fallback on a mocked timeout, the mode-change explanation function, a web test for the Recommended label and the no-viable case, and an accessibility check of the cards.

## Dependencies and risks

- **Dependency:** Feature 003 (ranking, calculator, facts) and feature 002 (passages and citation metadata).
- **Risk:** Rejecting figures may be too strict, for example for "8 GB" RAM. Mitigation: FR-005 rejects only CO₂e and currency figures; hardware quantities are allowed when cited.
- **Risk:** LLM latency during the demo. Mitigation: caching, plus pre-generated explanations for seeded devices (feature 005).
- **Risk:** Prompt injection from document text. Mitigation: passages are delimited as data, and output validation is applied.

## Review and integration

- **Completion boundary:** Locally verified handoff with self-review.
- **Review:** Self-review of the diff and of a sample of generated reports for the demo models, recorded in `ACCEPTANCE_CRITERIA.md`.
- **CI/merge:** No CI yet. Server and web tests and type checks must pass locally. Pushing and merging need user authorization.

## Release and recovery (when applicable)

Not applicable to this feature: deployment is owned by feature 005.

## Assumptions and open questions

- Assumption: English-only report text.
- **Resolved (2026-11-20, user decision):** `deepseek-flash` via an OpenAI-compatible adapter, with thinking disabled for explanations and a 25 s default timeout (`LLM_TIMEOUT_MS`). Any `LlmError` (timeout, auth, rate limit, invalid output) triggers the FR-009 fallback ([ADR-002](../../adr/adr-002-llm-openai-compatible-deepseek.md)).
- **Open:** Visual style. If shared conventions emerge, record them in `docs/VISUAL_DESIGN.md` during implementation.

## Scope change log

| Date       | Change                 | User approval                                                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Initial approved scope | User replied "accept" to the five-feature MVP proposal in the specification conversation, 2026-11-20 |

## Related and superseded features

None superseded. Builds on [feature 003](../feature-003-five-path-ranking/PLAN.md)'s ranked view (extends it without changing feature 003 requirements) and [feature 002](../feature-002-knowledge-base-retrieval/PLAN.md)'s passages.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: None yet
- Terms: [`docs/GLOSSARY.md`](../../GLOSSARY.md)
