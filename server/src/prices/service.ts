// Web prices for the SSD, RAM and battery options of a result (feature 019 FR-001 to FR-004).
//
// Prices are read for the options the result screen already shows and are returned on their own
// route: they never enter the category result, so scores, ranking, gauge and plan totals cannot
// change (FR-002). Searches share feature 017's daily cap.
import { MIN_WEB_PRICE_OFFERS, type CategoryResult, type DeviceRecord, type DeviceScan, type IntendedUse, type WebPrice, type WebPriceList, type WebPriceOffer } from '@leaaf/shared'
import type { DeviceAssessment, AssessmentService } from '../assessment/service.ts'
import { optionContext } from '../categories/service.ts'
import type { ImpactTable } from '../impact/table.ts'
import { lookUp, type WebLookup } from '../search/lookup.ts'
import type { SearchHit } from '../search/types.ts'
import type { CachedPrice, PriceCache } from './cache.ts'
import { checkOffers, PRICE_SYSTEM, PriceAnswer, priceUserPrompt, PROMPT_VERSION } from './extract.ts'
import { partFor, type PricePart } from './part.ts'
import { onDomains } from './sources.ts'

export interface PriceServiceDeps {
  /** Providers, cap and LLM for the lookups. */
  web: WebLookup
  cache: PriceCache
  /** The allowlist (config/price-sources.yaml). */
  domains: readonly string[]
  assessments: AssessmentService
  /** The categories the result screen shows, without a category call (categories/service.ts). */
  shownCategories: (scan: DeviceScan, input: DeviceAssessment) => CategoryResult
  impactTable: ImpactTable
}

/**
 * Results asked for per price search. Shop and comparison pages often come back with a title and
 * little text, so more of them give a range more often (smoke run 2026-11-22). TinyFish fetches at
 * most 10 pages.
 */
export const PRICE_RESULTS = 10

/** FR-012 of feature 017 applies: the part and "Preisvergleich" (price comparison), nothing from the scan but the model. */
export const priceQuery = (part: PricePart) => `${part.label} Preisvergleich`

/**
 * The checked offers for one part, asking providers in turn until one gives enough for a range.
 * null when every provider failed (not cached). Also used by scripts/prices-smoke.ts.
 */
export function findPartOffers(web: WebLookup, part: PricePart, domains: readonly string[]): Promise<WebPriceOffer[] | null> {
  const keep = (h: SearchHit) => onDomains(h.url, domains) && (part.accept?.(h) ?? true)
  return lookUp(web, {
    label: 'web price',
    query: { text: priceQuery(part), maxResults: PRICE_RESULTS, includeDomains: domains, accept: keep },
    keep,
    extract: async (hits) => {
      const answer = await web.llm.completeJson({ task: 'web_extraction', system: PRICE_SYSTEM, user: priceUserPrompt(part, hits), schema: PriceAnswer })
      return checkOffers(answer.value, hits, part, domains)
    },
    enough: (offers) => offers.length >= MIN_WEB_PRICE_OFFERS,
  })
}

export type PriceService = (record: DeviceRecord, use: IntendedUse) => Promise<WebPriceList>

export function createPriceService(deps: PriceServiceDeps): PriceService {
  // Concurrent result pages for the same part share one search and one LLM call.
  const inFlight = new Map<string, Promise<CachedPrice | null>>()
  // The allowlist is part of the key, so a changed list is searched again at once.
  const keyOf = (part: PricePart) => `${PROMPT_VERSION}\u001f${deps.domains.join(',')}\u001f${part.label}`.toLowerCase()

  async function lookup(part: PricePart): Promise<CachedPrice | null> {
    const offers = await findPartOffers(deps.web, part, deps.domains)
    // Failures are not cached; the next result page tries again.
    return offers ? deps.cache.set(keyOf(part), offers) : null
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
