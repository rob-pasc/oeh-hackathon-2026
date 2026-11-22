// Web prices for the SSD, RAM and battery options of a result (feature 019 FR-001 to FR-004).
//
// Prices are read for the options the result screen already shows and are returned on their own
// route: they never enter the category result, so scores, ranking, gauge and plan totals cannot
// change (FR-002). Searches share feature 017's daily cap.
import { MIN_WEB_PRICE_OFFERS, type CategoryResult, type DeviceRecord, type DeviceScan, type IntendedUse, type WebPrice, type WebPriceList } from '@leaaf/shared'
import type { DeviceAssessment, AssessmentService } from '../assessment/service.ts'
import { optionContext } from '../categories/service.ts'
import type { ImpactTable } from '../impact/table.ts'
import { LlmError, type LlmClient } from '../llm/types.ts'
import type { SearchBudget } from '../search/cache.ts'
import { SearchError, type SearchHit, type SearchProvider } from '../search/types.ts'
import type { CachedPrice, PriceCache } from './cache.ts'
import { checkOffers, PRICE_SYSTEM, PriceAnswer, priceUserPrompt, PROMPT_VERSION } from './extract.ts'
import { partFor, type PricePart } from './part.ts'
import { onDomains } from './sources.ts'

export interface PriceServiceDeps {
  search: SearchProvider
  budget: SearchBudget
  llm: LlmClient
  cache: PriceCache
  /** The allowlist (config/price-sources.yaml). */
  domains: readonly string[]
  assessments: AssessmentService
  /** The categories the result screen shows, without a category call (categories/service.ts). */
  shownCategories: (scan: DeviceScan, input: DeviceAssessment) => CategoryResult
  impactTable: ImpactTable
  /** Deadline for one part's search. */
  timeoutMs: number
  resultsPerQuery: number
  maxChars: number
  /** Receives failures (error kinds only), never device IDs or page text. */
  warn?: (message: string, details?: Record<string, unknown>) => void
}

export type PriceService = (record: DeviceRecord, use: IntendedUse) => Promise<WebPriceList>

export function createPriceService(deps: PriceServiceDeps): PriceService {
  // Concurrent result pages for the same part share one search and one LLM call.
  const inFlight = new Map<string, Promise<CachedPrice | null>>()
  // The allowlist is part of the key, so a changed list is searched again at once.
  const keyOf = (part: PricePart) => `${PROMPT_VERSION}\u001f${deps.domains.join(',')}\u001f${part.label}`.toLowerCase()

  async function lookup(part: PricePart): Promise<CachedPrice | null> {
    if (!deps.budget.reserve()) {
      deps.warn?.('daily web search limit reached; showing no web price')
      return null
    }
    let hits: SearchHit[]
    try {
      const accept = (h: SearchHit) => onDomains(h.url, deps.domains) && (part.accept?.(h) ?? true)
      const found = await deps.search.search(
        { text: part.label, maxResults: deps.resultsPerQuery, maxChars: deps.maxChars, includeDomains: deps.domains, accept },
        AbortSignal.timeout(deps.timeoutMs),
      )
      hits = found.filter(accept)
    } catch (error) {
      if (!(error instanceof SearchError)) throw error
      // Failures are not cached; the next result page tries again.
      deps.warn?.('web price search failed', { kind: error.kind })
      return null
    }
    if (hits.length === 0) return deps.cache.set(keyOf(part), [])
    try {
      const answer = await deps.llm.completeJson({ task: 'web_extraction', system: PRICE_SYSTEM, user: priceUserPrompt(part, hits), schema: PriceAnswer })
      return deps.cache.set(keyOf(part), checkOffers(answer.value, hits, part, deps.domains))
    } catch (error) {
      if (!(error instanceof LlmError)) throw error
      deps.warn?.('web price extraction failed', { kind: error.kind })
      return null
    }
  }

  function partPrice(part: PricePart): Promise<CachedPrice | null> {
    const key = keyOf(part)
    const cached = deps.cache.get(key)
    if (cached) return Promise.resolve(cached)
    const pending = inFlight.get(key)
    if (pending) return pending
    const run = lookup(part).finally(() => inFlight.delete(key))
    inFlight.set(key, run)
    return run
  }

  return async (record, use) => {
    const input = await deps.assessments.assessDevice(record, use)
    const categories = deps.shownCategories(record.scan, input)
    const ctx = optionContext(record.scan, input, deps.impactTable)
    const options = categories.categories.flatMap((c) => c.options)
    const parts = options.flatMap((option) => {
      const part = partFor(option, ctx, input)
      return part ? [{ option_id: option.option_id, part }] : []
    })
    const prices = await Promise.all(
      parts.map(async ({ option_id, part }): Promise<WebPrice | null> => {
        const found = await partPrice(part)
        if (!found || found.offers.length < MIN_WEB_PRICE_OFFERS) return null
        const values = found.offers.map((o) => o.price_eur)
        return {
          option_id,
          part: part.label,
          low_eur: Math.min(...values),
          high_eur: Math.max(...values),
          offer_count: found.offers.length,
          offers: found.offers,
          retrieved_on: found.created_at.slice(0, 10),
        }
      }),
    )
    return { device_id: record.device_id, intended_use: use, prices: prices.filter((p): p is WebPrice => p !== null) }
  }
}
