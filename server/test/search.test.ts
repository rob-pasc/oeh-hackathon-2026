// Web evidence for model facts (feature 017): providers, provider chain, configuration, model match,
// cache and cap, deadline, fact extraction rules, the assessment service, and the stream status event.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import {
  API_ROUTES,
  Assessment,
  checkAssessment,
  createValidator,
  Passage,
  PATHS,
  type DeviceRecord,
  type DeviceScan,
  type Fact,
  type RetrievalResult,
} from '@leaaf/shared'
import { buildApp } from '../src/app.ts'
import { createAssessmentService, loadWeights } from '../src/assessment/index.ts'
import { createSqliteDeviceStore } from '../src/devices/store.ts'
import { createFactExtractor, createMemoryFactCache, filterFacts } from '../src/facts/index.ts'
import { ExtractionAnswer, WebExtractionAnswer } from '../src/facts/extract.ts'
import { deviceContext, factExtractionUserPrompt, passageContext, WEB_PASSAGE_RULES } from '../src/facts/prompt.ts'
import { loadImpactTable } from '../src/impact/table.ts'
import type { JsonRequest, LlmClient } from '../src/llm/index.ts'
import { createRetriever, readCorpus, writeIndex } from '../src/retrieval/index.ts'
import { createSqliteSearchBudget, createSqliteSearchCache, type SearchBudget } from '../src/search/cache.ts'
import { createConfiguredSearch, loadSearchConfig, providerChain } from '../src/search/config.ts'
import {
  createWebEvidence,
  distinctiveModel,
  finishWebEvidence,
  modelMatcher,
  queryManufacturer,
  SEARCH_TOPICS,
  uncoveredTopics,
  type WebEvidenceDeps,
} from '../src/search/evidence.ts'
import { createLangSearchProvider, LANGSEARCH_URL } from '../src/search/langsearch.ts'
import { createTinyFishProvider, TINYFISH_FETCH_URL, TINYFISH_SEARCH_URL } from '../src/search/tinyfish.ts'
import { SearchError, type SearchHit, type SearchProvider, type SearchQuery } from '../src/search/types.ts'
import { createSqliteSessionStore } from '../src/sessions/store.ts'

const FIXTURE_CORPUS = fileURLToPath(new URL('./fixtures/corpus/', import.meta.url))
const baseScan = JSON.parse(readFileSync(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url), 'utf8')) as DeviceScan
const acmeScan: DeviceScan = {
  ...baseScan,
  identity: { ...baseScan.identity, manufacturer: 'Acme', model: 'Book 14', product_version: null, system_family: null },
  cpu: { ...baseScan.cpu, name: 'Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz' },
  os: { ...baseScan.os, family: 'windows' },
}
/** Not in the fixture corpus, so every topic is uncovered. */
const uncoveredScan: DeviceScan = { ...acmeScan, identity: { ...acmeScan.identity, model: 'Book 99' } }
const record = (scan: DeviceScan): DeviceRecord => ({ device_id: 'q3Xk9vT2mB7pLw0cZr1sEa', created_at: '2026-11-22T10:00:00.000Z', scan })
const isPassage = createValidator(Passage)
const isAssessment = createValidator(Assessment)
const impactTable = loadImpactTable()
const weights = loadWeights()

function fixtureRetriever() {
  const db = new DatabaseSync(':memory:')
  writeIndex(db, readCorpus(FIXTURE_CORPUS))
  return createRetriever(db)
}

const hit = (title: string, text: string, url = `https://example.com/${encodeURIComponent(title)}`): SearchHit => ({ title, url, text, published: null })

/** Fake provider: answers with `answer(query)`, records the queries it received. */
function fakeProvider(answer: (q: SearchQuery) => SearchHit[] | Promise<SearchHit[]> = () => [], name = 'fake') {
  const queries: SearchQuery[] = []
  const provider: SearchProvider = {
    name,
    async search(query) {
      queries.push(query)
      return answer(query)
    },
  }
  return { provider, queries }
}

const unlimited: SearchBudget = { reserve: () => true }

