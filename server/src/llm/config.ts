// LLM configuration from environment variables. Documented in server/.env.example.
import { LlmError, type LlmTask, type ThinkingMode } from './types.ts'

export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
  thinking: Record<LlmTask, ThinkingMode>
}

const THINKING_MODES: readonly ThinkingMode[] = ['enabled', 'disabled', 'omit']

function thinkingMode(env: NodeJS.ProcessEnv, name: string, fallback: ThinkingMode): ThinkingMode {
  const raw = env[name]?.trim()
  if (!raw) return fallback
  if ((THINKING_MODES as readonly string[]).includes(raw)) return raw as ThinkingMode
  throw new LlmError('config', `${name} must be one of ${THINKING_MODES.join(', ')} (got "${raw}")`)
}

/**
 * Reads the LLM config. Defaults target DeepSeek's official API with `deepseek-flash`.
 * Thinking is off for both tasks: on for fact extraction, a cold assessment took 26 s against
 * feature 003's 20 s target (user decision 2026-11-20; see ADR-002). Set it per task to override.
 */
export function loadLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const apiKey = env.LLM_API_KEY?.trim() ?? ''
  if (!apiKey) throw new LlmError('config', 'LLM_API_KEY is not set (see server/.env.example)')

  const baseUrl = env.LLM_BASE_URL?.trim() || 'https://api.deepseek.com'
  try {
    new URL(baseUrl)
  } catch {
    throw new LlmError('config', `LLM_BASE_URL is not a valid URL (got "${baseUrl}")`)
  }

  const timeoutRaw = env.LLM_TIMEOUT_MS?.trim() || '25000'
  const timeoutMs = Number(timeoutRaw)
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0)
    throw new LlmError('config', `LLM_TIMEOUT_MS must be a positive integer (got "${timeoutRaw}")`)

  return {
    baseUrl,
    apiKey,
    model: env.LLM_MODEL?.trim() || 'deepseek-flash',
    timeoutMs,
    thinking: {
      fact_extraction: thinkingMode(env, 'LLM_THINKING_FACT_EXTRACTION', 'disabled'),
      explanation: thinkingMode(env, 'LLM_THINKING_EXPLANATION', 'disabled'),
    },
  }
}
