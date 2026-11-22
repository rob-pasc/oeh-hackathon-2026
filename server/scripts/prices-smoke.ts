// Live check of feature 019 (AC-011): `npm run prices:smoke -w server`. Reads server/.env.
// Runs the server's own lookups: web prices for an SSD, a RAM module and a battery, local repair
// offers Austria-wide and for the town Nominatim finds at the centre of Dornbirn (a public point,
// not anyone's location). Uses the configured providers and LLM, but not the daily cap or caches,
// and costs up to two searches and two LLM calls per lookup. Never prints keys.
import { MIN_WEB_PRICE_OFFERS } from '@leaaf/shared'
import { createOpenAiCompatibleClient, LlmError, loadLlmConfig } from '../src/llm/index.ts'
import { createNominatim } from '../src/location/nominatim.ts'
import { findLocalOffers } from '../src/offers/service.ts'
import type { PricePart } from '../src/prices/part.ts'
import { findPartOffers } from '../src/prices/service.ts'
import { loadPriceSources } from '../src/prices/sources.ts'
import { createProviders, loadSearchConfig } from '../src/search/config.ts'
import type { SearchProvider } from '../src/search/types.ts'
import type { WebLookup } from '../src/search/lookup.ts'
import { modelMatcher } from '../src/search/evidence.ts'
import { SearchError } from '../src/search/types.ts'

const battery = modelMatcher('ThinkPad T480')
const parts: PricePart[] = [
  { kind: 'ssd', label: '500 GB M.2 2280 NVMe SSD' },
  { kind: 'ram', label: '8 GB DDR4 SO-DIMM' },
  { kind: 'battery', label: 'Lenovo ThinkPad T480 Akku', accept: (h) => battery(h.title) || battery(h.text) },
]
let failed = false

/** Logs which provider each search went to. */
const traced = (p: SearchProvider): SearchProvider => ({
  name: p.name,
  async search(query, signal) {
    const started = Date.now()
    try {
      const hits = await p.search(query, signal)
      console.log(`    ${p.name}: ${hits.length} results, ${Date.now() - started} ms`)
      return hits
    } catch (error) {
      console.log(`    ${p.name}: ${error instanceof SearchError ? error.kind : 'error'}, ${Date.now() - started} ms`)
      throw error
    }
  },
})

try {
  const config = loadSearchConfig()
  if (!config) throw new SearchError('config', 'no LANGSEARCH_API_KEY or TINYFISH_API_KEY set (see server/.env.example)')
  const warn = (message: string, details?: Record<string, unknown>) => console.warn(`    warning: ${message} ${details ? JSON.stringify(details) : ''}`)
  const web: WebLookup = {
    providers: createProviders(config).map(traced),
    budget: { reserve: () => true },
    llm: createOpenAiCompatibleClient(loadLlmConfig()),
    timeoutMs: Math.max(config.timeoutMs, 20000),
    resultsPerQuery: config.resultsPerQuery,
    maxChars: config.maxChars,
    warn,
  }
  const domains = loadPriceSources()

  for (const part of parts) {
    console.log(`price: ${part.label}`)
    const offers = await findPartOffers(web, part, domains)
    for (const o of offers ?? []) console.log(`    €${o.price_eur.toFixed(2)}  ${o.publisher}  ${o.title.slice(0, 70)}`)
    if (offers && offers.length >= MIN_WEB_PRICE_OFFERS) {
      console.log(`  web price from €${Math.min(...offers.map((o) => o.price_eur)).toFixed(2)} · ${offers.length} offers`)
    } else {
      failed = true
      console.error(`  no web price (${offers === null ? 'every provider failed' : `${offers.length} checked offers`})`)
    }
  }

  const started = Date.now()
  const town = await createNominatim({ userAgent: `leaaf (${process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173'})`, warn }).town(47.41, 9.74)
  console.log(`nominatim: 47.41, 9.74 -> ${town ?? 'no town'}, ${Date.now() - started} ms`)
  if (!town) failed = true

  for (const area of [null, town]) {
    console.log(`offers: repair, ${area ?? 'Austria-wide'}`)
    const offers = await findLocalOffers(web, 'repair', area)
    for (const o of offers ?? []) console.log(`    ${o.name}${o.town ? ` · ${o.town}` : ''} · ${o.publisher}`)
    if (!offers?.length) {
      failed = true
      console.error('  no places')
    }
  }

  if (failed) {
    console.error('prices smoke test finished with problems (see above)')
    process.exitCode = 1
  } else console.log('prices smoke test passed')
} catch (error) {
  console.error('prices smoke test failed:', error instanceof SearchError || error instanceof LlmError ? `${error.kind}: ${error.message}` : error)
  process.exitCode = 1
}