function webEvidence(provider: SearchProvider, overrides: Partial<WebEvidenceDeps> = {}) {
  const db = new DatabaseSync(':memory:')
  return createWebEvidence({
    search: provider,
    cache: createSqliteSearchCache(db),
    budget: unlimited,
    timeoutMs: 2000,
    resultsPerQuery: 5,
    maxChars: 6000,
    ...overrides,
  })
}

const emptyRetrieval = (): RetrievalResult => ({
  model_evidence: 'none',
  matched_model: null,
  passages_by_path: Object.fromEntries(PATHS.map((p) => [p, []])) as unknown as RetrievalResult['passages_by_path'],
})

const corpusPassage = (id: string, text: string, applicability: Passage['applicability']): Passage => ({
  passage_id: id,
  document_id: id.split('#')[0]!,
  title: 'Acme Book 14 manual',
  url: 'https://acme.example/manual',
  publisher: 'Acme',
  topic: 'repair-hardware',
  section: 'Specs',
  page: null,
  applicability,
  accessed_on: '2026-11-20',
  text,
})

/** Fake LLM: answers with `answer(passages)`; records requests. */
function fakeLlm(answer: (passages: { passage_id: string; source?: string; text: string }[]) => { facts: Fact[]; rejected_passage_ids?: string[] }) {
  const requests: JsonRequest<any>[] = []
  const llm: LlmClient = {
    async completeJson(request) {
      requests.push(request)
      const passages = JSON.parse(/<passages>\n([\s\S]*)\n<\/passages>/.exec(request.user)?.[1] ?? '[]')
      return { value: answer(passages) as any, model: 'fake', attempts: 1, latency_ms: 1, usage: { prompt_tokens: 1, completion_tokens: 1 } }
    },
  }
  return { llm, requests }
}

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('LangSearch provider', () => {
  it('asks for page text with a Bearer key and maps the results', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const transport = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return response({
        code: 200,
        data: {
          webPages: {
            value: [
              { name: 'Spec page', url: 'https://psref.example/t470', text: 'ThinkPad T470 has two slots', datePublished: '2024-01-01' },
              { name: 'Snippet only', url: 'https://other.example/x', snippet: 'short' },
              { name: 'Bad URL', url: 'javascript:alert(1)', text: 'nope' },
            ],
          },
        },
      })
    }) as unknown as typeof fetch
    const hits = await createLangSearchProvider('key-1', transport).search({ text: 'Lenovo ThinkPad T470 RAM', maxResults: 5, maxChars: 4000 })
    expect(calls[0]!.url).toBe(LANGSEARCH_URL)
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer key-1')
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ query: 'Lenovo ThinkPad T470 RAM', count: 5, contents: { text: { maxCharacters: 4000 } } })
    expect(hits).toEqual([
      { title: 'Spec page', url: 'https://psref.example/t470', text: 'ThinkPad T470 has two slots', published: '2024-01-01' },
      { title: 'Snippet only', url: 'https://other.example/x', text: 'short', published: null },
    ])
  })

  it('maps HTTP and envelope errors to error kinds without the key', async () => {
    const statusOnly = (status: number) => (async () => response({}, status)) as unknown as typeof fetch
    await expect(createLangSearchProvider('secret', statusOnly(401)).search({ text: 'q', maxResults: 1, maxChars: 500 })).rejects.toMatchObject({ kind: 'auth' })
    await expect(createLangSearchProvider('secret', statusOnly(429)).search({ text: 'q', maxResults: 1, maxChars: 500 })).rejects.toMatchObject({ kind: 'rate_limited' })
    const envelope = (async () => response({ code: 503, msg: 'busy' })) as unknown as typeof fetch
    const error = await createLangSearchProvider('secret', envelope).search({ text: 'q', maxResults: 1, maxChars: 500 }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(SearchError)
    expect((error as SearchError).kind).toBe('unavailable')
    expect((error as SearchError).message).not.toContain('secret')
  })
})

