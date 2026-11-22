// Local offers for the step plans of repair, pass it on and recycle options (feature 019 FR-005).
// Austria-wide by default; for the town shared on the device link when there is one (FR-006).
//
// The cache is keyed by a hash of the kind and town, never by a device, so it links no town to a
// device link; the offers themselves are public places.
import { createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { createValidator, LocalOffer, OFFER_KINDS, type CategoryOption, type DeviceRecord, type DeviceScan, type CategoryResult, type IntendedUse, type LocalOfferList, type OfferKind } from '@leaaf/shared'
import { Type } from 'typebox'
import type { AssessmentService, DeviceAssessment } from '../assessment/service.ts'
import { lookUp, type WebLookup } from '../search/lookup.ts'
import { isHttpUrl } from '../search/types.ts'
import { closestPath } from '../steps/service.ts'
import { checkLocalOffers, OfferAnswer, offerQuery, offerSystem, offerUserPrompt, PROMPT_VERSION } from './extract.ts'

export const OFFER_CACHE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000
const isOffers = createValidator(Type.Array(LocalOffer))

/** The offer kind of an option: the path closest to it, when that path is one with local offers. */
export function offerKind(option: CategoryOption): OfferKind | null {
  const path = closestPath(option)
  return (OFFER_KINDS as readonly string[]).includes(path ?? '') ? (path as OfferKind) : null
}

/**
 * Checked places for a kind and town, asking providers in turn until one names at least two places.
 * null when every provider failed (not cached). Also used by scripts/prices-smoke.ts.
 */
export function findLocalOffers(web: WebLookup, kind: OfferKind, town: string | null): Promise<LocalOffer[] | null> {
  return lookUp(web, {
    label: 'local offer',
    // Only the kind's words and the town reach the provider (FR-010).
    query: { text: offerQuery(kind, town), ...(town ? {} : { locale: { country: 'AT', language: 'de' } }) },
    keep: (h) => isHttpUrl(h.url),
    extract: async (hits) => {
      const answer = await web.llm.completeJson({ task: 'web_extraction', system: offerSystem(kind, town), user: offerUserPrompt(hits), schema: OfferAnswer })
      return checkLocalOffers(answer.value, hits)
    },
    // One place is a thin list; a second provider often finds the listing pages (smoke run 2026-11-22).
    enough: (offers) => offers.length >= 2,
  })
}

export interface OfferServiceDeps {
  /** null when web search or the LLM is off: every list is then empty. */
  web: WebLookup | null
  assessments: AssessmentService
  shownCategories: (scan: DeviceScan, input: DeviceAssessment) => CategoryResult
  /** The town shared on a device link, or null (location/store.ts). */
  townOf: (deviceId: string) => string | null
  warn?: (message: string, details?: Record<string, unknown>) => void
  now?: () => Date
}

export type OfferService = (record: DeviceRecord, use: IntendedUse, optionId: string) => Promise<LocalOfferList | null>

export function createOfferService(db: DatabaseSync, deps: OfferServiceDeps): OfferService {
  const now = deps.now ?? (() => new Date())
  // Additive table; dropping it only forces new searches.
  db.exec(`CREATE TABLE IF NOT EXISTS local_offer_cache (
    cache_key TEXT PRIMARY KEY,
    offers TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`)
  const select = db.prepare('SELECT offers, created_at FROM local_offer_cache WHERE cache_key = ? AND json_valid(offers)')
  const upsert = db.prepare(
    `INSERT INTO local_offer_cache (cache_key, offers, created_at) VALUES (?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET offers = excluded.offers, created_at = excluded.created_at`,
  )
  const prune = db.prepare('DELETE FROM local_offer_cache WHERE created_at < ?')
  const inFlight = new Map<string, Promise<{ offers: LocalOffer[]; created_at: string } | null>>()

  const keyOf = (kind: OfferKind, town: string | null) =>
    createHash('sha256').update(`${PROMPT_VERSION}\u001f${kind}\u001f${(town ?? '').normalize('NFKC').toLowerCase()}`).digest('hex')

  function cached(key: string) {
    const row = select.get(key) as { offers: string; created_at: string } | undefined
    if (!row || now().getTime() - Date.parse(row.created_at) >= OFFER_CACHE_DAYS * DAY_MS) return undefined
    const checked = isOffers(JSON.parse(row.offers))
    return checked.ok ? { offers: checked.value, created_at: row.created_at } : undefined
  }

  function store(key: string, offers: LocalOffer[]) {
    const created_at = now().toISOString()
    prune.run(new Date(now().getTime() - OFFER_CACHE_DAYS * DAY_MS).toISOString())
    upsert.run(key, JSON.stringify(offers), created_at)
    return { offers, created_at }
  }

  async function lookup(web: WebLookup, key: string, kind: OfferKind, town: string | null) {
    const found = await findLocalOffers(web, kind, town)
    return found ? store(key, found) : null
  }

  function offers(web: WebLookup, kind: OfferKind, town: string | null) {
    const key = keyOf(kind, town)
    const hit = cached(key)
    if (hit) return Promise.resolve(hit)
    const pending = inFlight.get(key)
    if (pending) return pending
    const run = lookup(web, key, kind, town).finally(() => inFlight.delete(key))
    inFlight.set(key, run)
    return run
  }

  return async (record, use, optionId) => {
    const input = await deps.assessments.assessDevice(record, use)
    const option = deps.shownCategories(record.scan, input).categories.flatMap((c) => c.options).find((o) => o.option_id === optionId)
    const kind = option ? offerKind(option) : null
    if (!option || !kind) return null
    const town = deps.townOf(record.device_id)
    const found = deps.web ? await offers(deps.web, kind, town) : null
    return {
      device_id: record.device_id,
      option_id: optionId,
      kind,
      town,
      offers: found?.offers ?? [],
      retrieved_on: found ? found.created_at.slice(0, 10) : null,
    }
  }
}
