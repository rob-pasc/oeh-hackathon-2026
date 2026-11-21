import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { Writable } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import { AdminScanDetail, AdminScanPage, createValidator, type DeviceScan } from '@leaaf/shared'
import { buildApp, REQUEST_LOG_SERIALIZERS } from '../src/app.ts'
import { credentialsMatch } from '../src/admin/auth.ts'
import { loadAdminConfig } from '../src/admin/config.ts'
import { createFallbackLog } from '../src/admin/fallbacks.ts'
import { createAdminInsights } from '../src/admin/insights.ts'
import { createSqliteDeviceStore } from '../src/devices/store.ts'
import { createSqliteSessionStore } from '../src/sessions/store.ts'

const laptop = JSON.parse(
  readFileSync(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url), 'utf8'),
) as DeviceScan
const USER = 'team'
const PASSWORD = 'correct horse battery staple'
const config = { username: USER, password: PASSWORD }
const isPage = createValidator(AdminScanPage)

const apps: { close(): Promise<unknown> }[] = []
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()))
})

function setup(options: { admin?: typeof config | null; logLines?: string[]; insights?: boolean } = {}) {
  const db = new DatabaseSync(':memory:')
  const devices = createSqliteDeviceStore(db)
  const clock = { t: Date.UTC(2026, 10, 21, 12) }
  const app = buildApp({
    devices,
    sessions: createSqliteSessionStore(db),
    publicBaseUrl: 'https://leaaf.example',
    admin: options.admin === undefined ? config : options.admin,
    ...(options.insights ? { adminInsights: createAdminInsights(db, 200, () => new Date(clock.t)) } : {}),
    now: () => clock.t,
    ...(options.logLines
      ? {
          logger: {
            level: 'info',
            serializers: REQUEST_LOG_SERIALIZERS,
            stream: new Writable({
              write(chunk, _enc, done) {
                options.logLines!.push(String(chunk))
                done()
              },
            }),
          },
        }
      : {}),
  })
  apps.push(app)
  return { app, devices, clock, db }
}

type App = ReturnType<typeof setup>['app']
const login = (app: App, username = USER, password = PASSWORD, remoteAddress = '203.0.113.1') =>
  app.inject({ method: 'POST', url: '/api/admin/login', payload: { username, password }, remoteAddress })
const cookieOf = (res: Awaited<ReturnType<typeof login>>) => String(res.headers['set-cookie']).split(';')[0]!

describe('admin configuration (FR-001, FR-002)', () => {
  it('is off without both variables or with a short password, and never logs the password', () => {
    const warnings: string[] = []
    const warn = (m: string) => warnings.push(m)
    expect(loadAdminConfig({ ADMIN_USERNAME: 'team' }, warn)).toBeNull()
    expect(loadAdminConfig({ ADMIN_PASSWORD: PASSWORD }, warn)).toBeNull()
    expect(loadAdminConfig({ ADMIN_USERNAME: ' ', ADMIN_PASSWORD: PASSWORD }, warn)).toBeNull()
    expect(warnings).toEqual([])
    expect(loadAdminConfig({ ADMIN_USERNAME: 'team', ADMIN_PASSWORD: 'fifteen-chars-x' }, warn)).toBeNull()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).not.toContain('fifteen-chars-x')
    expect(loadAdminConfig({ ADMIN_USERNAME: 'team', ADMIN_PASSWORD: 'sixteen-chars-xy' }, warn)).toEqual({ username: 'team', password: 'sixteen-chars-xy' })
  })

  it('answers 404 on every admin route while it is off, and the rest of the API works', async () => {
    const { app } = setup({ admin: null })
    for (const [method, url] of [
      ['POST', '/api/admin/login'],
      ['POST', '/api/admin/logout'],
      ['GET', '/api/admin/session'],
      ['GET', '/api/admin/scans'],
    ] as const) {
      const res = method === 'POST' ? await app.inject({ method, url, payload: {} }) : await app.inject({ method, url })
      expect(res.statusCode).toBe(404)
    }
    expect((await app.inject({ method: 'POST', url: '/api/sessions' })).statusCode).toBe(201)
  })
})

