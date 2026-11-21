// Provider-neutral LLM interface used by fact extraction (feature 003), report explanations
// (feature 004), the category call (feature 008) and the step call (feature 009). Callers never see provider details; see ADR-002.
import type { Static, TSchema } from 'typebox'

/** Each task has its own model settings (e.g. thinking mode). */
export type LlmTask = 'fact_extraction' | 'explanation' | 'categories' | 'steps'

/** enabled/disabled send DeepSeek's `thinking` parameter; omit sends nothing (other providers). */
export type ThinkingMode = 'enabled' | 'disabled' | 'omit'

export interface JsonRequest<S extends TSchema> {
  task: LlmTask
  /** Instructions. The adapter appends the output schema and a JSON-only instruction. */
  system: string
  /** Task input. Put untrusted text (document passages) here, clearly delimited as data. */
  user: string
  /** The answer must validate against this schema; otherwise it is repaired once, then rejected. */
  schema: S
  maxTokens?: number
}

export interface LlmUsage {
  prompt_tokens: number
  completion_tokens: number
}

export interface JsonResponse<T> {
  value: T
  model: string
  /** 1 when the first answer was valid, 2 when a repair attempt was needed. */
  attempts: number
  latency_ms: number
  usage: LlmUsage
}

export interface LlmClient {
  completeJson<S extends TSchema>(request: JsonRequest<S>): Promise<JsonResponse<Static<S>>>
}

export type LlmErrorKind =
  | 'config' // missing or invalid configuration (e.g. no API key)
  | 'auth' // the provider rejected the credentials
  | 'rate_limited'
  | 'timeout'
  | 'unavailable' // network errors and 5xx
  | 'bad_request' // the provider rejected the request (4xx other than auth/rate limit)
  | 'invalid_output' // the answer was empty, not JSON, or failed schema validation after repair

/**
 * The only error type the LLM layer throws. Feature 004 catches it to switch to the
 * template fallback. `message` never contains the API key or prompt content.
 */
export class LlmError extends Error {
  readonly kind: LlmErrorKind
  /** Validation details for invalid_output, for logs and tests. */
  readonly details: readonly string[]

  constructor(kind: LlmErrorKind, message: string, details: readonly string[] = [], options?: ErrorOptions) {
    super(message, options)
    this.name = 'LlmError'
    this.kind = kind
    this.details = details
  }
}
