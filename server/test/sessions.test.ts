import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { SCANNER_SESSION_MARKER, type DeviceRecord, type DeviceScan, type ScanSession, type UploadResponse } from '@leaaf/shared'
import { buildApp } from '../src/app.ts'
import { createSqliteDeviceStore } from '../src/devices/store.ts'
import { createSqliteSessionStore, newSessionId } from '../src/sessions/store.ts'

const laptop = JSON.parse(
  readFileSync(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url), 'utf8'),
) as DeviceScan

const EXE = 'MZ\x90\x00 fake scanner executable'
const servers: { close(): Promise<unknown> }[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()))
})

function setup() {
  const db = new DatabaseSync(':memory:')
  const dir = mkdtempSync(join(tmpdir(), 'leaaf-'))
  const exe = join(dir, 'leaaf-scanner.exe')
  writeFileSync(exe, EXE, 'latin1')
  const app = buildApp({
    devices: createSqliteDeviceStore(db),
    sessions: createSqliteSessionStore(db),
    publicBaseUrl: 'https://leaaf.example',
    scannerExePath: exe,
  })
  servers.push(app)
  return app
}

async function createSession(app: ReturnType<typeof setup>): Promise<ScanSession> {
  const res = await app.inject({ method: 'POST', url: '/api/sessions' })
  expect(res.statusCode).toBe(201)
  return res.json<ScanSession>()
}

/** Reads SSE frames from a live server until `count` events arrived or the stream ends. */
async function readEvents(base: string, id: string, count: number, onOpen?: () => Promise<void>) {
  const res = await fetch(`${base}/api/sessions/${id}/events`)
  expect(res.headers.get('content-type')).toContain('text/event-stream')
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  const events: { name: string; data: any }[] = []
  let buffer = ''
  const opened = onOpen?.()
  while (events.length < count) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const name = /^event: (.+)$/m.exec(frame)?.[1]
      const data = /^data: (.+)$/m.exec(frame)?.[1]
      if (name && data) events.push({ name, data: JSON.parse(data) })
    }
  }
  await opened
  await reader.cancel()
  return events
}

describe('scan sessions', () => {
  it('creates unguessable Crockford base32 session IDs with a matching download URL', async () => {
    const app = setup()
    const a = await createSession(app)
    const b = await createSession(app)
    expect(a.session_id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(a.session_id).not.toBe(b.session_id)
    expect(a.download_url).toBe(`/downloads/leaaf-scanner.exe?session=${a.session_id}`)
    const ids = new Set(Array.from({ length: 2000 }, newSessionId))
    expect(ids.size).toBe(2000)
  })

  it('appends the marker and session ID after the unchanged executable', async () => {
    const app = setup()
    const { session_id, download_url } = await createSession(app)
    const res = await app.inject({ method: 'GET', url: download_url })
    expect(res.statusCode).toBe(200)
    const body = res.rawPayload
    const trailer = SCANNER_SESSION_MARKER + session_id
    expect(body.length).toBe(Buffer.byteLength(EXE, 'latin1') + 37)
    expect(body.subarray(0, body.length - 37).toString('latin1')).toBe(EXE)
    expect(body.subarray(body.length - 37).toString('ascii')).toBe(trailer)

    const plain = await app.inject({ method: 'GET', url: '/downloads/leaaf-scanner.exe' })
    expect(plain.rawPayload.toString('latin1')).toBe(EXE)
    const unknown = await app.inject({ method: 'GET', url: `/downloads/leaaf-scanner.exe?session=${newSessionId()}` })
    expect(unknown.statusCode).toBe(404)
  })

  it('streams scanner steps and completes when the upload carries the session ID', async () => {
    const app = setup()
    const base = await app.listen({ port: 0, host: '127.0.0.1' })
    const { session_id } = await createSession(app)
    let device_id = ''
    const events = await readEvents(base, session_id, 3, async () => {
      const step = (s: string) =>
        fetch(`${base}/api/sessions/${session_id}/events`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'step', step: s, state: 'running' }),
        })
      expect((await step('cpu_memory')).status).toBe(204)
      expect((await step('upload')).status).toBe(204)
      const up = await fetch(`${base}/api/devices`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...laptop, session_id }),
      })
      expect(up.status).toBe(201)
      device_id = ((await up.json()) as UploadResponse).device_id
    })
    expect(events.map((e) => e.name)).toEqual(['step', 'step', 'complete'])
    expect(events[2]!.data).toEqual({ type: 'complete', device_id })

    // The stored scan does not contain the session ID, so no device route reveals it.
    const record = (await app.inject({ method: 'GET', url: `/api/devices/${device_id}` })).json<DeviceRecord>()
    expect(record.scan).toEqual(laptop)
    expect(JSON.stringify(record)).not.toContain(session_id)
  })

  it('replays the latest event to a page that connects late', async () => {
    const app = setup()
    const base = await app.listen({ port: 0, host: '127.0.0.1' })
    const { session_id } = await createSession(app)
    await app.inject({
      method: 'POST',
      url: `/api/sessions/${session_id}/events`,
      payload: { type: 'error', code: 'upload_failed', message: 'The scanner could not reach leaaf.' },
    })
    const events = await readEvents(base, session_id, 1)
    expect(events).toEqual([
      { name: 'error', data: { type: 'error', code: 'upload_failed', message: 'The scanner could not reach leaaf.' } },
    ])
  })

  it('rejects invalid events, unknown sessions, and scanners claiming completion', async () => {
    const app = setup()
    const { session_id } = await createSession(app)
    const post = (id: string, payload: object) => app.inject({ method: 'POST', url: `/api/sessions/${id}/events`, payload })
    expect((await post(session_id, { type: 'step', step: 'nope', state: 'running' })).statusCode).toBe(400)
    expect(
      (await post(session_id, { type: 'complete', device_id: 'q3Xk9vT2mB7pLw0cZr1sEa' })).statusCode,
    ).toBe(400)
    expect((await post(newSessionId(), { type: 'step', step: 'storage', state: 'done' })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: `/api/sessions/${newSessionId()}/events` })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url: '/api/sessions/not-an-id/events' })).statusCode).toBe(404)
  })

  it('still stores an upload whose session is unknown', async () => {
    const app = setup()
    const res = await app.inject({ method: 'POST', url: '/api/devices', payload: { ...laptop, session_id: newSessionId() } })
    expect(res.statusCode).toBe(201)
  })
})
