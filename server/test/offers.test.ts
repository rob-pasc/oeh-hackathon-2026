// Local offers and the shared town (feature 019 T-003, T-004): offer queries and checks, cache per
// town and kind, the location routes, Nominatim's rate limit and cache, and that no coordinates
// are stored or logged.
import { readFileSync } from 'node:fs'
import { Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import {
  API_ROUTES,
  createValidator,
  LocalOfferList,
  type CategoryResult,
  type DeviceRecord,
  type DeviceScan,
} from '@leaaf/shared'
import { buildApp, REQUEST_LOG_SERIALIZERS } from '../src/app.ts'
import { createAssessmentService, loadWeights, type DeviceAssessment } from '../src/assessment/index.ts'
import { createSqliteDeviceStore } from '../src/devices/store.ts'
import { loadImpactTable } from '../src/impact/table.ts'
import { LlmError, type JsonRequest, type LlmClient } from '../src/llm/index.ts'
import { createNominatim, townOf, type Geocoder } from '../src/location/nominatim.ts'
import { createSqliteLocationStore } from '../src/location/store.ts'
import { checkLocalOffers, offerQuery } from '../src/offers/extract.ts'
import { createOfferService, OFFER_CACHE_DAYS, offerKind, type OfferSearch } from '../src/offers/service.ts'
import { purgeExpiredScans } from '../src/retention.ts'
import { createRetriever, readCorpus, writeIndex } from '../src/retrieval/index.ts'
import { SearchError, type SearchHit, type SearchProvider, type SearchQuery } from '../src/search/types.ts'
import { createSqliteSessionStore } from '../src/sessions/store.ts'

const read = <T>(url: URL): T => JSON.parse(readFileSync(url, 'utf8')) as T
const baseScan = read<DeviceScan>(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url))
const sampleCategories = read<CategoryResult>(new URL('../../shared/fixtures/categories.example-laptop-14.office.json', import.meta.url))
const acmeScan: DeviceScan = { ...baseScan, identity: { ...baseScan.identity, manufacturer: 'Acme', model: 'Book 14', product_version: null, system_family: null } }
const record = (id = 'q3Xk9vT2mB7pLw0cZr1sEa'): DeviceRecord => ({ device_id: id, created_at: '2026-11-22T10:00:00.000Z', scan: acmeScan })
const isList = createValidator(LocalOfferList)
const options = Object.fromEntries(sampleCategories.categories.flatMap((c) => c.options).map((o) => [o.option_id, o]))

const corpusDb = new DatabaseSync(':memory:')
writeIndex(corpusDb, readCorpus(fileURLToPath(new URL('./fixtures/corpus/', import.meta.url))))
const assessments = createAssessmentService({ retriever: createRetriever(corpusDb), extractor: null, impactTable: loadImpactTable(), weights: loadWeights() })
const shownCategories = (_scan: DeviceScan, input: DeviceAssessment): CategoryResult => ({ ...structuredClone(sampleCategories), device_id: input.assessment.device_id })

const page = (url: string, title: string, text: string): SearchHit => ({ url, title, text, published: null })
const cafes = page(
  'https://www.repaircafe.at/termine',
  'Repair Cafés in Österreich',
  'Repair Café Wien Margareten, Wien – jeden ersten Samstag. Repair Café Graz, Graz. Reparaturcafé Linz, Linz. Repair Café Dornbirn im Kulturhaus Dornbirn.',
)

function fakeSearch(answer: (q: SearchQuery) => SearchHit[] = () => [cafes]) {
  const queries: SearchQuery[] = []
  const provider: SearchProvider = { name: 'fake', search: async (q) => (queries.push(q), answer(q)) }
  return { provider, queries }
}

type Offer = { page: number; name: string; town: string | null }
const austrianCafes: Offer[] = [
  { page: 1, name: 'Repair Café Wien Margareten', town: 'Wien' },
  { page: 1, name: 'Repair Café Graz', town: 'Graz' },
  { page: 1, name: 'Reparaturcafé Linz', town: 'Linz' },
  { page: 1, name: 'Repair Café Dornbirn', town: 'Dornbirn' },
]
function fakeLlm(answer: (request: JsonRequest<any>) => Offer[] = () => austrianCafes) {
  const requests: JsonRequest<any>[] = []
  const llm: LlmClient = {
    async completeJson(request) {
      requests.push(request)
      return { value: { offers: answer(request) } as any, model: 'fake', attempts: 1, latency_ms: 1, usage: { prompt_tokens: 1, completion_tokens: 1 } }
    },
  }
  return { llm, requests }
}