describe('TinyFish provider', () => {
  it('searches, then fetches page text for the top results, keeping the snippet where Fetch failed', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const transport = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (url.startsWith(TINYFISH_SEARCH_URL))
        return response({
          results: [
            { title: 'A', url: 'https://a.example/', snippet: 'snippet A' },
            { title: 'B', url: 'https://b.example/', snippet: 'snippet B' },
          ],
        })
      return response({ results: [{ url: 'https://a.example/', text: 'full text A' }], errors: [{ url: 'https://b.example/', error: 'bot_blocked' }] })
    }) as unknown as typeof fetch
    const hits = await createTinyFishProvider('key-2', transport).search({ text: 'Dell XPS 13 9370 SSD', maxResults: 5, maxChars: 4000 })
    expect(calls[0]!.url).toBe(`${TINYFISH_SEARCH_URL}?query=Dell+XPS+13+9370+SSD`)
    expect((calls[0]!.init.headers as Record<string, string>)['x-api-key']).toBe('key-2')
    expect(calls[1]!.url).toBe(TINYFISH_FETCH_URL)
    expect(JSON.parse(calls[1]!.init.body as string)).toMatchObject({ urls: ['https://a.example/', 'https://b.example/'], format: 'markdown' })
    expect(hits.map((h) => h.text)).toEqual(['full text A', 'snippet B'])
  })

  it('keeps the snippets when Fetch answers with an error status', async () => {
    const transport = (async (url: string) =>
      url.startsWith(TINYFISH_SEARCH_URL) ? response({ results: [{ title: 'A', url: 'https://a.example/', snippet: 'snippet A' }] }) : response({}, 500)) as unknown as typeof fetch
    const hits = await createTinyFishProvider('k', transport).search({ text: 'q', maxResults: 5, maxChars: 4000 })
    expect(hits.map((h) => h.text)).toEqual(['snippet A'])
  })
})

describe('provider chain (FR-002)', () => {
  const query: SearchQuery = { text: 'q', maxResults: 3, maxChars: 500, accept: (h) => h.text.includes('Book 99') }
  const good = [hit('Acme Book 99', 'Acme Book 99 specs')]

  it.each([
    ['an error', () => Promise.reject(new SearchError('unavailable', 'down'))],
    ['a 429', () => Promise.reject(new SearchError('rate_limited', 'limit'))],
    ['no result', () => []],
    ['no usable result', () => [hit('Acme Book 98', 'other model')]],
  ])('asks the fallback after %s from the primary (AC-002)', async (_label, primaryAnswer) => {
    const primary = fakeProvider(primaryAnswer as () => SearchHit[])
    const fallback = fakeProvider(() => good)
    const warnings: unknown[] = []
    const hits = await providerChain([primary.provider, fallback.provider], { primaryTimeoutMs: 1000, warn: (_m, d) => warnings.push(d) }).search(query)
    expect(hits).toEqual(good)
    expect(fallback.queries).toHaveLength(1)
  })

  it('asks the fallback when the primary runs out of its share of the time (AC-002)', async () => {
    const hanging: SearchProvider = {
      name: 'hanging',
      search: (_q, signal) => new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new SearchError('timeout', 'slow')))),
    }
    const fallback = fakeProvider(() => good)
    const started = Date.now()
    const hits = await providerChain([hanging, fallback.provider], { primaryTimeoutMs: 50 }).search(query)
    expect(hits).toEqual(good)
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('throws when every provider fails, and returns [] when they answer without usable hits (AC-002)', async () => {
    const failing = fakeProvider(() => Promise.reject(new SearchError('unavailable', 'down')))
    await expect(providerChain([failing.provider, failing.provider], { primaryTimeoutMs: 100 }).search(query)).rejects.toMatchObject({ kind: 'unavailable' })
    const empty = fakeProvider(() => [])
    await expect(providerChain([empty.provider, failing.provider], { primaryTimeoutMs: 100 }).search(query)).resolves.toEqual([])
  })
})