describe('admin login (FR-003, FR-005, FR-010)', () => {
  it('starts a session with the right credentials and a strict cookie', async () => {
    const { app } = setup()
    const res = await login(app)
    expect(res.statusCode).toBe(204)
    const cookie = String(res.headers['set-cookie'])
    expect(cookie).toMatch(/^leaaf_admin=[A-Za-z0-9_-]{43};/) // 32 random bytes, 256 bits
    for (const flag of ['Path=/api/admin', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Max-Age=43200']) expect(cookie).toContain(flag)
    const session = await app.inject({ method: 'GET', url: '/api/admin/session', headers: { cookie: cookieOf(res) } })
    expect(session.json()).toEqual({ username: USER })
  })

  it('refuses a wrong username and a wrong password with the same answer', async () => {
    const { app } = setup()
    const wrongUser = await login(app, 'admin', PASSWORD)
    const wrongPass = await login(app, USER, PASSWORD + '!')
    expect(wrongUser.statusCode).toBe(401)
    expect(wrongPass.statusCode).toBe(401)
    expect(wrongUser.body).toBe(wrongPass.body)
    expect(wrongUser.json()).toEqual({ error: 'unauthorized', message: 'Wrong username or password' })
    expect(wrongUser.headers['set-cookie']).toBeUndefined()
  })

  it('compares fixed-length digests, whatever the input length (FR-003)', () => {
    expect(credentialsMatch(config, USER, PASSWORD)).toBe(true)
    for (const [u, p] of [['', ''], [USER, ''], [USER, PASSWORD.slice(0, -1)], [USER, PASSWORD + 'x'.repeat(5000)], ['x'.repeat(5000), PASSWORD]])
      expect(credentialsMatch(config, u!, p!)).toBe(false)
  })

  it('accepts the login only as JSON', async () => {
    const { app } = setup()
    for (const [type, payload] of [
      ['application/x-www-form-urlencoded', `username=${USER}&password=${encodeURIComponent(PASSWORD)}`],
      ['text/plain', JSON.stringify({ username: USER, password: PASSWORD })],
    ] as const) {
      const res = await app.inject({ method: 'POST', url: '/api/admin/login', headers: { 'content-type': type }, payload })
      // Fastify itself refuses bodies it has no parser for (400); text/plain reaches the route (415).
      expect([400, 415]).toContain(res.statusCode)
      expect(res.headers['set-cookie']).toBeUndefined()
    }
  })
})

describe('failed login limits (FR-004)', () => {
  it('blocks one client after five failures in 15 minutes, while another client can still log in', async () => {
    const { app, clock } = setup()
    for (let i = 0; i < 5; i++) expect((await login(app, USER, 'wrong', '203.0.113.7')).statusCode).toBe(401)
    const blocked = await login(app, USER, PASSWORD, '203.0.113.7')
    expect(blocked.statusCode).toBe(429)
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
    expect((await login(app, USER, PASSWORD, '198.51.100.2')).statusCode).toBe(204)
    clock.t += 15 * 60 * 1000
    expect((await login(app, USER, PASSWORD, '203.0.113.7')).statusCode).toBe(204)
  })

  it('blocks every login after 50 failures from all clients, until the window ends', async () => {
    const { app, clock } = setup()
    for (let i = 0; i < 50; i++) await login(app, USER, 'wrong', `192.0.2.${i}`)
    const res = await login(app, USER, PASSWORD, '198.51.100.9')
    expect(res.statusCode).toBe(429)
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    clock.t += 15 * 60 * 1000 + 1
    expect((await login(app, USER, PASSWORD, '198.51.100.9')).statusCode).toBe(204)
  })

  it('does not count successful logins', async () => {
    const { app } = setup()
    for (let i = 0; i < 8; i++) expect((await login(app)).statusCode).toBe(204)
  })
})

describe('admin sessions (FR-005, FR-006)', () => {
  const routes = ['/api/admin/session', '/api/admin/scans']

  it('answers 401 with no data without a valid session', async () => {
    const { app, devices } = setup()
    devices.create(laptop)
    for (const cookie of [undefined, 'leaaf_admin=made-up-token', 'other=1']) {
      for (const url of routes) {
        const res = await app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })
        expect(res.statusCode).toBe(401)
        expect(res.body).not.toContain('device_id')
      }
    }
  })

  it('ends after 12 hours, on logout, and when the server restarts', async () => {
    const first = setup()
    const cookie = cookieOf(await login(first.app))
    const get = (app: App) => app.inject({ method: 'GET', url: '/api/admin/scans', headers: { cookie } })
    expect((await get(first.app)).statusCode).toBe(200)
    first.clock.t += 12 * 60 * 60 * 1000
    expect((await get(first.app)).statusCode).toBe(401)

    const second = setup()
    const c2 = cookieOf(await login(second.app))
    const out = await second.app.inject({ method: 'POST', url: '/api/admin/logout', headers: { cookie: c2 }, payload: {} })
    expect(out.statusCode).toBe(204)
    expect(String(out.headers['set-cookie'])).toContain('Max-Age=0')
    expect((await second.app.inject({ method: 'GET', url: '/api/admin/session', headers: { cookie: c2 } })).statusCode).toBe(401)

    // A new app instance is a restart: sessions live only in memory.
    const restarted = setup()
    const c3 = cookieOf(await login(second.app))
    expect((await restarted.app.inject({ method: 'GET', url: '/api/admin/session', headers: { cookie: c3 } })).statusCode).toBe(401)
  })
})