const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

function setup(opts: { search?: ReturnType<typeof fakeSearch>; llm?: ReturnType<typeof fakeLlm>; web?: false; now?: () => Date } = {}) {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const search = opts.search ?? fakeSearch()
  const llm = opts.llm ?? fakeLlm()
  const locations = createSqliteLocationStore(db)
  const web: OfferSearch = { search: search.provider, budget: { reserve: () => true }, llm: llm.llm, timeoutMs: 2000, resultsPerQuery: 5, maxChars: 6000 }
  const offers = createOfferService(db, {
    web: opts.web === false ? null : web,
    assessments,
    shownCategories,
    townOf: locations.town,
    ...(opts.now ? { now: opts.now } : {}),
  })
  return { db, offers, locations, search, llm }
}

describe('offer kinds and queries (FR-005, FR-010)', () => {
  it('lists offers for repair, pass it on and recycle options only', () => {
    expect(offerKind(options['battery-swap']!)).toBe('repair')
    expect(offerKind(options['donate']!)).toBe('pass_on')
    expect(offerKind(options['recycle']!)).toBe('recycle')
    expect(offerKind(options['ssd-swap']!)).toBeNull()
    expect(offerKind(options['copy-system']!)).toBeNull()
  })

  it('searches the kind with the town, or Austria without one', () => {
    expect(offerQuery('repair', null)).toBe('Repair Café Laptop Reparatur Österreich')
    expect(offerQuery('pass_on', 'Dornbirn')).toBe('Laptop spenden Dornbirn')
    expect(offerQuery('recycle', 'Graz')).toBe('Elektroaltgeräte Sammelstelle Graz')
  })

  it('keeps only places the page names, at most three, with a town only when the page names it', () => {
    const kept = checkLocalOffers(
      {
        offers: [
          { page: 1, name: 'Repair Café Graz', town: 'Graz' },
          { page: 1, name: 'Repair Café Salzburg', town: 'Salzburg' },
          { page: 1, name: 'Repair Café Graz', town: 'Graz' },
          { page: 2, name: 'Repair Café Wien', town: 'Wien' },
          { page: 1, name: 'Reparaturcafé Linz', town: 'Steyr' },
          { page: 1, name: 'Repair Café Dornbirn', town: 'Dornbirn' },
          { page: 1, name: 'Repair Café Wien Margareten', town: 'Wien' },
        ],
      },
      [cafes],
    )
    expect(kept).toEqual([
      { name: 'Repair Café Graz', town: 'Graz', url: cafes.url, publisher: 'repaircafe.at' },
      { name: 'Reparaturcafé Linz', town: null, url: cafes.url, publisher: 'repaircafe.at' },
      { name: 'Repair Café Dornbirn', town: 'Dornbirn', url: cafes.url, publisher: 'repaircafe.at' },
    ])
  })
})