describe('search configuration', () => {
  it('asks LangSearch first and TinyFish second by default, and the reverse when configured (AC-003)', () => {
    const keys = { LANGSEARCH_API_KEY: 'a', TINYFISH_API_KEY: 'b' }
    expect(loadSearchConfig(keys)?.providers.map((p) => p.name)).toEqual(['langsearch', 'tinyfish'])
    expect(loadSearchConfig({ ...keys, SEARCH_PROVIDER: 'tinyfish', SEARCH_FALLBACK: 'langsearch' })?.providers.map((p) => p.name)).toEqual(['tinyfish', 'langsearch'])
    expect(loadSearchConfig({ ...keys, SEARCH_FALLBACK: 'none' })?.providers.map((p) => p.name)).toEqual(['langsearch'])
  })

  it('uses whichever provider has a key, and is off without any key (AC-012)', () => {
    expect(loadSearchConfig({ TINYFISH_API_KEY: 'b' })?.providers.map((p) => p.name)).toEqual(['tinyfish'])
    expect(loadSearchConfig({})).toBeNull()
    expect(loadSearchConfig({ LANGSEARCH_API_KEY: '  ' })).toBeNull()
  })

  it('rejects unknown providers and invalid numbers', () => {
    expect(() => loadSearchConfig({ LANGSEARCH_API_KEY: 'a', SEARCH_PROVIDER: 'brave' })).toThrow(SearchError)
    expect(() => loadSearchConfig({ LANGSEARCH_API_KEY: 'a', SEARCH_TIMEOUT_MS: '0' })).toThrow(/SEARCH_TIMEOUT_MS/)
    expect(() => loadSearchConfig({ LANGSEARCH_API_KEY: 'a', SEARCH_DAILY_CALLS: '-1' })).toThrow(/SEARCH_DAILY_CALLS/)
  })

  it('switches providers through configuration only (AC-003)', async () => {
    const urls: string[] = []
    const transport = (async (url: string) => {
      urls.push(url)
      return response({ results: [] })
    }) as unknown as typeof fetch
    const config = loadSearchConfig({ LANGSEARCH_API_KEY: 'a', TINYFISH_API_KEY: 'b', SEARCH_PROVIDER: 'tinyfish', SEARCH_FALLBACK: 'langsearch' })!
    await createConfiguredSearch(config, { transport }).search({ text: 'q', maxResults: 1, maxChars: 500 })
    expect(urls[0]).toMatch(/^https:\/\/api\.search\.tinyfish\.ai/)
    expect(urls[1]).toBe(LANGSEARCH_URL)
  })
})

describe('model match (FR-003)', () => {
  it('matches the exact model as whole tokens, never a sibling (AC-004)', () => {
    const matches = modelMatcher('ThinkPad T480')
    expect(matches('Lenovo ThinkPad T480 (20L5) specifications')).toBe(true)
    expect(matches('thinkpad-t480 memory')).toBe(true)
    expect(matches('ThinkPad T480s specifications')).toBe(false)
    expect(matches('ThinkPad T4800')).toBe(false)
    expect(matches('ThinkPad T470')).toBe(false)
    expect(modelMatcher('XPS 13 9360')('Dell XPS 13 9370 review')).toBe(false)
  })

  it('needs a distinctive model name with a digit and strips the brand word', () => {
    expect(distinctiveModel({ manufacturer: 'HP', model: 'HP EliteBook 840 G5' })).toBe('EliteBook 840 G5')
    expect(distinctiveModel({ manufacturer: 'Dell Inc.', model: 'Latitude' })).toBeNull()
    expect(distinctiveModel({ manufacturer: 'unknown', model: 'unknown' })).toBeNull()
    expect(queryManufacturer('Dell Inc.')).toBe('Dell')
    expect(queryManufacturer('Hewlett-Packard Company')).toBe('Hewlett-Packard')
  })

  it('passes only results naming the exact model to fact extraction (AC-004)', async () => {
    const { provider } = fakeProvider(() => [
      hit('ThinkPad T480s specs', 'The ThinkPad T480s has soldered memory'),
      hit('ThinkPad T480 specs', 'The ThinkPad T480 has two SODIMM slots'),
    ])
    const out = await webEvidence(provider).augment(emptyRetrieval(), { manufacturer: 'Lenovo', model: 'ThinkPad T480' })
    const web = out.passages_by_path.upgrade.filter((p) => p.source === 'web')
    expect(web.length).toBeGreaterThan(0)
    expect(web.every((p) => p.title === 'ThinkPad T480 specs')).toBe(true)
    for (const p of web) expect(isPassage(p).ok).toBe(true)
  })
})

