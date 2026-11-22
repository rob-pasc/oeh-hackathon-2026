// Search result cache and daily cap (feature 017 FR-008, FR-009). Keys name a model and a topic,
// never a device, so cached rows hold no personal data and expire on their own after 30 days.
import type { DatabaseSync } from 'node:sqlite'
import type { SearchHit } from './types.ts'

export const SEARCH_CACHE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export interface CachedSearch {
  hits: SearchHit[]
  /** When the search ran; web passages show it as their retrieval date. */
  created_at: string
}

export interface SearchCache {
  get(key: string): CachedSearch | undefined
  set(key: string, hits: SearchHit[]): CachedSearch
}

export interface SearchBudget {
  /** Reserves one search for today (UTC); false when the daily cap is reached. */
  reserve(): boolean
}

function isHit(value: unknown): value is SearchHit {
  const h = value as SearchHit
  return typeof h?.title === 'string' && typeof h.url === 'string' && typeof h.text === 'string' && (h.published === null || typeof h.published === 'string')
}

export function createSqliteSearchCache(db: DatabaseSync, now: () => Date = () => new Date()): SearchCache {
  db.exec(`CREATE TABLE IF NOT EXISTS search_cache (
    cache_key TEXT PRIMARY KEY,
    hits TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`)
  const select = db.prepare('SELECT hits, created_at FROM search_cache WHERE cache_key = ?')
  const upsert = db.prepare(
    `INSERT INTO search_cache (cache_key, hits, created_at) VALUES (?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET hits = excluded.hits, created_at = excluded.created_at`,
  )
  const prune = db.prepare('DELETE FROM search_cache WHERE created_at < ?')
  return {
    get(key) {
      const row = select.get(key) as { hits: string; created_at: string } | undefined
      if (!row) return undefined
      if (now().getTime() - Date.parse(row.created_at) >= SEARCH_CACHE_DAYS * DAY_MS) return undefined
      const hits: unknown = JSON.parse(row.hits)
      // A row in an unexpected shape is a miss and is searched again.
      return Array.isArray(hits) && hits.every(isHit) ? { hits, created_at: row.created_at } : undefined
    },
    set(key, hits) {
      const created_at = now().toISOString()
      prune.run(new Date(now().getTime() - SEARCH_CACHE_DAYS * DAY_MS).toISOString())
      upsert.run(key, JSON.stringify(hits), created_at)
      return { hits, created_at }
    },
  }
}

export function createSqliteSearchBudget(db: DatabaseSync, cap: number, now: () => Date = () => new Date()): SearchBudget {
  db.exec('CREATE TABLE IF NOT EXISTS search_daily_usage (day TEXT PRIMARY KEY, calls INTEGER NOT NULL)')
  const reserve = db.prepare(`INSERT INTO search_daily_usage (day, calls) VALUES (?, 1)
    ON CONFLICT(day) DO UPDATE SET calls = calls + 1 WHERE calls < ?`)
  return {
    reserve: () => cap > 0 && reserve.run(now().toISOString().slice(0, 10), cap).changes > 0,
  }
}
