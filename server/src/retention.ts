// Deletion of scan data after the retention period that the privacy notice promises (feature 006
// FR-046, T-042). A scan is removed together with everything stored for its device ID; scan
// sessions go after the same period because they link to device IDs. The fact cache is kept: it
// is keyed by laptop model and extracted from public manuals, so it holds no scan data.
import type { DatabaseSync } from 'node:sqlite'

/** Must equal `scanRetentionDays` in web/src/legal/provider.ts; a test checks this. */
export const SCAN_RETENTION_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** Tables with per-device rows. Some are created only when their service is wired, so missing ones are skipped. */
const DEVICE_TABLES = ['category_cache', 'step_cache', 'explanation_cache', 'ai_fallbacks'] as const

export interface PurgeResult {
  devices: number
  sessions: number
}

/**
 * Deletes devices and sessions created before `now - days`, and the device rows of DEVICE_TABLES,
 * in one transaction. `created_at` is an ISO-8601 UTC string in both tables, so string comparison
 * orders it correctly.
 */
export function purgeExpiredScans(db: DatabaseSync, now: Date = new Date(), days = SCAN_RETENTION_DAYS): PurgeResult {
  const cutoff = new Date(now.getTime() - days * DAY_MS).toISOString()
  const existing = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name),
  )
  const result: PurgeResult = { devices: 0, sessions: 0 }
  db.exec('BEGIN IMMEDIATE')
  try {
    if (existing.has('devices')) {
      const expired = 'SELECT device_id FROM devices WHERE created_at < ?'
      for (const table of DEVICE_TABLES) {
        if (existing.has(table)) db.prepare(`DELETE FROM ${table} WHERE device_id IN (${expired})`).run(cutoff)
      }
      result.devices = Number(db.prepare('DELETE FROM devices WHERE created_at < ?').run(cutoff).changes)
    }
    if (existing.has('scan_sessions')) {
      result.sessions = Number(db.prepare('DELETE FROM scan_sessions WHERE created_at < ?').run(cutoff).changes)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return result
}

/**
 * Purges once now and then every `intervalMs`. A failed run is reported and retried at the next
 * interval rather than stopping the server. Returns a function that stops the timer.
 */
export function schedulePurge(
  db: DatabaseSync,
  report: { purged(result: PurgeResult): void; failed(error: unknown): void },
  intervalMs = 60 * 60 * 1000,
): () => void {
  const run = () => {
    try {
      report.purged(purgeExpiredScans(db))
    } catch (error) {
      report.failed(error)
    }
  }
  run()
  const timer = setInterval(run, intervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
