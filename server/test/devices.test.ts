import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_UPLOAD_BYTES, type ApiError, type DeviceRecord, type DeviceScan, type UploadResponse } from '@leaaf/shared'
import { loadLimits } from '../src/limits.ts'
import { buildApp, type AppOptions } from '../src/app.ts'
import { createSqliteDeviceStore, newDeviceId } from '../src/devices/store.ts'
import { createSqliteSessionStore } from '../src/sessions/store.ts'

const fixture = (name: string): DeviceScan =>
  JSON.parse(readFileSync(new URL(`../../shared/fixtures/${name}.json`, import.meta.url), 'utf8')) as DeviceScan

const laptop = fixture('device-scan.laptop-complete')
const desktop = fixture('device-scan.desktop-partial')

let db: DatabaseSync | undefined
function app(extra: Partial<AppOptions> = {}) {
  db = new DatabaseSync(':memory:')
  return buildApp({
    devices: createSqliteDeviceStore(db),
    sessions: createSqliteSessionStore(db),
    publicBaseUrl: 'https://leaaf.example', ...extra })
}
const count = () => (db!.prepare('SELECT COUNT(*) AS n FROM devices').get() as { n: number }).n

afterEach(() => {
  db?.close()
  db = undefined
})

describe('POST /api/devices', () => {
  it('stores a valid scan and returns an unguessable ID with the device URL (AC-007)', async () => {
    const server = app()
    const a = await server.inject({ method: 'POST', url: '/api/devices', payload: laptop })
    const b = await server.inject({ method: 'POST', url: '/api/devices', payload: desktop })
    expect(a.statusCode).toBe(201)
    expect(b.statusCode).toBe(201)
    const ra = a.json<UploadResponse>()
    const rb = b.json<UploadResponse>()
    for (const r of [ra, rb]) {
      expect(r.device_id).toMatch(/^[A-Za-z0-9_-]{22}$/)
      expect(r.device_url).toBe(`https://leaaf.example/d/${r.device_id}`)
    }
    expect(ra.device_id).not.toBe(rb.device_id)
    expect(count()).toBe(2)
  })

  it('names every invalid field and stores nothing (AC-006)', async () => {
    const server = app()
    const bad = structuredClone(laptop) as any
    delete bad.identity.model
    bad.memory.total_gb = '8'
    const res = await server.inject({ method: 'POST', url: '/api/devices', payload: bad })
    expect(res.statusCode).toBe(400)
    const body = res.json<ApiError>()
    expect(body.error).toBe('invalid_payload')
    expect(body.fields?.map((f) => f.path).sort()).toEqual(['/identity/model', '/memory/total_gb'])
    expect(count()).toBe(0)
  })

  it('rejects identifying extra fields such as a serial number', async () => {
    const server = app()
    const bad = { ...laptop, identity: { ...laptop.identity, serial_number: 'PF1ABCDE' } }
    const res = await server.inject({ method: 'POST', url: '/api/devices', payload: bad })
    expect(res.statusCode).toBe(400)
    expect(res.json<ApiError>().fields).toContainEqual({ path: '/identity/serial_number', message: 'is not allowed' })
    expect(count()).toBe(0)
  })

  it('rejects a scan whose scan_status contradicts its null fields', async () => {
    const server = app()
    const res = await server.inject({ method: 'POST', url: '/api/devices', payload: { ...desktop, scan_status: 'complete' } })
    expect(res.statusCode).toBe(400)
    expect(res.json<ApiError>().error).toBe('invalid_payload')
  })

  it('rejects malformed JSON and oversized bodies', async () => {
    const server = app()
    const broken = await server.inject({
      method: 'POST',
      url: '/api/devices',
      headers: { 'content-type': 'application/json' },
      payload: '{"schema_version":',
    })
    expect(broken.statusCode).toBe(400)
    expect(broken.json<ApiError>().error).toBe('invalid_payload')

    const huge = { ...laptop, gpus: ['x'.repeat(MAX_UPLOAD_BYTES)] }
    const big = await server.inject({ method: 'POST', url: '/api/devices', payload: huge })
    expect(big.statusCode).toBe(413)
    expect(big.json<ApiError>().error).toBe('payload_too_large')
    expect(count()).toBe(0)
  })
})

