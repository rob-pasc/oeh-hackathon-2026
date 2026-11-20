// Scan sessions (feature 006 FR-002 to FR-004; contract in shared/src/session.ts).
//
// A session is created when Scan now is pressed. Its ID is appended to the downloaded scanner,
// which posts progress to the session and sends the ID with its upload. The latest event is kept
// in SQLite so a page that (re)connects sees the current state; live listeners are in memory.
import { randomInt } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { createValidator, SessionId, type ScanSessionEvent } from '@leaaf/shared'

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 26 characters, each drawn uniformly from the OS CSPRNG: 130 bits, unguessable. */
export function newSessionId(): string {
  let id = ''
  for (let i = 0; i < 26; i++) id += CROCKFORD[randomInt(32)]
  return id
}

const isSessionId = createValidator(SessionId)

export interface SessionState {
  session_id: string
  device_id: string | null
  last_event: ScanSessionEvent | null
}

export type Listener = (event: ScanSessionEvent) => void

export interface SessionStore {
  create(): string
  get(id: string): SessionState | undefined
  /** Records and broadcasts an event. Returns false if the session is unknown or already finished. */
  publish(id: string, event: ScanSessionEvent): boolean
  subscribe(id: string, listener: Listener): () => void
}

export function createSqliteSessionStore(db: DatabaseSync, generateId: () => string = newSessionId): SessionStore {
  db.exec(`CREATE TABLE IF NOT EXISTS scan_sessions (
    session_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    device_id TEXT,
    last_event TEXT
  )`)
  const insert = db.prepare('INSERT INTO scan_sessions (session_id, created_at) VALUES (?, ?)')
  const select = db.prepare('SELECT device_id, last_event FROM scan_sessions WHERE session_id = ?')
  const update = db.prepare('UPDATE scan_sessions SET last_event = ?, device_id = COALESCE(?, device_id) WHERE session_id = ?')
  const listeners = new Map<string, Set<Listener>>()

  const get = (id: string): SessionState | undefined => {
    if (!isSessionId(id).ok) return undefined
    const row = select.get(id) as { device_id: string | null; last_event: string | null } | undefined
    if (!row) return undefined
    return {
      session_id: id,
      device_id: row.device_id,
      last_event: row.last_event ? (JSON.parse(row.last_event) as ScanSessionEvent) : null,
    }
  }

  return {
    create() {
      const id = generateId()
      insert.run(id, new Date().toISOString())
      return id
    },
    get,
    publish(id, event) {
      const state = get(id)
      // A finished session (complete or error) accepts no further events.
      if (!state || state.last_event?.type === 'complete' || state.last_event?.type === 'error') return false
      update.run(JSON.stringify(event), event.type === 'complete' ? event.device_id : null, id)
      for (const listener of listeners.get(id) ?? []) listener(event)
      return true
    },
    subscribe(id, listener) {
      const set = listeners.get(id) ?? new Set<Listener>()
      set.add(listener)
      listeners.set(id, set)
      return () => {
        set.delete(listener)
        if (set.size === 0) listeners.delete(id)
      }
    },
  }
}
