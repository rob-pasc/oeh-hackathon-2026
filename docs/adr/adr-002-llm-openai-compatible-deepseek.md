# ADR-002: Reach the LLM through an OpenAI-compatible adapter, starting with DeepSeek

- **Status:** Accepted
- **Date adopted:** 2026-11-20
- **Related feature(s):** [003](../features/feature-003-five-path-ranking/PLAN.md) (fact extraction), [004](../features/feature-004-explained-report/PLAN.md) (explanations), [005](../features/feature-005-public-demo-deployment/PLAN.md) (secrets, LLM cap), [008](../features/feature-008-ai-categories-and-options/PLAN.md) (category call)
- **Supersedes:** None

## Context

Features 003 and 004 need an LLM that returns JSON, for extracted facts and for report text. The plans proposed Claude but left the provider open. The team wants a cheap, fast model for the hackathon and the freedom to switch providers without touching feature code.

## Decision

- The server talks to LLMs only through the provider-neutral interface `LlmClient.completeJson({ task, system, user, schema })` in `server/src/llm/`. It returns a value validated against a TypeBox schema, or throws `LlmError` with a `kind` (`config`, `auth`, `rate_limited`, `timeout`, `unavailable`, `bad_request`, `invalid_output`).
- The implementation is an **OpenAI-compatible adapter** built on the official `openai` npm SDK, with a configurable base URL.
- The initial provider is **DeepSeek's official API** (`https://api.deepseek.com`) with model **`deepseek-flash`**, which is served by DeepSeek-V4.1-Flash-1017 according to DeepSeek's docs, checked 2026-11-20.
- DeepSeek offers JSON mode (`json_object`) but no schema enforcement. The adapter therefore:
  - adds the output JSON Schema and a JSON-only instruction to the system prompt;
  - validates every answer;
  - retries once with the validation errors (also on empty content, which DeepSeek documents);
  - then throws `invalid_output`.
- Thinking mode is set per task through the non-standard `thinking` body field: `enabled` for fact extraction, `disabled` for explanations, or `omit` for providers without it.
  - **Update 2026-11-21 (feature 008):** A third task, `categories`, uses the same interface. It has its own setting `LLM_THINKING_CATEGORIES` (default `disabled`) and its own deadline `LLM_CATEGORY_TIMEOUT_MS` (default 40 s), because its answer is larger than the explanation's; the explanation keeps `LLM_TIMEOUT_MS`. The live run took about 10–11 s per device. What the category call decides is recorded in [ADR-003](adr-003-ai-chosen-options.md).
  - **Update 2026-11-20 (user decision):** the fact extraction default is now `disabled` too. With thinking on, the first assessment of a ThinkPad T480 took 26.4 s against feature 003's 20 s target; with it off, 1.8 s, with the same eight extracted facts. The per-task setting and the rest of this decision are unchanged.
- Configuration comes only from environment variables (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT_MS`, `LLM_THINKING_*`); see `server/.env.example`. The key is never logged, committed, or shipped in the scanner or web app.

## Alternatives considered

| Alternative | Benefits | Why not chosen |
| ----------- | -------- | -------------- |
| Anthropic API (Claude), as proposed in the plans | Strong instruction following and structured output | The team chose DeepSeek for now |
| Plain `fetch` client | No dependency | Retries, timeouts, and error types would need to be reimplemented |
| Provider-specific SDK calls in feature code | Simplest at first | Switching providers would touch features 003 and 004 |

## Consequences

- Switching to another OpenAI-compatible provider is a configuration change (base URL, model, `LLM_THINKING_*=omit`). A non-compatible provider needs a second `LlmClient` implementation, with no change to callers.
- Output quality is guarded only by validation and repair. Schema-invalid answers cost a second call, and persistent failures fall back to templates in feature 004.
- **Data:** prompts contain hardware specs and excerpts of public documents only, with no device IDs or personal data. DeepSeek's pricing page does not state where requests are processed; the team should review DeepSeek's terms and privacy policy before the public deployment (feature 005).
- DeepSeek-specific facts (model names, the thinking parameter, peak/off-peak pricing) may change. Recheck them against the [official docs](https://api-docs.deepseek.com/) when the smoke test fails.

## Implementation / validation references

- `server/src/llm/` (types, config, adapter) and `server/test/llm.test.ts` (23 tests against a fake OpenAI-compatible provider, 2026-11-20)
- Live check `npm run llm:smoke -w server` passed on 2026-11-20 for both thinking settings, confirming that `thinking: { type: "disabled" }` is accepted (results in `server/README.md`)
- Sources: [DeepSeek API docs](https://api-docs.deepseek.com/), [JSON output guide](https://api-docs.deepseek.com/guides/json_mode), [Models & pricing](https://api-docs.deepseek.com/quick_start/pricing), [Change log](https://api-docs.deepseek.com/updates/)

## Supersession notes (if applicable)

None.