describe('deployment request limits', () => {
  it('limits uploads and reports independently before parsing or assessing, then reopens the window', async () => {
    const server = app({ limits: loadLimits({ UPLOADS_PER_HOUR: '1', REPORTS_PER_HOUR: '1', UPLOAD_MAX_BYTES: '100' }) })
    const upload = { method: 'POST', url: '/api/devices', payload: laptop } as const
    const report = '/api/devices/unknown/report?intended_use=office'
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
    try {
      expect((await server.inject(upload)).statusCode).toBe(413)
      const limited = await server.inject({ ...upload, headers: { 'x-forwarded-for': '192.0.2.5' } })
      expect(limited.statusCode).toBe(429)
      expect(limited.headers['retry-after']).toBe('3600')
      expect(limited.json().error).toBe('rate_limited')
      expect((await server.inject(report)).statusCode).toBe(404)
      expect((await server.inject(report)).statusCode).toBe(429)
      expect((await server.inject({ ...upload, remoteAddress: '192.0.2.6' })).statusCode).toBe(413)
      clock.mockReturnValue(3601000)
      expect((await server.inject(report)).statusCode).toBe(404)
    } finally {
      clock.mockRestore()
      await server.close()
    }
  })

  it('uses forwarded client addresses only behind the configured peer', async () => {
    const server = app({ limits: loadLimits({ TRUSTED_PROXY_IP: '192.0.2.1', UPLOADS_PER_HOUR: '1' }) })
    const upload = (remoteAddress: string, forwarded: string) => server.inject({
      remoteAddress, headers: { 'x-forwarded-for': forwarded }, method: 'POST', url: '/api/devices', payload: laptop,
    })
    expect((await upload('192.0.2.1', '198.51.100.1')).statusCode).toBe(201)
    expect((await upload('192.0.2.1', '198.51.100.2')).statusCode).toBe(201)
    expect((await upload('192.0.2.1', '198.51.100.9, 198.51.100.1')).statusCode).toBe(429)
    expect((await upload('192.0.2.2', '198.51.100.3')).statusCode).toBe(201)
    expect((await upload('192.0.2.2', '198.51.100.4')).statusCode).toBe(429)
    await server.close()
  })
})

describe('GET /api/devices/:id', () => {
  it('returns the stored record', async () => {
    const server = app()
    const { device_id } = (await server.inject({ method: 'POST', url: '/api/devices', payload: laptop })).json<UploadResponse>()
    const res = await server.inject({ method: 'GET', url: `/api/devices/${device_id}` })
    expect(res.statusCode).toBe(200)
    const record = res.json<DeviceRecord>()
    expect(record.device_id).toBe(device_id)
    expect(record.scan).toEqual(laptop)
  })

  it('answers unknown and malformed IDs with the same not-found body (AC-010)', async () => {
    const server = app()
    const unknown = await server.inject({ method: 'GET', url: `/api/devices/${newDeviceId()}` })
    const malformed = await server.inject({ method: 'GET', url: "/api/devices/not-an-id'--" })
    expect(unknown.statusCode).toBe(404)
    expect(malformed.statusCode).toBe(404)
    expect(unknown.json()).toEqual({ error: 'not_found', message: 'device not found' })
    expect(malformed.json()).toEqual(unknown.json())
  })

  it('offers no route that lists devices (AC-010 route inventory)', async () => {
    const server = app()
    await server.ready()
    const expected: [string, string][] = [
      ['POST', '/api/devices'],
      ['GET', '/api/devices/:id'],
      ['GET', '/api/devices/:id/report'],
      ['GET', '/downloads/leaaf-scanner.exe'],
      ['GET', '/downloads/leaaf-scanner-linux'],
      ['GET', '/downloads/leaaf-scanner-macos.zip'],
      ['POST', '/api/sessions'],
      ['POST', '/api/sessions/:id/events'],
      ['GET', '/api/sessions/:id/events'],
    ]
    for (const [method, url] of expected) expect(server.hasRoute({ method, url })).toBe(true)
    // printRoutes prints one "(METHODS)" entry per registered path; no other paths may exist.
    expect(server.printRoutes().match(/\(/g)).toHaveLength(new Set(expected.map(([, url]) => url)).size)
    for (const url of ['/api/devices', '/api/devices/']) {
      expect((await server.inject({ method: 'GET', url })).statusCode).toBe(404)
    }
  })
})

describe('device IDs', () => {
  it('are 22 base64url characters from 16 random bytes', () => {
    const ids = new Set(Array.from({ length: 1000 }, newDeviceId))
    expect(ids.size).toBe(1000)
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/)
      expect(Buffer.from(id, 'base64url')).toHaveLength(16)
    }
  })
})

describe('GET /downloads/leaaf-scanner.exe', () => {
  it('serves the scanner executable as an attachment (AC-011)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'leaaf-'))
    const exe = join(dir, 'leaaf-scanner.exe')
    writeFileSync(exe, 'MZ fake executable')
    const res = await app({ scannerExePath: exe }).inject({ method: 'GET', url: '/downloads/leaaf-scanner.exe' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-disposition']).toContain('leaaf-scanner.exe')
    expect(res.body).toBe('MZ fake executable')
  })

  it('is not found while no build exists', async () => {
    const res = await app({ scannerExePath: '/nonexistent/leaaf-scanner.exe' }).inject({
      method: 'GET',
      url: '/downloads/leaaf-scanner.exe',
    })
    expect(res.statusCode).toBe(404)
  })
})
