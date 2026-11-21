// Log of AI fallbacks (feature 016 FR-016): each time the category or step call shows a template
// instead of an AI answer. It keeps a fixed reason code, never prompt, answer or message text, so
// it holds no personal data. Rows belong to their scan and must be deleted with it once scan
// deletion exists.
import type { DatabaseSync } from 'node:sqlite'
import type { AiCall, AiFallbackReason, IntendedUse } from '@leaaf/shared'

export interface FallbackEvent {
  device_id: string
  intended_use: IntendedUse
  call: AiCall
  option_id: string | null
  reason: AiFallbackReason
}

export type RecordFallback = (event: FallbackEvent) => void

export function createFallbackLog(db: DatabaseSync, now: () => Date = () => new Date()) {
  // Additive table; dropping it only loses the history shown on the admin page.
  db.exec(`CREATE TABLE IF NOT EXISTS ai_fallbacks (
    device_id TEXT NOT NULL, intended_use TEXT NOT NULL, call TEXT NOT NULL, option_id TEXT,
    reason TEXT NOT NULL, created_at TEXT NOT NULL)`)
  db.exec('CREATE INDEX IF NOT EXISTS ai_fallbacks_device ON ai_fallbacks (device_id)')
  const insert = db.prepare('INSERT INTO ai_fallbacks (device_id, intended_use, call, option_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  return {
    record: ((e) => {
      insert.run(e.device_id, e.intended_use, e.call, e.option_id, e.reason, now().toISOString())
    }) as RecordFallback,
  }
}