describe('web search per topic (FR-001, FR-012)', () => {
  it('searches only the topic without a model-specific corpus passage (AC-001)', async () => {
    const model = { kind: 'model', manufacturer: 'Acme', model: 'Book 14' } as const
    const retrieval: RetrievalResult = {
      ...emptyRetrieval(),
      model_evidence: 'model_specific',
      matched_model: { manufacturer: 'Acme', model: 'Book 14' },
    }
    retrieval.passages_by_path.upgrade.push(corpusPassage('m#1', 'The M.2 SSD slot takes 2280 NVMe drives.', model))
    retrieval.passages_by_path.repair.push(corpusPassage('m#2', 'Replacing the battery requires removing the base cover.', model))
    retrieval.passages_by_path.pass_on.push(corpusPassage('m#3', 'BIOS updates for Windows 10 continue.', model))
    // A generic passage about memory does not cover the model's memory.
    retrieval.passages_by_path.upgrade.push(corpusPassage('g#1', 'Laptop memory is often soldered.', { kind: 'generic' }))

    expect(uncoveredTopics(retrieval).map((t) => t.id)).toEqual(['memory'])
    const { provider, queries } = fakeProvider()
    await webEvidence(provider).augment(retrieval, { manufacturer: 'Acme', model: 'Book 14' })
    expect(queries.map((q) => q.text)).toEqual([`Acme Book 14 ${SEARCH_TOPICS[0]!.query}`])
  })

  it('sends only manufacturer, model and topic words (AC-013)', async () => {
    const { provider, queries } = fakeProvider()
    const { llm } = fakeLlm(() => ({ facts: [], rejected_passage_ids: [] }))
    const service = createAssessmentService({
      retriever: fixtureRetriever(),
      extractor: createFactExtractor({ llm, cache: createMemoryFactCache() }),
      webEvidence: webEvidence(provider),
      impactTable,
      weights,
    })
    await service.assessDevice(record(uncoveredScan), 'office')
    expect(queries.map((q) => q.text).sort()).toEqual(SEARCH_TOPICS.map((t) => `Acme Book 99 ${t.query}`).sort())
    const scanValues = [uncoveredScan.cpu.name, 'q3Xk9vT2mB7pLw0cZr1sEa', uncoveredScan.os.caption].filter((v): v is string => !!v)
    for (const q of queries) for (const value of scanValues) expect(q.text).not.toContain(value)
  })
})

describe('search cache and daily cap', () => {
  it('reuses a cached search for 30 days, then searches again (AC-009)', async () => {
    let now = new Date('2026-11-22T10:00:00Z')
    const db = new DatabaseSync(':memory:')
    const { provider, queries } = fakeProvider(() => [hit('Acme Book 99', 'Acme Book 99 has 2 memory slots')])
    const evidence = webEvidence(provider, { cache: createSqliteSearchCache(db, () => now) })
    const model = { manufacturer: 'Acme', model: 'Book 99' }
    const first = await evidence.augment(emptyRetrieval(), model)
    expect(queries).toHaveLength(4)
    now = new Date('2026-12-21T10:00:00Z')
    const second = await evidence.augment(emptyRetrieval(), model)
    expect(queries).toHaveLength(4)
    expect(second).toEqual(first)
    expect(first.passages_by_path.upgrade.find((p) => p.source === 'web')?.accessed_on).toBe('2026-11-22')
    now = new Date('2026-12-22T10:00:00Z')
    await evidence.augment(emptyRetrieval(), model)
    expect(queries).toHaveLength(8)
  })

  it('stops searching once the daily cap is reached (AC-010)', async () => {
    let now = new Date('2026-11-22T10:00:00Z')
    const db = new DatabaseSync(':memory:')
    const budget = createSqliteSearchBudget(db, 2, () => now)
    const warnings: string[] = []
    const { provider, queries } = fakeProvider()
    const evidence = webEvidence(provider, { budget, warn: (m) => warnings.push(m) })
    await evidence.augment(emptyRetrieval(), { manufacturer: 'Acme', model: 'Book 99' })
    expect(queries).toHaveLength(2)
    expect(warnings).toContain('daily web search limit reached; assessing without web evidence')
    now = new Date('2026-11-23T00:00:01Z')
    expect(budget.reserve()).toBe(true)
    expect(createSqliteSearchBudget(db, 0).reserve()).toBe(false)
  })

  it('does not cache failed searches', async () => {
    let fail = true
    const { provider, queries } = fakeProvider(() => (fail ? Promise.reject(new SearchError('unavailable', 'down')) : []))
    const evidence = webEvidence(provider)
    const model = { manufacturer: 'Acme', model: 'Book 99' }
    await evidence.augment(emptyRetrieval(), model)
    fail = false
    await evidence.augment(emptyRetrieval(), model)
    expect(queries).toHaveLength(8)
  })
})

