// Web prices (feature 019 T-002): part queries, allowlisted search, price extraction with the
// citation check, minimum offers, cache, route, and the ranking staying untouched.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import {
  API_ROUTES,
  checkWebPrice,
  createValidator,
  WebPriceList,
  type CategoryResult,
  type DeviceRecord,
  type DeviceScan,
  type Fact,
  type WebPriceList as WebPriceListT,
} from '@leaaf/shared'
import { buildApp } from '../src/app.ts'
import { createAssessmentService, loadWeights, type DeviceAssessment } from '../src/assessment/index.ts'
import { optionContext } from '../src/categories/service.ts'
import { createSqliteDeviceStore } from '../src/devices/store.ts'
import { loadImpactTable } from '../src/impact/table.ts'
import { LlmError, type JsonRequest, type LlmClient } from '../src/llm/index.ts'
import { createPriceService, createSqlitePriceCache, loadPriceSources, PRICE_CACHE_DAYS } from '../src/prices/index.ts'
import { amountsInText, checkOffers, type PriceAnswer } from '../src/prices/extract.ts'
import { partFor } from '../src/prices/part.ts'
import { onDomains } from '../src/prices/sources.ts'
import { createRetriever, readCorpus, writeIndex } from '../src/retrieval/index.ts'
import type { SearchBudget } from '../src/search/cache.ts'
import { createLangSearchProvider } from '../src/search/langsearch.ts'
import { createTinyFishProvider, TINYFISH_SEARCH_URL } from '../src/search/tinyfish.ts'
import { SearchError, type SearchHit, type SearchProvider, type SearchQuery } from '../src/search/types.ts'
import { createSqliteSessionStore } from '../src/sessions/store.ts'

const read = <T>(url: URL): T => JSON.parse(readFileSync(url, 'utf8')) as T
const baseScan = read<DeviceScan>(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url))
const sampleCategories = read<CategoryResult>(new URL('../../shared/fixtures/categories.example-laptop-14.office.json', import.meta.url))
/** Matches the fixture corpus's Acme Book 14 (model evidence), with DDR4 memory. */
const acmeScan: DeviceScan = {
  ...baseScan,
  identity: { ...baseScan.identity, manufacturer: 'Acme', model: 'Book 14', product_version: null, system_family: null },
}
const record = (scan: DeviceScan = acmeScan): DeviceRecord => ({ device_id: 'q3Xk9vT2mB7pLw0cZr1sEa', created_at: '2026-11-22T10:00:00.000Z', scan })
const impactTable = loadImpactTable()
const DOMAINS = loadPriceSources()
const isList = createValidator(WebPriceList)

const db0 = new DatabaseSync(':memory:')
writeIndex(db0, readCorpus(fileURLToPath(new URL('./fixtures/corpus/', import.meta.url))))
const assessments = createAssessmentService({ retriever: createRetriever(db0), extractor: null, impactTable, weights: loadWeights() })
const shownCategories = (_scan: DeviceScan, input: DeviceAssessment): CategoryResult => ({
  ...structuredClone(sampleCategories),
  device_id: input.assessment.device_id,
  intended_use: input.assessment.intended_use,
})

const hit = (url: string, text: string, title = 'Preisvergleich'): SearchHit => ({ title, url, text, published: null })
const ssdPage = hit('https://geizhals.at/kingston-nv3-500gb-a1.html', 'Kingston NV3 500GB M.2 2280 NVMe: ab € 39,90 bei Shop A, € 44,99 bei Shop B, € 52,00 bei Shop C. Versand € 4,99.')
const ramPage = hit('https://www.idealo.at/preisvergleich/ram-8gb.html', 'Kingston ValueRAM 8GB DDR4 SO-DIMM ab 21,49 € · 23,90 €')
const batteryPage = hit('https://geizhals.eu/acme-akku.html', 'Akku für Acme Book 14, 45 Wh: 59,90 € · 64,00 €')

