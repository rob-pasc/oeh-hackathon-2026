// Provider-by-provider lookups for web prices and local offers (feature 019). Unlike feature 017's
// chain, which moves on only when a provider returns nothing usable, these ask the next provider
// when the result after extraction and the server checks is not good enough: the providers differ a
// lot in how much page text they return for shop and listing pages.
import { LlmError, type LlmClient } from '../llm/types.ts'
import type { SearchBudget } from './cache.ts'
import { SearchError, type SearchHit, type SearchProvider, type SearchQuery } from './types.ts'

export interface WebLookup {
  /** The configured providers in order (search/config.ts createProviders). */
  providers: readonly SearchProvider[]
  /** Feature 017's daily cap; each provider call reserves one search. */
  budget: SearchBudget
  llm: LlmClient
  /** Deadline for one provider's search. */
  timeoutMs: number
  resultsPerQuery: number
  maxChars: number
  /** Receives failures (provider name and error kind only), never page text. */
  warn?: (message: string, details?: Record<string, unknown>) => void
}

export interface LookupStep<T> {
  /** maxResults defaults to the configured results per query. */
  query: Omit<SearchQuery, 'maxResults' | 'maxChars'> & { maxResults?: number }
  /** Hits worth reading; the rest never reach the LLM. */
  keep: (hit: SearchHit) => boolean
  /** The LLM call and the server checks on its answer. */
  extract: (hits: SearchHit[]) => Promise<T[]>
  /** Enough to stop asking further providers. */
  enough: (found: T[]) => boolean
  /** Names the lookup in warnings, e.g. "web price". */
  label: string
}

/**
 * Asks each provider in turn until one gives enough checked results. Returns the best result found
 * (possibly empty), or null when no provider could be asked or every call failed, so the caller
 * does not cache a failure.
 */
export async function lookUp<T>(web: WebLookup, step: LookupStep<T>): Promise<T[] | null> {
  let best: T[] | null = null
  for (const provider of web.providers) {
    if (!web.budget.reserve()) {
      web.warn?.(`daily web search limit reached; ${step.label} lookup stopped`)
      break
    }
    let hits: SearchHit[]
    try {
      hits = (await provider.search({ maxResults: web.resultsPerQuery, ...step.query, maxChars: web.maxChars }, AbortSignal.timeout(web.timeoutMs))).filter(step.keep)
    } catch (error) {
      if (!(error instanceof SearchError)) throw error
      web.warn?.(`${step.label} search failed`, { provider: provider.name, kind: error.kind })
      continue
    }
    let found: T[] = []
    if (hits.length > 0) {
      try {
        found = await step.extract(hits)
      } catch (error) {
        if (!(error instanceof LlmError)) throw error
        web.warn?.(`${step.label} extraction failed`, { provider: provider.name, kind: error.kind })
        continue
      }
    }
    if (!best || found.length > best.length) best = found
    if (step.enough(found)) break
  }
  return best
}