describe('deadline (FR-010)', () => {
  it('continues without web evidence when the providers do not answer in time (AC-011)', async () => {
    const never: SearchProvider = { name: 'never', search: () => new Promise(() => {}) }
    const started = Date.now()
    const out = await webEvidence(never, { timeoutMs: 100 }).augment(emptyRetrieval(), { manufacturer: 'Acme', model: 'Book 99' })
    expect(Date.now() - started).toBeLessThan(1000)
    expect(out).toEqual(emptyRetrieval())
  })
})

describe('fact extraction with web passages (FR-004, FR-006)', () => {
  const web = new Set(['web:a:memory', 'web:b:battery'])
  const retrieved = new Set([...web, 'corpus#1'])
  const fact = (key: string, value: unknown, ...ids: string[]) => ({ key, value, source_passage_ids: ids }) as Fact

  it('drops a fact citing only rejected web passages and keeps one with another citation (AC-005)', () => {
    const { kept, dropped } = filterFacts(
      [fact('ram_slots_total', 2, 'web:a:memory'), fact('ram_max_gb', 32, 'web:a:memory', 'corpus#1')],
      retrieved,
      { webIds: web, rejectedIds: new Set(['web:a:memory']) },
    )
    expect(kept).toEqual([fact('ram_max_gb', 32, 'corpus#1')])
    expect(dropped.map((d) => d.reason)).toEqual(['cites only web passages that are not about this model'])
  })

  it('never accepts a user-replaceable battery from web pages alone (AC-007)', () => {
    const { kept, dropped } = filterFacts([fact('battery_user_replaceable', true, 'web:b:battery')], retrieved, { webIds: web })
    expect(kept).toEqual([])
    expect(dropped[0]!.reason).toMatch(/battery/)
    expect(filterFacts([fact('battery_user_replaceable', false, 'web:b:battery')], retrieved, { webIds: web }).kept).toHaveLength(1)
    expect(filterFacts([fact('battery_user_replaceable', true, 'web:b:battery', 'corpus#1')], retrieved, { webIds: web }).kept).toHaveLength(1)
  })

  it('asks for rejected passages only when web passages are present, leaving corpus prompts unchanged (AC-012)', async () => {
    const model = { manufacturer: 'Acme', model: 'Book 99' }
    const corpusOnly = [corpusPassage('c#1', 'Two slots.', { kind: 'model', ...model })]
    const corpusPrompt = factExtractionUserPrompt(deviceContext(uncoveredScan, model), passageContext(corpusOnly))
    expect(corpusPrompt).not.toContain(WEB_PASSAGE_RULES)
    expect(corpusPrompt).not.toContain('"source"')

    const { llm, requests } = fakeLlm((passages) => ({
      facts: [fact('ram_slots_total', 2, passages.find((p) => p.source === 'web')!.passage_id)],
      rejected_passage_ids: [],
    }))
    const retrieval = emptyRetrieval()
    retrieval.passages_by_path.upgrade.push({ ...corpusOnly[0]!, passage_id: 'web:x:memory', source: 'web' })
    const result = await createFactExtractor({ llm, cache: createMemoryFactCache() }).extract({ scan: uncoveredScan, retrieval })
    expect(requests[0]!.schema).toBe(WebExtractionAnswer)
    expect(requests[0]!.user).toContain(WEB_PASSAGE_RULES)
    expect(result.facts.facts.map((f) => f.key)).toEqual(['ram_slots_total'])

    const corpus = fakeLlm(() => ({ facts: [] }))
    const plain = emptyRetrieval()
    plain.passages_by_path.upgrade.push(corpusOnly[0]!)
    await createFactExtractor({ llm: corpus.llm, cache: createMemoryFactCache() }).extract({ scan: uncoveredScan, retrieval: plain })
    expect(corpus.requests[0]!.schema).toBe(ExtractionAnswer)
  })
})

