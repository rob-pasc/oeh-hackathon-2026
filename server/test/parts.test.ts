// Part lookup (feature 018): identifiers, corpus first, web fallback, the LLM citation check,
// caching, failure paths, and the route.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  API_ROUTES,
  checkPartLookupResult,
  createValidator,
  PartLookupResult,
  type DeviceRecord,
  type DeviceScan,
} from '@leaaf/shared'
import { buildApp } from '../src/app.ts'
import { createSqliteDeviceStore } from '../src/devices/store.ts'
import { LlmError, type JsonRequest, type LlmClient } from '../src/llm/index.ts'
import { normalizeChipName, scanParts } from '../src/parts/identify.ts'
import { createPartLookupService, createSqlitePartCache, type PartLookupDeps, type PartWebSearch } from '../src/parts/service.ts'
import { createRetriever, readCorpus, writeIndex } from '../src/retrieval/index.ts'
import { createSqliteSearchBudget, createSqliteSearchCache } from '../src/search/cache.ts'
import { providerChain } from '../src/search/config.ts'
import { SearchError, type SearchHit, type SearchProvider, type SearchQuery } from '../src/search/types.ts'
import { createSqliteSessionStore } from '../src/sessions/store.ts'

const FIXTURE_CORPUS = fileURLToPath(new URL('./fixtures/corpus/', import.meta.url))
const baseScan = JSON.parse(readFileSync(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url), 'utf8')) as DeviceScan
/** A model outside the fixture corpus, so only generic documents can serve its parts. */
const scan: DeviceScan = {
  ...baseScan,
  identity: { ...baseScan.identity, manufacturer: 'Acme', model: 'Book 99', product_version: 'Book 99', system_family: 'Acme Book' },
  cpu: { ...baseScan.cpu, name: 'Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz' },
  gpus: ['Intel(R) UHD Graphics 620'],
}
const DEVICE_A = 'q3Xk9vT2mB7pLw0cZr1sEa'
const DEVICE_B = 'Zp4Wc8nR1tYv6Lm2Qa9xKe'
const record = (s: DeviceScan = scan, device_id = DEVICE_A): DeviceRecord => ({ device_id, created_at: '2026-11-22T10:00:00.000Z', scan: s })
const isResult = createValidator(PartLookupResult)

function fixtureRetriever() {
  const db = new DatabaseSync(':memory:')
  writeIndex(db, readCorpus(FIXTURE_CORPUS))
  return createRetriever(db)
}

interface PromptPart {
  part_id: string
  name: string
  passages: { passage_id: string }[]
}
const promptParts = (request: JsonRequest<any>): PromptPart[] => JSON.parse(request.user.split('<parts>')[1]!.split('</parts>')[0]!)

/** Fake LLM: by default one sentence per part citing its first passage. */
function fakeLlm(answer: (parts: PromptPart[]) => unknown = (parts) => ({
  parts: parts.map((p) => ({ part_id: p.part_id, sentence: `About ${p.name}.`, passage_ids: [p.passages[0]!.passage_id] })),
})) {
  const requests: JsonRequest<any>[] = []
  const llm: LlmClient = {
    async completeJson(request) {
      requests.push(request)
      const value = answer(promptParts(request))
      if (value instanceof Error) throw value
      return { value: value as never, model: 'fake', attempts: 1, latency_ms: 0, usage: { prompt_tokens: 0, completion_tokens: 0 } }
    },
  }
  return { llm, requests }
}

const hit = (title: string, text: string): SearchHit => ({ title, url: `https://example.com/${encodeURIComponent(title)}`, text, published: null })

