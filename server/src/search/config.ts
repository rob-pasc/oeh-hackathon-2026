// Web search configuration from environment variables (feature 017). Documented in
// server/.env.example and server/README.md.
import { createLangSearchProvider } from './langsearch.ts'
import { createTinyFishProvider } from './tinyfish.ts'
import { SearchError, type SearchProvider } from './types.ts'

/** Adding a provider: implement SearchProvider and register its factory and key variable here. */
export const PROVIDERS: Record<string, { keyVariable: string; create: (apiKey: string, transport?: typeof fetch) => SearchProvider }> = {
  langsearch: { keyVariable: 'LANGSEARCH_API_KEY', create: createLangSearchProvider },
  tinyfish: { keyVariable: 'TINYFISH_API_KEY', create: createTinyFishProvider },
}

export interface SearchConfig {
  /** Providers in the order they are asked: primary first, then the fallback. Only those with a key. */
  providers: { name: string; apiKey: string }[]
  /** Fresh searches per UTC day across all providers (FR-009); 0 stops all searches. */
  dailyCalls: number
  /** Deadline for the whole web search phase of one assessment (FR-010). */
  timeoutMs: number
  /** Results asked for per query. */
  resultsPerQuery: number
  /** Page text characters asked for per result. */
  maxChars: number
}

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number): number {
  const raw = env[name]?.trim() || String(fallback)
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min) throw new SearchError('config', `${name} must be an integer of at least ${min} (got "${raw}")`)
  return value
}

function providerName(env: NodeJS.ProcessEnv, name: string, fallback: string): string | null {
  const raw = (env[name] ?? fallback).trim().toLowerCase()
  if (raw === '' || raw === 'none') return null
  if (!(raw in PROVIDERS)) throw new SearchError('config', `${name} must be one of ${Object.keys(PROVIDERS).join(', ')} or none (got "${raw}")`)
  return raw
}

/**
 * Reads the search config. Returns null when no configured provider has a key: web search is then
 * off and assessments behave as before feature 017 (FR-011). Invalid values throw `SearchError`.
 */
export function loadSearchConfig(env: NodeJS.ProcessEnv = process.env): SearchConfig | null {
  const order = [providerName(env, 'SEARCH_PROVIDER', 'langsearch'), providerName(env, 'SEARCH_FALLBACK', 'tinyfish')]
  const names = [...new Set(order.filter((n): n is string => n !== null))]
  const providers = names.flatMap((name) => {
    const apiKey = env[PROVIDERS[name]!.keyVariable]?.trim() ?? ''
    return apiKey ? [{ name, apiKey }] : []
  })
  const config = {
    providers,
    dailyCalls: integer(env, 'SEARCH_DAILY_CALLS', 200, 0),
    timeoutMs: integer(env, 'SEARCH_TIMEOUT_MS', 20000, 1),
    resultsPerQuery: integer(env, 'SEARCH_RESULTS_PER_QUERY', 5, 1),
    maxChars: integer(env, 'SEARCH_MAX_CHARS', 6000, 500),
  }
  return providers.length > 0 ? config : null
}

export interface ChainOptions {
  /** Share of the caller's deadline the first provider may use before the next one is asked. */
  primaryTimeoutMs: number
  /** Receives provider failures (provider name and error kind only). */
  warn?: (message: string, details?: Record<string, unknown>) => void
}

/**
 * Asks providers in order (FR-002): the next one is asked when the previous one throws, runs out
 * of its share of time, or returns no hit the query accepts. Throws the last error when every
 * provider failed; returns [] when they answered without a usable hit.
 */
export function providerChain(providers: readonly SearchProvider[], options: ChainOptions): SearchProvider {
  return {
    name: providers.map((p) => p.name).join('+'),
    async search(query, signal) {
      let lastError: SearchError | null = null
      let answered = false
      for (const [index, provider] of providers.entries()) {
        if (signal?.aborted) break
        const isLast = index === providers.length - 1
        const own = isLast ? signal : AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(options.primaryTimeoutMs)])
        try {
          const hits = await provider.search(query, own)
          answered = true
          const usable = query.accept ? hits.filter(query.accept) : hits
          if (usable.length > 0) return usable
        } catch (error) {
          lastError = error instanceof SearchError ? error : new SearchError('unavailable', `${provider.name} failed`, { cause: error })
          options.warn?.('web search provider failed', { provider: provider.name, kind: lastError.kind })
        }
      }
      if (!answered && lastError) throw lastError
      return []
    },
  }
}

/** The configured providers in order, without the chain (feature 019 asks them one by one). */
export function createProviders(config: SearchConfig, transport?: typeof fetch): SearchProvider[] {
  return config.providers.map(({ name, apiKey }) => PROVIDERS[name]!.create(apiKey, transport))
}

/** The configured provider chain; `transport` is injected in tests. */
export function createConfiguredSearch(config: SearchConfig, options: Omit<ChainOptions, 'primaryTimeoutMs'> & { transport?: typeof fetch } = {}): SearchProvider {
  const providers = createProviders(config, options.transport)
  // The primary gets half of the deadline, so a hanging primary still leaves time for the fallback.
  return providerChain(providers, { primaryTimeoutMs: Math.max(1, Math.floor(config.timeoutMs / 2)), ...(options.warn ? { warn: options.warn } : {}) })
}