/** Fake provider answering per query part; records the queries. */
function fakeSearch(answer: (q: SearchQuery) => SearchHit[] = (q) => (q.text.includes('SSD') ? [ssdPage] : q.text.includes('SO-DIMM') ? [ramPage] : [batteryPage])) {
  const queries: SearchQuery[] = []
  const provider: SearchProvider = {
    name: 'fake',
    async search(query) {
      queries.push(query)
      return answer(query)
    },
  }
  return { provider, queries }
}

/** Fake LLM: offers per page text, as the model would read them. */
const defaultOffers = (user: string): PriceAnswer['offers'] => {
  if (user.includes(' SSD'))
    return [
      { page: 1, title: 'Kingston NV3 500GB', price: 39.9, currency: 'EUR' },
      { page: 1, title: 'Kingston NV3 500GB', price: 44.99, currency: 'EUR' },
      { page: 1, title: 'Kingston NV3 500GB', price: 52, currency: 'EUR' },
    ]
  if (user.includes('SO-DIMM'))
    return [
      { page: 1, title: 'Kingston ValueRAM 8GB', price: 21.49, currency: 'EUR' },
      { page: 1, title: 'Kingston ValueRAM 8GB', price: 23.9, currency: 'EUR' },
    ]
  return [
    { page: 1, title: 'Akku Acme Book 14', price: 59.9, currency: 'EUR' },
    { page: 1, title: 'Akku Acme Book 14', price: 64, currency: 'EUR' },
  ]
}
function fakeLlm(offers: (user: string) => PriceAnswer['offers'] = defaultOffers) {
  const requests: JsonRequest<any>[] = []
  const llm: LlmClient = {
    async completeJson(request) {
      requests.push(request)
      return { value: { offers: offers(request.user) } as any, model: 'fake', attempts: 1, latency_ms: 1, usage: { prompt_tokens: 1, completion_tokens: 1 } }
    },
  }
  return { llm, requests }
}

const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

function setup(options: { search?: ReturnType<typeof fakeSearch>; llm?: ReturnType<typeof fakeLlm>; budget?: SearchBudget; now?: () => Date } = {}) {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const search = options.search ?? fakeSearch()
  const llm = options.llm ?? fakeLlm()
  const warnings: string[] = []
  const prices = createPriceService({
    search: search.provider,
    budget: options.budget ?? { reserve: () => true },
    llm: llm.llm,
    cache: createSqlitePriceCache(db, options.now),
    domains: DOMAINS,
    assessments,
    shownCategories,
    impactTable,
    timeoutMs: 2000,
    resultsPerQuery: 5,
    maxChars: 6000,
    warn: (m) => warnings.push(m),
  })
  return { db, prices, search, llm, warnings }
}

const valid = (list: WebPriceListT) => {
  expect(isList(list).ok).toBe(true)
  for (const p of list.prices) expect(checkWebPrice(p)).toEqual([])
  return list
}

describe('price sources (FR-003)', () => {
  it('loads the confirmed allowlist from config/price-sources.yaml', () => {
    expect(DOMAINS).toEqual(['geizhals.eu', 'geizhals.at', 'idealo.at', 'idealo.de'])
  })

  it('rejects a file without domains or with something that is not a domain', () => {
    const dir = mkdtempSync(join(tmpdir(), 'leaaf-prices-'))
    const files: [string, string][] = [['empty.yaml', 'domains: []'], ['url.yaml', 'domains: ["https://geizhals.at/"]']]
    for (const [name, body] of files) {
      writeFileSync(join(dir, name), body)
      expect(() => loadPriceSources(join(dir, name))).toThrow(/price-sources.yaml/)
    }
  })

  it('accepts the domains and their subdomains only', () => {
    expect(onDomains('https://www.idealo.de/x', DOMAINS)).toBe(true)
    expect(onDomains('https://geizhals.at/a1.html', DOMAINS)).toBe(true)
    expect(onDomains('https://geizhals.at.evil.example/', DOMAINS)).toBe(false)
    expect(onDomains('https://notidealo.de/', DOMAINS)).toBe(false)
    expect(onDomains('ftp://geizhals.at/', DOMAINS)).toBe(false)
  })
})