describe('assessment with web evidence (FR-005)', () => {
  const page = hit('Acme Book 99 specifications', 'The Acme Book 99 has 2 SODIMM memory slots and supports up to 32 GB of DDR4 memory.', 'https://acme.example/book-99')
  const sibling = hit('Acme Book 99s specifications', 'The Acme Book 99s has soldered memory.', 'https://acme.example/book-99s')

  function webService(llmAnswer: Parameters<typeof fakeLlm>[0], provider = fakeProvider(() => [page, sibling]).provider) {
    const { llm, requests } = fakeLlm(llmAnswer)
    const service = createAssessmentService({
      retriever: fixtureRetriever(),
      extractor: createFactExtractor({ llm, cache: createMemoryFactCache() }),
      webEvidence: webEvidence(provider),
      impactTable,
      weights,
      now: () => new Date('2026-11-22T10:00:00Z'),
    })
    return { service, requests }
  }

  it('uses web facts for the gates of an uncovered model, with web evidence and lower confidence (AC-006)', async () => {
    const { service } = webService((passages) => {
      const web = passages.filter((p) => p.source === 'web')
      const memory = web.find((p) => p.passage_id.endsWith(':memory'))!.passage_id
      const storage = web.find((p) => p.passage_id.endsWith(':storage'))!.passage_id
      return {
        facts: [
          { key: 'storage_slots', value: [{ form_factor: 'sata_2_5', interface: 'sata' }], source_passage_ids: [storage] } as Fact,
          { key: 'ram_soldered', value: 'none', source_passage_ids: [memory] } as Fact,
          { key: 'ram_slots_total', value: 2, source_passage_ids: [memory] } as Fact,
          { key: 'ram_max_gb', value: 32, source_passage_ids: [memory] } as Fact,
          { key: 'ram_type', value: 'ddr4', source_passage_ids: [memory] } as Fact,
        ],
        rejected_passage_ids: [],
      }
    })
    const { assessment, retrieval, facts } = await service.assessDevice(record(uncoveredScan), 'office')
    expect(assessment.model_evidence).toBe('web')
    expect(retrieval.model_evidence).toBe('web')
    expect(facts.facts.map((f) => f.key).sort()).toEqual(['ram_max_gb', 'ram_slots_total', 'ram_soldered', 'ram_type', 'storage_slots'])
    expect(isAssessment(assessment).ok).toBe(true)
    expect(checkAssessment(assessment)).toEqual([])

    const upgrade = assessment.paths.find((p) => p.path === 'upgrade')!
    expect(upgrade.status).not.toBe('not_suitable')
    expect(upgrade.reasons.flatMap((r) => r.fact_keys)).toContain('storage_slots')
    expect(upgrade.confidence.reasons).toContain('Model-specific facts come from web pages, not from the curated knowledge base')
    expect(upgrade.confidence.reasons).not.toContain('No model-specific documentation was found for this computer')

    // Only cited web passages remain, all about the exact model.
    const web = PATHS.flatMap((p) => retrieval.passages_by_path[p]).filter((p) => p.source === 'web')
    expect(web.length).toBeGreaterThan(0)
    expect(web.every((p) => p.url === page.url && /:(memory|storage)$/.test(p.passage_id))).toBe(true)
  })

  it('stays without model evidence when the extraction rejects every web passage (AC-005)', async () => {
    const { service } = webService((passages) => {
      const ids = passages.filter((p) => p.source === 'web').map((p) => p.passage_id)
      return { facts: [{ key: 'ram_slots_total', value: 2, source_passage_ids: [ids[0]!] } as Fact], rejected_passage_ids: ids }
    })
    const { assessment, retrieval, facts } = await service.assessDevice(record(uncoveredScan), 'office')
    expect(assessment.model_evidence).toBe('none')
    expect(facts.facts).toEqual([])
    expect(PATHS.flatMap((p) => retrieval.passages_by_path[p]).some((p) => p.source === 'web')).toBe(false)
  })

  it('drops hardware facts resting on generic passages when the evidence comes from the web', () => {
    const retrieval = emptyRetrieval()
    const webPassage = { ...corpusPassage('web:a:memory', 'Acme Book 99 slots', { kind: 'model', manufacturer: 'Acme', model: 'Book 99' }), source: 'web' as const }
    retrieval.passages_by_path.upgrade.push(webPassage, corpusPassage('g#1', 'Generic memory text', { kind: 'generic' }))
    const out = finishWebEvidence(retrieval, {
      model: { manufacturer: 'Acme', model: 'Book 99' },
      facts: [
        { key: 'ram_slots_total', value: 2, source_passage_ids: ['web:a:memory'] } as Fact,
        { key: 'ram_soldered', value: 'all', source_passage_ids: ['g#1'] } as Fact,
        { key: 'windows11_supported_cpu', value: true, source_passage_ids: ['g#1'] } as Fact,
      ],
    })
    expect(out.retrieval.model_evidence).toBe('web')
    expect(out.facts.facts.map((f) => f.key)).toEqual(['ram_slots_total', 'windows11_supported_cpu'])
  })

  it('assesses exactly as before without web search configured (AC-012)', async () => {
    const answer = () => ({ facts: [] })
    const plain = createAssessmentService({
      retriever: fixtureRetriever(),
      extractor: createFactExtractor({ llm: fakeLlm(answer).llm, cache: createMemoryFactCache() }),
      impactTable,
      weights,
      now: () => new Date('2026-11-22T10:00:00Z'),
    })
    const off = createAssessmentService({
      retriever: fixtureRetriever(),
      extractor: createFactExtractor({ llm: fakeLlm(answer).llm, cache: createMemoryFactCache() }),
      webEvidence: null,
      impactTable,
      weights,
      now: () => new Date('2026-11-22T10:00:00Z'),
    })
    for (const scan of [acmeScan, uncoveredScan])
      expect(await off.assessDevice(record(scan), 'office')).toEqual(await plain.assessDevice(record(scan), 'office'))
  })

  it('does not search without fact extraction, since web passages could support nothing', async () => {
    const { provider, queries } = fakeProvider(() => [page])
    const service = createAssessmentService({ retriever: fixtureRetriever(), extractor: null, webEvidence: webEvidence(provider), impactTable, weights })
    await service.assessDevice(record(uncoveredScan), 'office')
    expect(queries).toHaveLength(0)
  })
})

