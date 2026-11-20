// Fact cache (feature 003 FR-002). Keys come from cacheKey() in extract.ts: the normalized model
// plus a hash of everything sent to the LLM, so a corpus or prompt change is a cache miss.
import type { DatabaseSync } from 'node:sqlite'
import { createValidator, FactSet } from '@leaaf/shared'

export interface FactCache {
  get(key: string): FactSet | undefined
  set(key: string, value: FactSet): void
}

export function createMemoryFactCache(): FactCache {
  const entries = new Map<string, FactSet>()
  return {
    get: (key) => entries.get(key),
    set: (key, value) => void entries.set(key, value),
  }
}

const isFactSet = createValidator(FactSet)

/** SQLite-backed cache using Node's built-in `node:sqlite`; creates its table if missing. */
export function createSqliteFactCache(db: DatabaseSync): FactCache {
  db.exec(`CREATE TABLE IF NOT EXISTS fact_cache (
    cache_key TEXT PRIMARY KEY,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    fact_set TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`)
  const select = db.prepare('SELECT fact_set FROM fact_cache WHERE cache_key = ?')
  const upsert = db.prepare(
    `INSERT INTO fact_cache (cache_key, manufacturer, model, fact_set, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET fact_set = excluded.fact_set, created_at = excluded.created_at`,
  )
  return {
    get(key) {
      const row = select.get(key) as { fact_set: string } | undefined
      if (!row) return undefined
      // A row written under an older contract version is treated as a miss and re-extracted.
      const checked = isFactSet(JSON.parse(row.fact_set))
      return checked.ok ? checked.value : undefined
    },
    set(key, value) {
      upsert.run(key, value.model.manufacturer, value.model.model, JSON.stringify(value), new Date().toISOString())
    },
  }
}