function fakeProvider(answer: (q: SearchQuery) => SearchHit[] | Promise<SearchHit[]> = () => []) {
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

/** Every query gets one page that names it. */
const echoPages = (q: SearchQuery) => [hit(q.text, `${q.text}. Plenty of detail about it.`)]

function setup(options: { search?: SearchProvider | null; llm?: LlmClient; cap?: number; timeoutMs?: number; now?: () => Date } = {}) {
  const db = new DatabaseSync(':memory:')
  const now = options.now ?? (() => new Date('2026-11-22T12:00:00Z'))
  const web: PartWebSearch | null =
    options.search === null
      ? null
      : {
          search: options.search ?? fakeProvider(echoPages).provider,
          cache: createSqliteSearchCache(db, now),
          budget: createSqliteSearchBudget(db, options.cap ?? 100, now),
          timeoutMs: options.timeoutMs ?? 2000,
          resultsPerQuery: 5,
          maxChars: 2000,
        }
  const warnings: string[] = []
  const deps: PartLookupDeps = {
    retriever: fixtureRetriever(),
    llm: options.llm ?? fakeLlm().llm,
    cache: createSqlitePartCache(db, now),
    web,
    warn: (m) => warnings.push(m),
  }
  return { db, service: createPartLookupService(deps), warnings }
}

const byId = (result: PartLookupResult, id: string) => result.parts.find((p) => p.part_id === id)!

describe('part identifiers', () => {
  it('normalizes chip names', () => {
    expect(normalizeChipName('Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz')).toBe('Intel Core i5-8250U')
    expect(normalizeChipName('11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz')).toBe('11th Gen Intel Core i7-1165G7')
    expect(normalizeChipName('AMD Ryzen 5 3500U with Radeon Vega Mobile Gfx')).toBe('AMD Ryzen 5 3500U')
    expect(normalizeChipName('Intel(R) UHD Graphics 620')).toBe('Intel UHD Graphics 620')
  })

  it('lists the parts of a scan in the order of the scan specs, by type for drives and the battery', () => {
    expect(scanParts(scan).map((p) => [p.part_id, p.identifier])).toEqual([
      ['cpu', 'Intel Core i5-8250U'],
      ['memory', 'DDR4'],
      ['gpu-0', 'Intel UHD Graphics 620'],
      ['storage-0', 'Hard disk drive'],
      ['battery', 'Laptop battery'],
    ])
  })

  it('shares one lookup between drives of one type, skips virtual adapters, unknown values and a missing battery', () => {
    const s: DeviceScan = {
      ...scan,
      memory: { ...scan.memory, type: null },
      gpus: ['Microsoft Basic Display Adapter', 'NVIDIA GeForce MX150'],
      storage: [
        { media: 'ssd', bus: 'nvme', capacity_gb: 256, health: 'healthy' },
        { media: 'unknown', bus: 'nvme', capacity_gb: 512, health: 'healthy' },
        { media: 'unknown', bus: 'unknown', capacity_gb: 1, health: 'unknown' },
        { media: 'ssd', bus: 'sata', capacity_gb: 1000, health: 'healthy' },
      ],
      battery: { ...scan.battery, present: false },
    }
    expect(scanParts(s).map((p) => [p.part_id, p.identifier])).toEqual([
      ['cpu', 'Intel Core i5-8250U'],
      ['gpu-0', 'NVIDIA GeForce MX150'],
      ['storage-0', 'NVMe SSD'],
      ['storage-1', 'SATA SSD'],
    ])
  })

  it('puts only the part identifier and fixed words into web queries (FR-002)', () => {
    for (const part of scanParts(scan)) {
      expect(part.webQuery).not.toMatch(/acme|book|ex14|sku/i)
      expect(part.webQuery.toLowerCase()).toContain(part.identifier.toLowerCase().split(' ')[0])
    }
  })
})

describe('part lookup service', () => {
  it('AC-001: finds a CPU named in the corpus without searching the web for it', async () => {
    const { provider, queries } = fakeProvider(echoPages)
    const { service } = setup({ search: provider })
    const result = await service.lookup(record())
    expect(isResult(result).ok).toBe(true)
    expect(checkPartLookupResult(result)).toEqual([])
    const cpu = byId(result, 'cpu')
    expect(cpu).toMatchObject({ status: 'knowledge_base', sentence: 'About Intel Core i5-8250U.' })
    expect(cpu.source!.document_id).toBe('os-cpu-list')
    expect(queries.some((q) => /8250U/i.test(q.text))).toBe(false)
    // The battery is in the generic e-waste guide, so it is not searched either.
    expect(byId(result, 'battery').status).toBe('knowledge_base')
    expect(queries.map((q) => q.text).sort()).toEqual(
      ['DDR4 laptop memory', 'Hard disk drive laptop drive', 'Intel UHD Graphics 620 graphics specifications'],
    )
  })

  it('AC-002: searches the web once for a part the corpus does not name, and labels it web', async () => {
    const { provider, queries } = fakeProvider(echoPages)
    const { service } = setup({ search: provider })
    const gpu = byId(await service.lookup(record()), 'gpu-0')
    expect(queries.filter((q) => q.text.includes('UHD Graphics 620'))).toHaveLength(1)
    expect(gpu).toMatchObject({ status: 'web', sentence: 'About Intel UHD Graphics 620.' })
    expect(gpu.source).toMatchObject({ source: 'web', applicability: { kind: 'generic' } })
  })

  it('AC-002: ignores pages that do not name the part', async () => {
    const { provider } = fakeProvider((q) => [hit('Some other graphics card', `${q.text.replace('620', '630')} review`)])
    const { service } = setup({ search: provider })
    expect(byId(await service.lookup(record()), 'gpu-0').status).toBe('no_match')
  })

  it('AC-002: asks the fallback provider when the primary has nothing usable', async () => {
    const primary = fakeProvider(() => [hit('unrelated', 'nothing here')])
    const fallback = fakeProvider(echoPages)
    const { service } = setup({ search: providerChain([primary.provider, fallback.provider], { primaryTimeoutMs: 1000 }) })
    expect(byId(await service.lookup(record()), 'gpu-0').status).toBe('web')
    expect(fallback.queries.length).toBeGreaterThan(0)
  })

  it('AC-002: reads "No match" without searching once the daily cap is reached', async () => {
    const { provider, queries } = fakeProvider(echoPages)
    const { service, warnings } = setup({ search: provider, cap: 0 })
    const result = await service.lookup(record())
    expect(queries).toHaveLength(0)
    expect(byId(result, 'gpu-0').status).toBe('no_match')
    expect(byId(result, 'cpu').status).toBe('knowledge_base')
    expect(warnings.some((w) => w.includes('daily web search limit'))).toBe(true)
  })

  it('AC-003: drops sentences without a valid citation, keeps cited ones, in one LLM call', async () => {
    const { llm, requests } = fakeLlm((parts) => ({
      parts: parts.map((p) => ({
        part_id: p.part_id,
        sentence: `About ${p.name}.`,
        // The CPU cites a passage of another part; the battery cites nothing that was sent.
        passage_ids: p.part_id === 'cpu' ? [parts.find((x) => x.part_id === 'gpu-0')!.passages[0]!.passage_id] : p.part_id === 'battery' ? ['made-up'] : [p.passages[0]!.passage_id],
      })),
    }))
    const { service } = setup({ llm })
    const result = await service.lookup(record())
    expect(requests).toHaveLength(1)
    expect(requests[0]!.task).toBe('part_lookup')
    expect(byId(result, 'cpu').status).toBe('no_match')
    expect(byId(result, 'battery').status).toBe('no_match')
    expect(byId(result, 'gpu-0').status).toBe('web')
    expect(byId(result, 'memory').status).toBe('web')
    expect(checkPartLookupResult(result)).toEqual([])
  })

  it('AC-003: a part the LLM leaves out reads "No match"', async () => {
    const { llm } = fakeLlm(() => ({ parts: [] }))
    const { service } = setup({ llm })
    const result = await service.lookup(record())
    expect(result.parts.every((p) => p.status === 'no_match' && p.sentence === null && p.source === null)).toBe(true)
  })

  it('AC-005: a search that does not answer in time ends in "No match" and is retried later', async () => {
    let answer = false
    const { provider, queries } = fakeProvider((q) => (answer || !q.text.includes('Graphics') ? echoPages(q) : new Promise<SearchHit[]>(() => {})))
    const { service } = setup({ search: provider, timeoutMs: 50 })
    const started = Date.now()
    const first = await service.lookup(record())
    expect(Date.now() - started).toBeLessThan(1000)
    expect(byId(first, 'gpu-0').status).toBe('no_match')
    expect(byId(first, 'memory').status).toBe('web')
    answer = true
    const second = await service.lookup(record())
    expect(byId(second, 'gpu-0').status).toBe('web')
    expect(queries.filter((q) => q.text.includes('Graphics'))).toHaveLength(2)
  })

  it('AC-005: an LLM failure or a provider error ends in "No match" without throwing', async () => {
    const { llm } = fakeLlm(() => new LlmError('timeout', 'Part lookup deadline exceeded'))
    const failing: SearchProvider = { name: 'down', search: async () => Promise.reject(new SearchError('unavailable', 'down')) }
    const { service, warnings } = setup({ llm, search: failing })
    const result = await service.lookup(record())
    expect(result.parts.every((p) => p.status === 'no_match')).toBe(true)
    expect(warnings).toEqual(expect.arrayContaining(['part web search failed', 'part lookup call failed; parts read "No match"']))
  })

  it('AC-006: a second device with the same CPU makes no new search or LLM call for it within 30 days', async () => {
    let now = new Date('2026-11-22T12:00:00Z')
    const { provider, queries } = fakeProvider(echoPages)
    const { llm, requests } = fakeLlm()
    const { service } = setup({ search: provider, llm, now: () => now })
    await service.lookup(record(scan, DEVICE_A))
    const searches = queries.length
    expect(requests).toHaveLength(1)

    // Same parts, other device and model, 29 days later: everything comes from the caches.
    now = new Date('2026-12-21T12:00:00Z')
    const other: DeviceScan = { ...scan, identity: { ...scan.identity, model: 'Book 98', product_version: 'Book 98' } }
    const second = await service.lookup(record(other, DEVICE_B))
    expect(requests).toHaveLength(1)
    expect(queries).toHaveLength(searches)
    expect(byId(second, 'cpu').status).toBe('knowledge_base')
    expect(byId(second, 'gpu-0').status).toBe('web')

    // A new CPU only asks about that CPU.
    const newCpu: DeviceScan = { ...other, cpu: { ...other.cpu, name: 'Intel(R) Core(TM) i7-8650U CPU @ 1.90GHz' } }
    await service.lookup(record(newCpu, DEVICE_B))
    expect(requests).toHaveLength(2)
    expect(promptParts(requests[1]!).map((p) => p.part_id)).toEqual(['cpu'])

    // After 30 days the cache has expired.
    now = new Date('2026-12-23T12:00:00Z')
    await service.lookup(record(scan, DEVICE_A))
    expect(requests).toHaveLength(3)
  })

  it('uses model-specific corpus passages only for that model', async () => {
    const { llm, requests } = fakeLlm()
    const { service } = setup({ llm })
    const book14: DeviceScan = { ...scan, identity: { ...scan.identity, model: 'Book 14', product_version: 'Book 14' } }
    const own = await service.lookup(record(book14))
    expect(byId(own, 'memory')).toMatchObject({ status: 'knowledge_base', source: { document_id: 'acme-book14-manual' } })
    // Another model with DDR4 neither reuses the Book 14 sentence nor sees its manual.
    const other = await service.lookup(record(scan, DEVICE_B))
    expect(byId(other, 'memory').status).toBe('web')
    expect(requests).toHaveLength(2)
  })

  it('AC-007: without a search provider only corpus lookups run, and no-match parts are not cached', async () => {
    const { service } = setup({ search: null })
    const result = await service.lookup(record())
    expect(byId(result, 'cpu').status).toBe('knowledge_base')
    expect(byId(result, 'gpu-0').status).toBe('no_match')
  })

  it('shares one run between the upload and the page', async () => {
    const { llm, requests } = fakeLlm()
    const { service } = setup({ llm })
    service.start(record())
    await service.lookup(record())
    expect(requests).toHaveLength(1)
  })
})

describe('GET /api/devices/:id/parts', () => {
  function app(parts?: ReturnType<typeof createPartLookupService>) {
    const db = new DatabaseSync(':memory:')
    return buildApp({ devices: createSqliteDeviceStore(db), sessions: createSqliteSessionStore(db), parts, publicBaseUrl: 'http://localhost:5173' })
  }

  it('starts the lookup on upload and returns the lookups', async () => {
    const { llm, requests } = fakeLlm()
    const { service } = setup({ llm })
    const server = app(service)
    const upload = await server.inject({ method: 'POST', url: API_ROUTES.uploadDevice, payload: scan })
    expect(upload.statusCode).toBe(201)
    expect(requests).toHaveLength(0) // still searching when the upload answers
    const { device_id } = upload.json()
    const res = await server.inject({ method: 'GET', url: API_ROUTES.deviceParts(device_id) })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(isResult(body).ok).toBe(true)
    expect(checkPartLookupResult(body)).toEqual([])
    expect(body.parts).toHaveLength(5)
    expect(requests).toHaveLength(1)
  })

  it('AC-007: answers an empty list without the lookup service', async () => {
    const server = app()
    const { device_id } = (await server.inject({ method: 'POST', url: API_ROUTES.uploadDevice, payload: scan })).json()
    const res = await server.inject({ method: 'GET', url: API_ROUTES.deviceParts(device_id) })
    expect(res.json()).toEqual({ device_id, parts: [] })
  })

  it('answers 404 for an unknown device', async () => {
    const res = await app().inject({ method: 'GET', url: API_ROUTES.deviceParts(DEVICE_B) })
    expect(res.statusCode).toBe(404)
  })
})
