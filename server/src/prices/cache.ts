// Web price cache (feature 019 FR-004): checked offers per part query for 7 days. Keys name a part,
// never a device, so rows hold no personal data; an empty list is cached too, so a part with too
// few offers is not searched again on every result page.
import type { DatabaseSync } from 'node:sqlite'
import { createValidator, WebPriceOffer } from '@leaaf/shared'
import { Type } from 'typebox'

export const PRICE_CACHE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000
const isOffers = createValidator(Type.Array(WebPriceOffer))

export interface CachedPrice {
  offers: WebPriceOffer[]
  /** When the search ran; shown as the web price's retrieval date. */
  created_at: string
}

export interface PriceCache {
  get(key: string): CachedPrice | undefined
  set(key: string, offers: WebPriceOffer[]): CachedPrice
}

export function createSqlitePriceCache(db: DatabaseSync, now: () => Date = () => new Date()): PriceCache {
  // Additive table; dropping it only forces new searches.
  db.exec(`CREATE TABLE IF NOT EXISTS web_price_cache (
    part_key TEXT PRIMARY KEY,
    offers TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`)
  const select = db.prepare('SELECT offers, created_at FROM web_price_cache WHERE part_key = ? AND json_valid(offers)')
  const upsert = db.prepare(
    `INSERT INTO web_price_cache (part_key, offers, created_at) VALUES (?, ?, ?)
     ON CONFLICT(part_key) DO UPDATE SET offers = excluded.offers, created_at = excluded.created_at`,
  )
  const prune = db.prepare('DELETE FROM web_price_cache WHERE created_at < ?')
  return {
    get(key) {
      const row = select.get(key) as { offers: string; created_at: string } | undefined
      if (!row || now().getTime() - Date.parse(row.created_at) >= PRICE_CACHE_DAYS * DAY_MS) return undefined
      const checked = isOffers(JSON.parse(row.offers))
      return checked.ok ? { offers: checked.value, created_at: row.created_at } : undefined
    },
    set(key, offers) {
      const created_at = now().toISOString()
      prune.run(new Date(now().getTime() - PRICE_CACHE_DAYS * DAY_MS).toISOString())
      upsert.run(key, JSON.stringify(offers), created_at)
      return { offers, created_at }
    },
  }
}