const servers: { close(): Promise<unknown> }[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()))
})

describe('report stream status (FR-013)', () => {
  async function events(service: ReturnType<typeof createAssessmentService>, scan: DeviceScan) {
    const db = new DatabaseSync(':memory:')
    const devices = createSqliteDeviceStore(db)
    const app = buildApp({ devices, sessions: createSqliteSessionStore(db), assessments: service, publicBaseUrl: 'https://leaaf.example' })
    servers.push(app)
    const device = devices.create(scan)
    const base = await app.listen({ port: 0, host: '127.0.0.1' })
    const text = await (await fetch(base + API_ROUTES.reportStream(device.device_id, 'office'))).text()
    return text.split('\n\n').flatMap((frame) => {
      const name = /^event: (.+)$/m.exec(frame)?.[1]
      const data = /^data: (.+)$/m.exec(frame)?.[1]
      return name && data ? [{ name, data: JSON.parse(data) }] : []
    })
  }

  const service = (provider: SearchProvider) =>
    createAssessmentService({
      retriever: fixtureRetriever(),
      extractor: createFactExtractor({ llm: fakeLlm(() => ({ facts: [], rejected_passage_ids: [] })).llm, cache: createMemoryFactCache() }),
      webEvidence: webEvidence(provider),
      impactTable,
      weights,
    })

  it('sends a web_search status before the assessment while searching (AC-015)', async () => {
    const list = await events(service(fakeProvider().provider), uncoveredScan)
    expect(list.map((e) => e.name)).toEqual(['status', 'assessment', 'end'])
    expect(list[0]!.data).toEqual({ phase: 'web_search' })
  })

  it('sends no status when nothing is searched', async () => {
    const { provider } = fakeProvider()
    const svc = service(provider)
    // Same model again: every topic comes from the cache.
    await svc.assessDevice(record(uncoveredScan), 'office')
    expect((await events(svc, uncoveredScan)).map((e) => e.name)).toEqual(['assessment', 'end'])
  })
})