describe('admin scan list (FR-007, FR-008, FR-009)', () => {
  it('lists 50 scans per page, newest first, with the total', async () => {
    const { app, devices } = setup()
    const ids: string[] = []
    for (let i = 0; i < 120; i++) ids.push(devices.create(laptop).device_id)
    const cookie = cookieOf(await login(app))
    const page = async (n: number) => (await app.inject({ method: 'GET', url: `/api/admin/scans?page=${n}`, headers: { cookie } })).json()
    const p1 = await page(1)
    expect(isPage(p1).ok).toBe(true)
    expect(p1).toMatchObject({ total: 120, page: 1, page_size: 50 })
    expect(p1.scans.map((s: { device_id: string }) => s.device_id)).toEqual(ids.slice(-50).reverse())
    expect(p1.scans[0]).toEqual({
      device_id: ids[119],
      created_at: expect.any(String),
      os_family: null,
      manufacturer: 'Example Manufacturer',
      model: 'Example Laptop 14',
      scan_status: 'complete',
    })
    const p3 = await page(3)
    expect(p3.scans).toHaveLength(20)
    expect(p3.scans.at(-1).device_id).toBe(ids[0])
    expect((await page(4)).scans).toEqual([])
  })

  it('shows the system when present and falls back to the model code or null', async () => {
    const { app, devices } = setup()
    devices.create({ ...laptop, os: { ...laptop.os, family: 'linux' } })
    devices.create({ ...laptop, identity: { ...laptop.identity, manufacturer: null, product_version: null, model: '20L5CTO1WW' } })
    devices.create({ ...laptop, identity: { ...laptop.identity, product_version: null, model: null } })
    const cookie = cookieOf(await login(app))
    const { scans } = (await app.inject({ method: 'GET', url: '/api/admin/scans', headers: { cookie } })).json()
    expect(scans.map((s: { os_family: unknown; manufacturer: unknown; model: unknown }) => [s.os_family, s.manufacturer, s.model])).toEqual([
      [null, 'Example Manufacturer', null],
      [null, null, '20L5CTO1WW'],
      ['linux', 'Example Manufacturer', 'Example Laptop 14'],
    ])
  })

  it('treats a malformed page number as the first page', async () => {
    const { app, devices } = setup()
    devices.create(laptop)
    const cookie = cookieOf(await login(app))
    for (const q of ['0', '-1', 'abc', '1e3']) {
      const res = await app.inject({ method: 'GET', url: `/api/admin/scans?page=${q}`, headers: { cookie } })
      expect(res.json()).toMatchObject({ page: 1, total: 1 })
    }
  })

  it('sends no-store and noindex on every admin response', async () => {
    const { app } = setup()
    for (const res of [await login(app, USER, 'wrong'), await login(app), await app.inject({ method: 'GET', url: '/api/admin/scans' })]) {
      expect(res.headers['cache-control']).toBe('no-store')
      expect(res.headers['x-robots-tag']).toContain('noindex')
    }
  })

  it('offers exactly five admin routes, none of which edits or deletes (FR-008, FR-011)', async () => {
    const { app } = setup()
    await app.ready()
    const admin: [string, string][] = [
      ['POST', '/api/admin/login'],
      ['POST', '/api/admin/logout'],
      ['GET', '/api/admin/session'],
      ['GET', '/api/admin/scans'],
      ['GET', '/api/admin/scans/:id'],
    ]
    for (const [method, url] of admin) expect(app.hasRoute({ method, url })).toBe(true)
    for (const method of ['DELETE', 'PUT', 'PATCH'])
      for (const [, url] of admin) expect(app.hasRoute({ method, url })).toBe(false)
    // Exactly these admin routes and nothing else (AC-013, AC-026): turning the admin area on adds
    // five registered paths to the public ones.
    const { app: off } = setup({ admin: null })
    await off.ready()
    const paths = (a: App) => a.printRoutes().match(/\(/g)!.length
    expect(paths(app) - paths(off)).toBe(admin.length)
  })

  it('logs no credentials, tokens or device IDs (FR-009)', async () => {
    const lines: string[] = []
    const { app, devices } = setup({ logLines: lines })
    const id = devices.create(laptop).device_id
    const res = await login(app)
    const token = cookieOf(res).split('=')[1]!
    await app.inject({ method: 'GET', url: '/api/admin/scans', headers: { cookie: cookieOf(res) } })
    await login(app, USER, 'a-wrong-password')
    const log = lines.join('')
    expect(log).toContain('/api/admin/scans') // the route pattern is logged
    for (const secret of [PASSWORD, 'a-wrong-password', token, id, '203.0.113.1']) expect(log).not.toContain(secret)
  })
})

describe('cookies for visitors (FR-012)', () => {
  it('sets no cookie on the public routes, even with the admin area on', async () => {
    const { app, devices } = setup()
    const id = devices.create(laptop).device_id
    for (const res of [
      await app.inject({ method: 'POST', url: '/api/sessions' }),
      await app.inject({ method: 'GET', url: `/api/devices/${id}` }),
      await app.inject({ method: 'POST', url: '/api/devices', payload: laptop }),
      await app.inject({ method: 'GET', url: '/downloads/leaaf-scanner.exe' }),
      await app.inject({ method: 'GET', url: '/nothing-here' }),
    ])
      expect(res.headers['set-cookie']).toBeUndefined()
  })
})

describe('scan details and AI status (FR-013 to FR-017)', () => {
  const isDetail = createValidator(AdminScanDetail)

  it('returns the full scan with its AI results and recorded fallbacks', async () => {
    const { app, devices, db, clock } = setup({ insights: true })
    const id = devices.create(laptop).device_id
    const other = devices.create(laptop).device_id
    // The caches the category and step services keep (their columns that the admin page reads).
    db.exec('CREATE TABLE category_cache (device_id TEXT, intended_use TEXT, prompt_hash TEXT, output TEXT, generated_at TEXT)')
    db.exec('CREATE TABLE step_cache (device_id TEXT, intended_use TEXT, option_id TEXT, prompt_hash TEXT, output TEXT, generated_at TEXT)')
    const cat = db.prepare("INSERT INTO category_cache VALUES (?, ?, 'h', '{}', ?)")
    cat.run(id, 'office', '2026-11-21T10:00:00Z')
    cat.run(id, 'gaming', '2026-11-21T10:05:00Z')
    cat.run(other, 'office', '2026-11-21T10:06:00Z')
    const step = db.prepare("INSERT INTO step_cache VALUES (?, 'office', ?, 'h', '{}', '2026-11-21T10:01:00Z')")
    step.run(id, 'ssd-swap')
    step.run(id, 'ram-add')
    const log = createFallbackLog(db, () => new Date(clock.t))
    log.record({ device_id: id, intended_use: 'office', call: 'steps', option_id: 'battery-swap', reason: 'timeout' })
    clock.t += 60_000
    log.record({ device_id: id, intended_use: 'study', call: 'categories', option_id: null, reason: 'no_llm' })
    log.record({ device_id: other, intended_use: 'office', call: 'categories', option_id: null, reason: 'auth' })

    const cookie = cookieOf(await login(app))
    const res = await app.inject({ method: 'GET', url: `/api/admin/scans/${id}`, headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const body = res.json()
    expect(isDetail(body).ok).toBe(true)
    expect(body.device.scan).toEqual(laptop)
    expect(body.ai.categories).toEqual([
      { intended_use: 'gaming', generated_at: '2026-11-21T10:05:00Z' },
      { intended_use: 'office', generated_at: '2026-11-21T10:00:00Z' },
    ])
    expect(body.ai.steps).toEqual([{ intended_use: 'office', plans: 2 }])
    expect(body.ai.fallbacks.map((f: { reason: string; call: string }) => [f.call, f.reason])).toEqual([
      ['categories', 'no_llm'],
      ['steps', 'timeout'],
    ])
    expect(body.ai.fallbacks[1]).toMatchObject({ intended_use: 'office', option_id: 'battery-swap' })
  })

  it('stores no prompt, answer or message text with a fallback', () => {
    const db = new DatabaseSync(':memory:')
    createFallbackLog(db).record({ device_id: 'q3Xk9vT2mB7pLw0cZr1sEa', intended_use: 'office', call: 'steps', option_id: 'x', reason: 'timeout' })
    const columns = (db.prepare('PRAGMA table_info(ai_fallbacks)').all() as { name: string }[]).map((c) => c.name)
    expect(columns).toEqual(['device_id', 'intended_use', 'call', 'option_id', 'reason', 'created_at'])
  })

  it('answers 401 without a session and 404 for unknown or malformed IDs', async () => {
    const { app, devices } = setup({ insights: true })
    const id = devices.create(laptop).device_id
    expect((await app.inject({ method: 'GET', url: `/api/admin/scans/${id}` })).statusCode).toBe(401)
    const cookie = cookieOf(await login(app))
    for (const bad of ['AAAAAAAAAAAAAAAAAAAAAA', 'not-an-id', '..%2F..%2Fetc'])
      expect((await app.inject({ method: 'GET', url: `/api/admin/scans/${bad}`, headers: { cookie } })).statusCode).toBe(404)
  })

  it('works before any AI table exists', async () => {
    const { app, devices } = setup({ insights: true })
    const id = devices.create(laptop).device_id
    const cookie = cookieOf(await login(app))
    const detail = (await app.inject({ method: 'GET', url: `/api/admin/scans/${id}`, headers: { cookie } })).json()
    expect(detail.ai).toEqual({ categories: [], steps: [], fallbacks: [] })
    const page = (await app.inject({ method: 'GET', url: '/api/admin/scans', headers: { cookie } })).json()
    expect(page.ai_usage).toEqual({ day: '2026-11-21', used: 0, cap: 200 })
  })

  it("shows today's AI calls against the daily cap", async () => {
    const { app, db } = setup({ insights: true })
    db.exec('CREATE TABLE llm_daily_usage (day TEXT PRIMARY KEY, calls INTEGER NOT NULL)')
    db.prepare('INSERT INTO llm_daily_usage VALUES (?, ?)').run('2026-11-20', 199)
    db.prepare('INSERT INTO llm_daily_usage VALUES (?, ?)').run('2026-11-21', 37)
    const cookie = cookieOf(await login(app))
    const page = (await app.inject({ method: 'GET', url: '/api/admin/scans', headers: { cookie } })).json()
    expect(page.ai_usage).toEqual({ day: '2026-11-21', used: 37, cap: 200 })
  })
})
