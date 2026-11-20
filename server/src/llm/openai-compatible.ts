// LlmClient for OpenAI-compatible chat completion APIs, configured for DeepSeek by default.
//
// DeepSeek specifics (api-docs.deepseek.com, checked 2026-11-20):
// - JSON mode is `response_format: { type: "json_object" }` only, with no schema enforcement. The
//   prompt must mention "json" and should show the expected shape, so the output schema is
//   appended to the system prompt, and every answer is validated here.
// - In JSON mode the content may come back empty or whitespace-only; that triggers the repair attempt.
// - Thinking mode is a non-standard `thinking: { type }` body field; `omit` leaves it out.
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import type { Static, TSchema } from 'typebox'
import { createValidator } from '@leaaf/shared'
import type { LlmConfig } from './config.ts'
import { LlmError, type JsonRequest, type JsonResponse, type LlmClient, type LlmUsage } from './types.ts'

const DEFAULT_MAX_TOKENS = 4096

export interface OpenAiCompatibleOptions {
  /** Injected in tests to simulate the provider. */
  fetch?: typeof fetch
  /** Transport-level retries by the SDK (connection errors, 429, 5xx). */
  maxRetries?: number
}

export function systemPromptWithSchema(system: string, schema: TSchema): string {
  return [
    system.trim(),
    '',
    'Respond with a single json object and nothing else. It must validate against this JSON Schema:',
    JSON.stringify(schema),
  ].join('\n')
}

/** Accepts plain JSON, tolerating a Markdown code fence some models add despite JSON mode. */
function parseJson(content: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = content.trim()
  if (!trimmed) return { ok: false, error: 'empty response' }
  const unfenced = trimmed.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1')
  try {
    return { ok: true, value: JSON.parse(unfenced) }
  } catch (e) {
    return { ok: false, error: `not valid JSON: ${(e as Error).message}` }
  }
}

function toLlmError(error: unknown): LlmError {
  if (error instanceof LlmError) return error
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new LlmError('timeout', 'LLM request timed out', [], { cause: error })
  if (error instanceof OpenAI.APIConnectionError) return new LlmError('unavailable', 'LLM provider unreachable', [], { cause: error })
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError)
    return new LlmError('auth', `LLM provider rejected the credentials (HTTP ${error.status})`, [], { cause: error })
  if (error instanceof OpenAI.RateLimitError) return new LlmError('rate_limited', 'LLM provider rate limit reached', [], { cause: error })
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0
    return status >= 500 || status === 0
      ? new LlmError('unavailable', `LLM provider error (HTTP ${status})`, [], { cause: error })
      : new LlmError('bad_request', `LLM provider rejected the request (HTTP ${status})`, [], { cause: error })
  }
  return new LlmError('unavailable', 'Unexpected LLM client error', [], { cause: error })
}

export function createOpenAiCompatibleClient(config: LlmConfig, options: OpenAiCompatibleOptions = {}): LlmClient {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: config.timeoutMs,
    maxRetries: options.maxRetries ?? 1,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  })

  async function call(task: JsonRequest<TSchema>['task'], messages: ChatCompletionMessageParam[], maxTokens: number, signal?: AbortSignal) {
    const thinking = config.thinking[task]
    const response = await client.chat.completions.create({
      model: config.model,
      messages,
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      stream: false,
      // Non-standard DeepSeek parameter; the SDK forwards unknown body fields as-is.
      ...(thinking === 'omit' ? {} : ({ thinking: { type: thinking } } as object)),
    }, signal ? { signal } : {})
    const choice = response.choices[0]
    return {
      content: choice?.message.content ?? '',
      finishReason: choice?.finish_reason ?? null,
      model: response.model,
      usage: {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
      },
    }
  }

  return {
    async completeJson<S extends TSchema>(request: JsonRequest<S>): Promise<JsonResponse<Static<S>>> {
      const validate = createValidator(request.schema)
      const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPromptWithSchema(request.system, request.schema) },
        { role: 'user', content: request.user },
      ]
      const usage: LlmUsage = { prompt_tokens: 0, completion_tokens: 0 }
      const started = performance.now()
      let problems: string[] = []

      const deadline = request.task === 'explanation' ? AbortSignal.timeout(config.timeoutMs) : undefined
      // Attempt 1, then at most one repair attempt that shows the model what was wrong.
      for (let attempt = 1; attempt <= 2; attempt++) {
        let result: Awaited<ReturnType<typeof call>>
        try {
          result = await call(request.task, messages, maxTokens, deadline)
        } catch (error) {
          if (deadline?.aborted) throw new LlmError('timeout', 'Explanation deadline exceeded')
          throw toLlmError(error)
        }
        usage.prompt_tokens += result.usage.prompt_tokens
        usage.completion_tokens += result.usage.completion_tokens

        const parsed = parseJson(result.content)
        if (parsed.ok) {
          const checked = validate(parsed.value)
          if (checked.ok)
            return {
              value: checked.value,
              model: result.model,
              attempts: attempt,
              latency_ms: Math.round(performance.now() - started),
              usage,
            }
          problems = checked.errors.map((e) => `${e.path || '/'}: ${e.message}`)
        } else {
          problems = [result.finishReason === 'length' ? `${parsed.error} (output truncated at max_tokens)` : parsed.error]
        }

        messages.push(
          { role: 'assistant', content: result.content || '(empty)' },
          {
            role: 'user',
            content: `Your previous answer was rejected:\n- ${problems.slice(0, 20).join('\n- ')}\nReply again with only the corrected json object.`,
          },
        )
      }
      throw new LlmError('invalid_output', 'LLM answer did not match the expected schema after one repair attempt', problems)
    },
  }
}
