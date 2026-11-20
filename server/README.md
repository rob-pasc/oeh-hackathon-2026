# server

The TypeScript/Node backend. Node 24 runs the `.ts` sources directly; there is no build step. It currently contains only the **LLM adapter** (`src/llm/`). The upload API (feature 001), retrieval (002), assessment (003), and reports (004) come next.

The LLM API key is configured only here, through environment variables. It never ships in the scanner or the web app.

## LLM adapter

Feature code calls the provider-neutral `LlmClient.completeJson({ task, system, user, schema })`. It returns a value validated against the given TypeBox schema, or throws `LlmError` with a `kind`. The current provider is DeepSeek `deepseek-flash`, reached through an OpenAI-compatible adapter ([ADR-002](../docs/adr/adr-002-llm-openai-compatible-deepseek.md)).

```ts
import { createOpenAiCompatibleClient, loadLlmConfig, LlmError } from './src/llm/index.ts'

const llm = createOpenAiCompatibleClient(loadLlmConfig())
try {
  const { value } = await llm.completeJson({ task: 'fact_extraction', system, user, schema: FactSet })
} catch (e) {
  if (e instanceof LlmError) {
    // e.kind: config | auth | rate_limited | timeout | unavailable | bad_request | invalid_output
  }
}
```

Rules for callers:
- Put document passages in `user`, clearly delimited as data.
- Never put device IDs or personal data into prompts.

## Configuration

```sh
cp server/.env.example server/.env   # gitignored; then set LLM_API_KEY
```

| Variable | Default | Meaning |
|---|---|---|
| `LLM_API_KEY` | (required) | Provider API key |
| `LLM_BASE_URL` | `https://api.deepseek.com` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `deepseek-flash` | Model name |
| `LLM_TIMEOUT_MS` | `25000` | Per-request timeout |
| `LLM_THINKING_FACT_EXTRACTION` | `enabled` | `enabled`, `disabled`, or `omit` (don't send the parameter) |
| `LLM_THINKING_EXPLANATION` | `disabled` | As above |

## Commands

```sh
npm test -w server        # unit tests against a fake provider (no network, no key)
npm run typecheck -w server
npm run llm:smoke -w server   # live call to the configured provider; needs server/.env
```

The smoke test sends one tiny non-personal prompt per thinking setting. It prints the model, attempts, latency, and token usage, and never the key or the prompt.

### Smoke test results

| Date | Provider / model | Thinking | Result |
|---|---|---|---|
| 2026-11-20 | `https://api.deepseek.com` / `deepseek-flash` | disabled (explanation) | Pass: 1 attempt, 1717 ms, 156/25 tokens in/out |
| 2026-11-20 | `https://api.deepseek.com` / `deepseek-flash` | enabled (fact extraction) | Pass: 1 attempt, 1298 ms, 181/78 tokens in/out |

This confirms that DeepSeek accepts `thinking: { type: "disabled" }`, which its docs did not show explicitly.
