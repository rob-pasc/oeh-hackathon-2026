// What the admin page shows about AI use (feature 016 FR-014, FR-015, FR-017). Reads the caches of
// the category and step services, the daily call counter and the fallback log. Each of those
// tables is created by its own service, so a table that does not exist yet counts as empty.
import type { DatabaseSync } from 'node:sqlite'
import type { AdminAiUsage, AdminScanDetail } from '@leaaf/shared'

export interface AdminInsights {
  aiUsageToday(): AdminAiUsage
  aiStatus(deviceId: string): AdminScanDetail['ai']
}

/** For an app without a database (tests): no AI use, the given cap. */
export function emptyInsights(cap: number, now: () => Date = () => new Date()): AdminInsights {
  return {
    aiUsageToday: () => ({ day: now().toISOString().slice(0, 10), used: 0, cap }),
    aiStatus: () => ({ categories: [], steps: [], fallbacks: [] }),
  }
}

export function createAdminInsights(db: DatabaseSync, cap: number, now: () => Date = () => new Date()): AdminInsights {
  const exists = (table: string) =>
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !== undefined
  const all = <T>(table: string, sql: string, ...params: (string | number)[]): T[] =>
    exists(table) ? (db.prepare(sql).all(...params) as unknown as T[]) : []
  return {
    aiUsageToday() {
      const day = now().toISOString().slice(0, 10)
      const [row] = all<{ calls: number }>('llm_daily_usage', 'SELECT calls FROM llm_daily_usage WHERE day = ?', day)
      return { day, used: Number(row?.calls ?? 0), cap }
    },
    aiStatus(deviceId) {
      return {
        categories: all('category_cache', 'SELECT intended_use, generated_at FROM category_cache WHERE device_id = ? ORDER BY intended_use', deviceId),
        steps: all(
          'step_cache',
          'SELECT intended_use, count(*) AS plans FROM step_cache WHERE device_id = ? GROUP BY intended_use ORDER BY intended_use',
          deviceId,
        ),
        fallbacks: all(
          'ai_fallbacks',
          'SELECT created_at, call, intended_use, option_id, reason FROM ai_fallbacks WHERE device_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 200',
          deviceId,
        ),
      }
    },
  }
}
