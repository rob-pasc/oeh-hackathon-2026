# Implementation Tasks: Explained report

- **Feature ID:** `feature-004-explained-report`
- **Status:** In progress

This is the **authoritative progress checklist**. Check a task only after its work is actually complete.

## Tasks

- [x] **T-001:** Define the explanation output schema and the prompt builder with passages delimited as data, with a prompt inspection test (supports `AC-004`)
- [x] **T-002:** Implement the LLM call, the citation and figure validator, and caching by device and use, with mocked-LLM tests (supports `AC-005`, `AC-010`)
- [ ] **T-003:** Implement the template fallback and timeout handling, with tests (supports `AC-009`)
- [ ] **T-004:** Implement the deterministic mode-change explanation, with tests (supports `AC-008`)
- [ ] **T-005:** Build the report layout (Recommended label, impact summary, cards with expandable sections, evidence links, "cannot verify" text), with web tests (supports `AC-001`–`AC-003`, `AC-006`, `AC-007`)
- [ ] **T-006:** Check accessibility and responsiveness at 360 px and at laptop width (supports `AC-003`, `AC-011`)
- [ ] **T-007:** Generate and review reports for the demo models, check claims against sources, and record the findings (supports `AC-006`, `AC-012`)
- [ ] **T-008:** Run checks, self-review the diff, and update the README and the feature index (supports `AC-012`)

## Dependencies and blockers

- Requires features 002 and 003.
- T-007 is blocked until the demo models are chosen and their corpus exists.

## Progress notes

- 2026-11-20: The report and SSE event contracts and an example report fixture are in `shared/`. T-001 (output schema) is partly covered; the prompt builder is not built yet.
- 2026-11-20: The report stream route exists (feature 003 T-007): it sends `assessment`, then `end`. T-002 adds the `report` event between them. `AssessmentService.assessDevice` already returns the retrieval result and facts with the assessment, for the prompt builder.
- 2026-11-20: LLM adapter with timeout, typed `LlmError` (for the T-003 fallback), and JSON validation/repair is in `server/src/llm/`. T-002 can build on it.

## Lifecycle history

- 2026-11-20: Started implementation with T-001 after confirming the shared report contract and assessment inputs.