describe('part queries (FR-001)', () => {
  const options = Object.fromEntries(sampleCategories.categories.flatMap((c) => c.options).map((o) => [o.option_id, o]))
  const partOf = async (optionId: string, scan: DeviceScan = acmeScan, facts: Fact[] = []) => {
    const input = await assessments.assessDevice(record(scan), 'office')
    const withFacts = { ...input, facts: { ...input.facts, facts } }
    return partFor(options[optionId]!, optionContext(scan, withFacts, impactTable), withFacts)?.label ?? null
  }
  const slots = (form_factor: string, iface: string): Fact => ({ key: 'storage_slots', value: [{ form_factor, interface: iface }], source_passage_ids: ['p1'] }) as Fact

  it('names the SSD, RAM module and battery the impact table prices, with nothing from the scan but the model', async () => {
    // The fixture laptop has a SATA hard disk, so its upgrade gate plans a SATA SSD.
    expect(await partOf('ssd-swap')).toBe('500 GB 2.5" SATA SSD')
    expect(await partOf('ssd-swap', acmeScan, [slots('m2_2280', 'nvme')])).toBe('500 GB M.2 2280 NVMe SSD')
    expect(await partOf('ssd-swap', acmeScan, [slots('m2_2280', 'sata')])).toBe('500 GB M.2 2280 SATA SSD')
    expect(await partOf('ram-add')).toBe('8 GB DDR4 SO-DIMM')
    expect(await partOf('battery-swap')).toBe('Acme Book 14 Akku')
  })

  it('prices no part it cannot name: soldered memory types, other kinds and unsuitable options', async () => {
    expect(await partOf('ram-add', { ...acmeScan, memory: { ...acmeScan.memory, type: 'lpddr4x' } })).toBeNull()
    expect(await partOf('ram-add', { ...acmeScan, memory: { ...acmeScan.memory, type: null } })).toBeNull()
    expect(await partOf('donate')).toBeNull()
    expect(await partOf('gpu-add')).toBeNull()
  })
})

describe('price extraction checks (FR-003)', () => {
  const part = { kind: 'ssd' as const, label: '500 GB M.2 NVMe SSD' }
  const offer = (price: number, currency = 'EUR', page = 1) => ({ page, title: 'Kingston NV3', price, currency })

  it('reads amounts in German and English notation', () => {
    const amounts = amountsInText('ab € 39,90 · 1.099,00 € · €52.90 · 44,– €')
    for (const cents of [3990, 109900, 5290, 4400]) expect(amounts.has(cents)).toBe(true)
  })

  it('keeps only EUR prices from allowlisted pages that appear in the page text', () => {
    const usd = hit('https://geizhals.at/usd.html', 'Price: $39.90 USD')
    const other = hit('https://shop.example/ssd', 'Kingston NV3 € 29,90')
    const kept = checkOffers({ offers: [offer(39.9), offer(41), offer(39.9, 'USD', 2), offer(29.9, 'EUR', 3), offer(39.9, 'EUR', 9)] }, [ssdPage, usd, other], part, DOMAINS)
    expect(kept).toEqual([{ title: 'Kingston NV3', url: ssdPage.url, publisher: 'geizhals.at', price_eur: 39.9 }])
  })

  it('drops implausible amounts such as shipping and duplicates of the same offer', () => {
    expect(checkOffers({ offers: [offer(4.99), offer(39.9), offer(39.9)] }, [ssdPage], part, DOMAINS).map((o) => o.price_eur)).toEqual([39.9])
  })
})

