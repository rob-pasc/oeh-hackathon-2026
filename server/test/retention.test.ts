import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it, vi } from 'vitest'
import { createFallbackLog } from '../src/admin/fallbacks.ts'
import { createCategoryService } from '../src/categories/service.ts'
import { createSqliteDeviceStore } from '../src/devices/store.ts'
import { createSqliteFactCache } from '../src/facts/index.ts'
import { loadImpactTable } from '../src/impact/table.ts'
import { createReportService } from '../src/report/service.ts'
import { purgeExpiredScans, SCAN_RETENTION_DAYS, schedulePurge } from '../src/retention.ts'
import { createSqliteSessionStore } from '../src/sessions/store.ts'
import { createSqliteLocationStore } from '../src/location/store.ts'
import { createStepService, type StepServiceDeps } from '../src/steps/service.ts'

const NOW = new Date('2026-12-31T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

/** A database with every table the server creates, using the real constructors. */
function database() {
  const db = new DatabaseSync(':memory:')
  createSqliteDeviceStore(db)
  createSqliteSessionStore(db)
  createFallbackLog(db)
  createSqliteFactCache(db)
  createCategoryService(db, null, { impactTable: loadImpactTable() })
  createStepService(db, null, {} as unknown as StepServiceDeps)
  createReportService(db, null)
  createSqliteLocationStore(db)
  return db
}

function addDevice(db: DatabaseSync, id: string, createdAt: string) {
  db.prepare('INSERT INTO devices (device_id, created_at, scan) VALUES (?, ?, ?)').run(id, createdAt, '{}')
  db.prepare("INSERT INTO category_cache VALUES (?, 'office', 'h', '{}', ?)").run(id, createdAt)
  db.prepare("INSERT INTO step_cache VALUES (?, 'office', 'opt', 'h', '{}', ?)").run(id, createdAt)
  db.prepare("INSERT INTO explanation_cache VALUES (?, 'office', '{}', ?)").run(id, createdAt)
  db.prepare("INSERT INTO ai_fallbacks VALUES (?, 'office', 'categories', NULL, 'timeout', ?)").run(id, createdAt)
  db.prepare("INSERT INTO device_locations VALUES (?, 'Dornbirn', ?)").run(id, createdAt)
}

const count = (db: DatabaseSync, table: string, id?: string) =>
  Number(
    (id
      ? db.prepare(`SELECT count(*) AS n FROM ${table} WHERE device_id = ?`).get(id)
      : db.prepare(`SELECT count(*) AS n FROM ${table}`).get()
    )?.n,
  )

describe('scan retention (feature 006 FR-046)', () => {
  it('deletes a scan older than 30 days with everything stored for its device', () => {
    const db = database()
    addDevice(db, 'old', daysAgo(31))
    addDevice(db, 'new', daysAgo(29))

    expect(purgeExpiredScans(db, NOW)).toEqual({ devices: 1, sessions: 0 })

    for (const table of ['devices', 'category_cache', 'step_cache', 'explanation_cache', 'ai_fallbacks', 'device_locations']) {
      expect(count(db, table, 'old'), table).toBe(0)
      expect(count(db, table, 'new'), table).toBe(1)
    }
  })

  it('keeps a scan until the full period has passed', () => {
    const db = database()
    addDevice(db, 'edge', daysAgo(30))
    expect(purgeExpiredScans(db, NOW).devices).toBe(0)
    expect(purgeExpiredScans(db, new Date(NOW.getTime() + 1)).devices).toBe(1)
  })

  it('deletes scan sessions older than 30 days, also those linked to a device', () => {
    const db = database()
    const insert = db.prepare('INSERT INTO scan_sessions (session_id, created_at, device_id) VALUES (?, ?, ?)')
    insert.run('old-linked', daysAgo(40), 'gone')
    insert.run('old-open', daysAgo(31), null)
    insert.run('recent', daysAgo(1), null)

    expect(purgeExpiredScans(db, NOW).sessions).toBe(2)
    expect(db.prepare('SELECT session_id FROM scan_sessions').all()).toEqual([{ session_id: 'recent' }])
  })

  it('keeps the model fact cache, which holds no scan data', () => {
    const db = database()
    db.prepare("INSERT INTO fact_cache VALUES ('k', 'Lenovo', 'T480', '{}', ?)").run(daysAgo(90))
    purgeExpiredScans(db, NOW)
    expect(count(db, 'fact_cache')).toBe(1)
  })

  it('works when optional tables were never created', () => {
    const db = new DatabaseSync(':memory:')
    createSqliteDeviceStore(db)
    db.prepare('INSERT INTO devices (device_id, created_at, scan) VALUES (?, ?, ?)').run('old', daysAgo(31), '{}')
    expect(purgeExpiredScans(db, NOW)).toEqual({ devices: 1, sessions: 0 })
    expect(purgeExpiredScans(new DatabaseSync(':memory:'), NOW)).toEqual({ devices: 0, sessions: 0 })
  })

  it('a device deleted this way is no longer found by the store', () => {
    const db = database()
    const store = createSqliteDeviceStore(db, () => 'stored-id')
    store.create({} as never)
    db.prepare('UPDATE devices SET created_at = ?').run(daysAgo(31))
    purgeExpiredScans(db, NOW)
    expect(store.get('stored-id')).toBeUndefined()
  })

  it('runs at once and then on every interval, and reports failures without throwing', () => {
    vi.useFakeTimers()
    try {
      const db = database()
      const purged = vi.fn()
      const failed = vi.fn()
      const stop = schedulePurge(db, { purged, failed }, 1000)
      expect(purged).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(2000)
      expect(purged).toHaveBeenCalledTimes(3)

      db.close()
      vi.advanceTimersByTime(1000)
      expect(failed).toHaveBeenCalledTimes(1)
      stop()
      vi.advanceTimersByTime(5000)
      expect(failed).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses the retention period the privacy notice states', () => {
    const provider = readFileSync(new URL('../../web/src/legal/provider.ts', import.meta.url), 'utf8')
    expect(provider).toMatch(new RegExp(`scanRetentionDays: '${SCAN_RETENTION_DAYS}'`))
  })
})
