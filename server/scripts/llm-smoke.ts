// Live check of the configured LLM provider: `npm run llm:smoke -w server`.
// Reads server/.env. Sends a tiny non-personal prompt once per thinking setting and prints
// model, attempts, latency, and token usage. Never prints the API key or prompts.
import { Type } from 'typebox'
import { createOpenAiCompatibleClient, LlmError, loadLlmConfig, type LlmTask } from '../src/llm/index.ts'

const Answer = Type.Object(
  {
    status: Type.Literal('ok'),
    paths: Type.Array(Type.Enum(['upgrade', 'repair', 'pass_on', 'salvage', 'recycle']), { minItems: 5, maxItems: 5 }),
  },
  { additionalProperties: false },
)

try {
  const config = loadLlmConfig()
  console.log(`provider ${config.baseUrl}, model ${config.model}, timeout ${config.timeoutMs} ms`)
  const client = createOpenAiCompatibleClient(config)

  for (const task of ['explanation', 'fact_extraction'] as LlmTask[]) {
    const result = await client.completeJson({
      task,
      system: 'You are a connectivity check for a laptop reuse assistant.',
      user: 'Set status to "ok" and list the five next-life paths for an old laptop: upgrade, repair, pass_on, salvage, recycle.',
      schema: Answer,
      maxTokens: 2048,
    })
    console.log(
      `${task} (thinking ${config.thinking[task]}): model ${result.model}, attempts ${result.attempts}, ` +
        `${result.latency_ms} ms, tokens in/out ${result.usage.prompt_tokens}/${result.usage.completion_tokens}`,
    )
  }
  console.log('LLM smoke test passed')
} catch (error) {
  if (error instanceof LlmError) {
    console.error(`LLM smoke test failed: ${error.kind}: ${error.message}`)
    for (const d of error.details) console.error(`  ${d}`)
  } else {
    console.error('LLM smoke test failed:', error)
  }
  process.exitCode = 1
}