describe('web prices (AC-001, AC-003)', () => {
  it('gives each SSD, RAM and battery option a range with the offer count, sources and date', async () => {
    const { prices } = setup()
    const list = valid(await prices(record(), 'office'))
    expect(list.prices.map((p) => p.option_id)).toEqual(['ssd-swap', 'ram-add', 'battery-swap'])
    expect(list.prices[0]).toMatchObject({ part: '500 GB 2.5" SATA SSD', low_eur: 39.9, high_eur: 52, offer_count: 3 })
    expect(list.prices[0]!.offers.every((o) => o.url === ssdPage.url && o.publisher === 'geizhals.at')).toBe(true)
    expect(list.prices[0]!.retrieved_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('searches only the part on the allowlisted sites', async () => {
    const { prices, search } = setup()
    await prices(record(), 'office')
    expect(search.queries.map((q) => q.text)).toEqual(['500 GB 2.5" SATA SSD', '8 GB DDR4 SO-DIMM', 'Acme Book 14 Akku'])
    expect(search.queries.every((q) => q.includeDomains === DOMAINS)).toBe(true)
  })

  it('shows no web price with only one usable offer, USD offers or pages off the allowlist', async () => {
    const search = fakeSearch((q) => (q.text.includes('SSD') ? [ssdPage, hit('https://amazon.example/ssd', 'NV3 € 30,00')] : q.text.includes('SO-DIMM') ? [ramPage] : [batteryPage]))
    const llm = fakeLlm((user) => {
      if (user.includes(' SSD')) return [{ page: 1, title: 'NV3', price: 39.9, currency: 'EUR' }, { page: 2, title: 'NV3', price: 30, currency: 'EUR' }]
      if (user.includes('SO-DIMM')) return [{ page: 1, title: 'RAM', price: 21.49, currency: 'USD' }, { page: 1, title: 'RAM', price: 23.9, currency: 'USD' }]
      return [{ page: 1, title: 'Akku', price: 59.9, currency: 'EUR' }]
    })
    const list = valid(await setup({ search, llm }).prices(record(), 'office'))
    expect(list.prices).toEqual([])
    // The page off the allowlist never reached the LLM.
    expect(llm.requests[0]!.user).not.toContain('amazon.example')
  })

  it('ignores battery pages that do not name the exact model', async () => {
    const search = fakeSearch((q) => (q.text.includes('Akku') ? [hit('https://geizhals.eu/b.html', 'Akku für Acme Book 145: 59,90 € · 64,00 €')] : []))
    const { prices, llm } = setup({ search })
    expect((await prices(record(), 'office')).prices).toEqual([])
    expect(llm.requests).toHaveLength(0)
  })
})

describe('cache, cap and failures (AC-004)', () => {
  it('reuses a part price for 7 days, then searches again', async () => {
    let now = new Date('2026-11-22T10:00:00Z')
    const { prices, search } = setup({ now: () => now })
    await prices(record(), 'office')
    expect(search.queries).toHaveLength(3)
    now = new Date(now.getTime() + (PRICE_CACHE_DAYS * 24 - 1) * 3600_000)
    await prices(record(), 'study')
    expect(search.queries).toHaveLength(3)
    now = new Date(now.getTime() + 2 * 3600_000)
    const list = await prices(record(), 'office')
    expect(search.queries).toHaveLength(6)
    expect(list.prices[0]!.retrieved_on).toBe(now.toISOString().slice(0, 10))
  })

  it('stops searching at the shared daily cap', async () => {
    const { prices, search, warnings } = setup({ budget: { reserve: () => false } })
    expect((await prices(record(), 'office')).prices).toEqual([])
    expect(search.queries).toHaveLength(0)
    expect(warnings[0]).toMatch(/daily web search limit/)
  })

  it('does not cache failed searches or extractions', async () => {
    let fail = true
    const search = fakeSearch((q) => {
      if (fail) throw new SearchError('unavailable', 'down')
      return q.text.includes('SSD') ? [ssdPage] : []
    })
    const { prices } = setup({ search })
    expect((await prices(record(), 'office')).prices).toEqual([])
    fail = false
    expect((await prices(record(), 'office')).prices.map((p) => p.option_id)).toEqual(['ssd-swap'])

    const broken: LlmClient = { completeJson: async () => { throw new LlmError('timeout', 'slow') } }
    const second = setup({ llm: { llm: broken, requests: [] } })
    expect((await second.prices(record(), 'office')).prices).toEqual([])
    expect(second.db.prepare('SELECT COUNT(*) AS n FROM web_price_cache').get()).toEqual({ n: 0 })
  })
})

describe('prices route (AC-002)', () => {
  function app(withPrices: boolean) {
    const db = new DatabaseSync(':memory:')
    databases.push(db)
    const devices = createSqliteDeviceStore(db)
    const server = buildApp({
      devices,
      sessions: createSqliteSessionStore(db),
      assessments,
      categorize: async (scan, input) => shownCategories(scan, input),
      ...(withPrices ? { prices: setup().prices } : {}),
      publicBaseUrl: 'https://leaaf.example',
    })
    return { server, id: devices.create(acmeScan).device_id }
  }

  it('answers the prices as JSON, and an empty list without web search', async () => {
    const on = app(true)
    const res = await on.server.inject({ method: 'GET', url: API_ROUTES.prices(on.id, 'office') })
    expect(res.statusCode).toBe(200)
    expect(valid(res.json()).prices).toHaveLength(3)
    const off = app(false)
    expect((await off.server.inject({ method: 'GET', url: API_ROUTES.prices(off.id, 'office') })).json()).toEqual({ device_id: off.id, intended_use: 'office', prices: [] })
  })

  it('rejects an unknown use and an unknown device', async () => {
    const { server, id } = app(true)
    expect((await server.inject({ method: 'GET', url: `/api/devices/${id}/prices?intended_use=mining` })).statusCode).toBe(400)
    expect((await server.inject({ method: 'GET', url: API_ROUTES.prices('AAAAAAAAAAAAAAAAAAAAAA', 'office') })).statusCode).toBe(404)
  })

  it('leaves the assessment and categories of the report exactly as without web prices', async () => {
    const report = async (withPrices: boolean) => {
      const { server, id } = app(withPrices)
      if (withPrices) await server.inject({ method: 'GET', url: API_ROUTES.prices(id, 'office') })
      const body = (await server.inject({ method: 'GET', url: API_ROUTES.reportStream(id, 'office') })).body
      // Each app has its own device and clock; everything ranked from the payload must be equal.
      return body.replace(/"(device_id|created_at|generated_at)":"[^"]+"/g, '"$1":"-"')
    }
    expect(await report(true)).toBe(await report(false))
  })
})

describe('search providers pass the domain filter and locale', () => {
  const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

  it('LangSearch sends includeDomains', async () => {
    let body: any
    const transport = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string)
      return response({ code: 200, data: { webPages: { value: [] } } })
    }) as unknown as typeof fetch
    await createLangSearchProvider('k', transport).search({ text: 'q', maxResults: 5, maxChars: 500, includeDomains: ['geizhals.at', 'idealo.de'] })
    expect(body.includeDomains).toEqual(['geizhals.at', 'idealo.de'])
  })

  it('TinyFish sends include_domains, location and language', async () => {
    let url = ''
    const transport = (async (u: string) => {
      url = u
      return response({ results: [] })
    }) as unknown as typeof fetch
    await createTinyFishProvider('k', transport).search({ text: 'q', maxResults: 5, maxChars: 500, includeDomains: ['geizhals.at', 'idealo.de'], locale: { country: 'AT', language: 'de' } })
    expect(url).toBe(`${TINYFISH_SEARCH_URL}?query=q&include_domains=geizhals.at%2Cidealo.de&location=AT&language=de`)
  })
})