describe('local offers (AC-005, AC-010)', () => {
  it('lists up to three Austrian offers for a repair option without a shared location', async () => {
    const { offers, search, llm } = setup()
    const list = await offers(record(), 'office', 'battery-swap')
    expect(isList(list).ok).toBe(true)
    expect(list).toMatchObject({ option_id: 'battery-swap', kind: 'repair', town: null })
    expect(list!.offers.map((o) => o.name)).toEqual(['Repair Café Wien Margareten', 'Repair Café Graz', 'Reparaturcafé Linz'])
    expect(list!.retrieved_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(search.queries[0]).toMatchObject({ text: 'Repair Café Laptop Reparatur Österreich', locale: { country: 'AT', language: 'de' } })
    expect(llm.requests[0]!.system).toContain('in Austria')
  })

  it('searches the shared town, with the town name and nothing else', async () => {
    const { offers, locations, search, llm } = setup()
    locations.set(record().device_id, 'Dornbirn')
    const list = await offers(record(), 'office', 'donate')
    expect(list).toMatchObject({ kind: 'pass_on', town: 'Dornbirn' })
    expect(search.queries[0]!.text).toBe('Laptop spenden Dornbirn')
    expect(search.queries[0]!.locale).toBeUndefined()
    expect(llm.requests[0]!.system).toContain('in or near Dornbirn')
  })

  it('answers null for an option without local offers or an unknown option', async () => {
    const { offers } = setup()
    expect(await offers(record(), 'office', 'ssd-swap')).toBeNull()
    expect(await offers(record(), 'office', 'no-such-option')).toBeNull()
  })

  it('caches per kind and town for 7 days, so devices in the same town share a search', async () => {
    let now = new Date('2026-11-22T10:00:00Z')
    const { offers, locations, search } = setup({ now: () => now })
    await offers(record(), 'office', 'battery-swap')
    await offers(record('AAAAAAAAAAAAAAAAAAAAAA'), 'study', 'battery-swap')
    expect(search.queries).toHaveLength(1)
    locations.set(record().device_id, 'Graz')
    await offers(record(), 'office', 'battery-swap')
    await offers(record(), 'office', 'recycle')
    expect(search.queries).toHaveLength(3)
    now = new Date(now.getTime() + OFFER_CACHE_DAYS * 24 * 3600_000)
    await offers(record(), 'office', 'battery-swap')
    expect(search.queries).toHaveLength(4)
  })

  it('shows no offers and caches nothing when the search or the LLM fails, or web search is off', async () => {
    const down = setup({ search: fakeSearch(() => { throw new SearchError('timeout', 'slow') }) })
    expect((await down.offers(record(), 'office', 'battery-swap'))!.offers).toEqual([])
    const broken = setup({ llm: { llm: { completeJson: async () => { throw new LlmError('unavailable', 'down') } }, requests: [] } })
    expect(await broken.offers(record(), 'office', 'battery-swap')).toMatchObject({ offers: [], retrieved_on: null })
    expect(broken.db.prepare('SELECT COUNT(*) AS n FROM local_offer_cache').get()).toEqual({ n: 0 })
    const off = setup({ web: false })
    expect(await off.offers(record(), 'office', 'recycle')).toMatchObject({ kind: 'recycle', offers: [], retrieved_on: null })
  })
})

describe('Nominatim (AC-009)', () => {
  const answer = (address: Record<string, string>) => new Response(JSON.stringify({ address }), { status: 200, headers: { 'content-type': 'application/json' } })

  function nominatim(respond: (url: string) => Response = () => answer({ town: 'Dornbirn', country: 'Österreich' })) {
    const clock = { t: 0 }
    const calls: { url: string; at: number; headers: Record<string, string> }[] = []
    const geocoder = createNominatim({
      userAgent: 'leaaf (https://leaaf.example)',
      fetch: (async (url: string, init: RequestInit) => {
        calls.push({ url, at: clock.t, headers: init.headers as Record<string, string> })
        return respond(url)
      }) as unknown as typeof fetch,
      now: () => clock.t,
      sleep: async (ms) => void (clock.t += ms),
    })
    return { geocoder, calls, clock }
  }

  it('asks for the rounded pair with the identifying User-Agent and reads the town', async () => {
    const { geocoder, calls } = nominatim()
    expect(await geocoder.town(47.412345, 9.744321)).toBe('Dornbirn')
    expect(calls[0]!.url).toBe('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=47.41&lon=9.74&zoom=10&accept-language=de')
    expect(calls[0]!.headers['user-agent']).toBe('leaaf (https://leaaf.example)')
  })

  it('calls at most once per second overall and answers a repeated rounded pair from the cache', async () => {
    const { geocoder, calls } = nominatim()
    await Promise.all([geocoder.town(47.41, 9.74), geocoder.town(48.21, 16.37), geocoder.town(47.4111, 9.7399)])
    expect(calls).toHaveLength(2)
    expect(calls[1]!.at - calls[0]!.at).toBeGreaterThanOrEqual(1000)
  })

  it('reads the most specific settlement and answers null on failures, which are not cached', async () => {
    expect(townOf({ address: { city: 'Wien', state: 'Wien' } })).toBe('Wien')
    expect(townOf({ address: { village: 'Schwarzach' } })).toBe('Schwarzach')
    expect(townOf({ address: { state: 'Vorarlberg' } })).toBeNull()
    expect(townOf({ error: 'Unable to geocode' })).toBeNull()
    let fail = true
    const { geocoder, calls } = nominatim(() => (fail ? new Response('busy', { status: 503 }) : answer({ city: 'Graz' })))
    expect(await geocoder.town(47.07, 15.44)).toBeNull()
    fail = false
    expect(await geocoder.town(47.07, 15.44)).toBe('Graz')
    expect(calls).toHaveLength(2)
  })
})

describe('location routes (AC-006 to AC-008)', () => {
  function app(geocoder: Geocoder | null = { town: async () => 'Dornbirn' }) {
    const db = new DatabaseSync(':memory:')
    databases.push(db)
    const devices = createSqliteDeviceStore(db)
    const store = createSqliteLocationStore(db)
    const logLines: string[] = []
    const received: [number, number][] = []
    const recording: Geocoder | null = geocoder && {
      town: async (lat, lon) => {
        received.push([lat, lon])
        return geocoder.town(lat, lon)
      },
    }
    const offers = setup().offers
    const server = buildApp({
      devices,
      sessions: createSqliteSessionStore(db),
      offers: (r, use, id) => offers({ ...r }, use, id).then((l) => l && { ...l, town: store.town(r.device_id) }),
      locations: { store, geocoder: recording },
      publicBaseUrl: 'https://leaaf.example',
      logger: {
        level: 'info',
        serializers: REQUEST_LOG_SERIALIZERS,
        stream: new Writable({
          write(chunk, _enc, done) {
            logLines.push(String(chunk))
            done()
          },
        }),
      },
    })
    const device = devices.create(acmeScan)
    return { db, server, store, id: device.device_id, logLines, received }
  }
  const share = (server: ReturnType<typeof app>['server'], id: string, payload: unknown) =>
    server.inject({ method: 'POST', url: API_ROUTES.location(id), payload: payload as object })

  it('turns the coordinates into a town, stores only the town and returns to Austria-wide on delete', async () => {
    const { db, server, store, id, received } = app()
    const res = await share(server, id, { lat: 47.41237, lon: 9.74391 })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ town: 'Dornbirn' })
    expect(received).toEqual([[47.41237, 9.74391]])
    expect(store.town(id)).toBe('Dornbirn')
    expect((await server.inject({ method: 'GET', url: API_ROUTES.location(id) })).json()).toEqual({ town: 'Dornbirn' })
    expect(db.prepare('SELECT * FROM device_locations').all()).toEqual([{ device_id: id, town: 'Dornbirn', created_at: expect.any(String) }])
    const reset = await server.inject({ method: 'DELETE', url: API_ROUTES.location(id) })
    expect(reset.json()).toEqual({ town: null })
    expect(store.town(id)).toBeNull()
  })

  it('stores and logs no coordinates (AC-007)', async () => {
    const { db, server, id, logLines } = app()
    await share(server, id, { lat: 47.41237, lon: 9.74391 })
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name)
    const dump = tables.map((t) => JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all())).join('\n')
    expect(logLines.length).toBeGreaterThan(0)
    for (const text of [dump, logLines.join('\n')]) for (const fragment of ['47.4', '9.74', '9.7439']) expect(text).not.toContain(fragment)
  })

  it('keeps Austria-wide offers when no town is found or the lookup is off (AC-008)', async () => {
    for (const geocoder of [{ town: async () => null }, null]) {
      const { server, store, id } = app(geocoder)
      store.set(id, 'Graz')
      expect((await share(server, id, { lat: 47.41, lon: 9.74 })).json()).toEqual({ town: null })
      expect(store.town(id)).toBeNull()
    }
  })

  it('rejects invalid coordinates and unknown devices', async () => {
    const { server, id } = app()
    for (const body of [{ lat: 91, lon: 0 }, { lat: '47', lon: 9 }, { lat: 47, lon: 9, accuracy: 10 }, {}])
      expect((await share(server, id, body)).statusCode).toBe(400)
    expect((await share(server, 'AAAAAAAAAAAAAAAAAAAAAA', { lat: 47, lon: 9 })).statusCode).toBe(404)
    expect((await server.inject({ method: 'DELETE', url: API_ROUTES.location('AAAAAAAAAAAAAAAAAAAAAA') })).statusCode).toBe(404)
  })

  it('serves offers for the shared town and 404 for an option without offers', async () => {
    const { server, id } = app()
    await share(server, id, { lat: 47.41, lon: 9.74 })
    const res = await server.inject({ method: 'GET', url: API_ROUTES.optionOffers(id, 'battery-swap', 'office') })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ town: 'Dornbirn', kind: 'repair' })
    expect((await server.inject({ method: 'GET', url: API_ROUTES.optionOffers(id, 'ssd-swap', 'office') })).statusCode).toBe(404)
  })

  it('deletes the town with the scan after 30 days', () => {
    const { db, store, id } = app()
    store.set(id, 'Dornbirn')
    db.prepare('UPDATE devices SET created_at = ?').run('2026-01-01T00:00:00.000Z')
    purgeExpiredScans(db, new Date('2026-02-15T00:00:00.000Z'))
    expect(store.town(id)).toBeNull()
  })
})
