// The town shared on a device link (feature 019 FR-007). Only the town is stored, in its own table
// rather than the scan JSON, so the admin details view (feature 016) does not show it. Rows are
// deleted with their device by the retention purge (retention.ts).
import type { DatabaseSync } from 'node:sqlite'

export interface LocationStore {
  town(deviceId: string): string | null
  set(deviceId: string, town: string): void
  clear(deviceId: string): void
}

export function createSqliteLocationStore(db: DatabaseSync, now: () => Date = () => new Date()): LocationStore {
  // Additive table; dropping it returns every device link to Austria-wide offers.
  db.exec(`CREATE TABLE IF NOT EXISTS device_locations (
    device_id TEXT PRIMARY KEY,
    town TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`)
  const select = db.prepare('SELECT town FROM device_locations WHERE device_id = ?')
  const upsert = db.prepare(
    `INSERT INTO device_locations (device_id, town, created_at) VALUES (?, ?, ?)
     ON CONFLICT(device_id) DO UPDATE SET town = excluded.town, created_at = excluded.created_at`,
  )
  const remove = db.prepare('DELETE FROM device_locations WHERE device_id = ?')
  return {
    town: (deviceId) => (select.get(deviceId) as { town: string } | undefined)?.town ?? null,
    set: (deviceId, town) => void upsert.run(deviceId, town, now().toISOString()),
    clear: (deviceId) => void remove.run(deviceId),
  }
}
