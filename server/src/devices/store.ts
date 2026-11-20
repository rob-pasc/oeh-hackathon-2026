// Device records (feature 001 FR-008). One row per accepted upload; rescans are new rows.
import { randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { createValidator, DeviceId, DeviceScan, type DeviceRecord } from '@leaaf/shared'

export interface DeviceStore {
  /** Stores a validated scan under a fresh unguessable ID. */
  create(scan: DeviceScan): DeviceRecord
  get(id: string): DeviceRecord | undefined
}

/**
 * 16 bytes from the OS CSPRNG, base64url without padding: always 22 characters, 128 bits.
 * The ID is the only access control for a device (no accounts), so never use a weaker source.
 */
export function newDeviceId(): string {
  return randomBytes(16).toString('base64url')
}

const isDeviceId = createValidator(DeviceId)
const isScan = createValidator(DeviceScan)

export function createSqliteDeviceStore(db: DatabaseSync, generateId: () => string = newDeviceId): DeviceStore {
  db.exec(`CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    scan TEXT NOT NULL
  )`)
  const insert = db.prepare('INSERT INTO devices (device_id, created_at, scan) VALUES (?, ?, ?)')
  const select = db.prepare('SELECT created_at, scan FROM devices WHERE device_id = ?')
  return {
    create(scan) {
      const record: DeviceRecord = { device_id: generateId(), created_at: new Date().toISOString(), scan }
      insert.run(record.device_id, record.created_at, JSON.stringify(scan))
      return record
    },
    get(id) {
      // Malformed IDs never reach the database and look exactly like unknown ones (FR-011).
      if (!isDeviceId(id).ok) return undefined
      const row = select.get(id) as { created_at: string; scan: string } | undefined
      if (!row) return undefined
      const scan = isScan(JSON.parse(row.scan))
      if (!scan.ok) throw new Error('stored device scan no longer matches the contract')
      return { device_id: id, created_at: row.created_at, scan: scan.value }
    },
  }
}
