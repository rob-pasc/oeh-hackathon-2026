// Server entry point. Configuration comes from environment variables (server/.env.example).
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { budgetedFetch, loadLimits } from './limits.ts'
import { buildApp, REQUEST_LOG_SERIALIZERS } from './app.ts'
import { loadAdminConfig } from './admin/config.ts'
import { createFallbackLog } from './admin/fallbacks.ts'
import { createAdminInsights } from './admin/insights.ts'
import { createAssessmentService } from './assessment/service.ts'
import { loadWeights } from './assessment/weights.ts'
import { createSqliteDeviceStore } from './devices/store.ts'
import { createFactExtractor, createSqliteFactCache, type FactExtractor } from './facts/index.ts'
import { loadImpactTable } from './impact/table.ts'
import { createOpenAiCompatibleClient, LlmError, loadLlmConfig } from './llm/index.ts'
import { DEFAULT_CORPUS_INDEX_PATH, IndexError, openRetriever, type Retriever } from './retrieval/index.ts'
import { createCategoryService } from './categories/service.ts'
import { schedulePurge } from './retention.ts'
import { createSqliteSearchBudget, createSqliteSearchCache, type SearchBudget } from './search/cache.ts'
import { createConfiguredSearch, createProviders, loadSearchConfig, type SearchConfig } from './search/config.ts'
import type { WebLookup } from './search/lookup.ts'
import { createWebEvidence, type WebEvidence } from './search/evidence.ts'
import { SearchError, type SearchProvider } from './search/types.ts'
import { createSqliteSessionStore } from './sessions/store.ts'
import { createPartLookupService, createSqlitePartCache, type PartWebSearch } from './parts/service.ts'
import { createStepService } from './steps/service.ts'
import { createPriceService, createSqlitePriceCache, loadPriceSources } from './prices/index.ts'
import { createOfferService } from './offers/service.ts'
import { createNominatim, NOMINATIM_URL } from './location/nominatim.ts'
import { createSqliteLocationStore } from './location/store.ts'

const env = process.env
const limits = loadLimits(env)
const port = Number(env.PORT ?? 3000)
const host = env.HOST ?? '127.0.0.1'
const databasePath = resolve(env.DATABASE_PATH ?? 'data/leaaf.sqlite')
const publicBaseUrl = env.PUBLIC_BASE_URL ?? 'http://localhost:5173'
const scannerPaths = {
  windows: resolve(env.SCANNER_EXE_PATH ?? '../scanner/dist/leaaf-scanner.exe'),
  linux: resolve(env.SCANNER_LINUX_PATH ?? '../scanner/dist/leaaf-scanner-linux'),
  macos: resolve(env.SCANNER_MACOS_PATH ?? '../scanner/dist/leaaf-scanner-macos.zip'),
}
const corpusIndexPath = resolve(env.CORPUS_INDEX_PATH ?? DEFAULT_CORPUS_INDEX_PATH)

// Fail at startup, not on the first request, when the ranking config or impact table is invalid
// (feature 003 FR-011).
const weights = loadWeights()
const impactTable = loadImpactTable()
const priceSources = loadPriceSources()

mkdirSync(dirname(databasePath), { recursive: true })
const db = new DatabaseSync(databasePath)

// The device and session routes work without retrieval or an LLM, so a missing index or API key
// disables only what depends on it, with a warning, instead of stopping the server.
let retriever: Retriever | null = null
try {
  retriever = openRetriever(corpusIndexPath)
} catch (error) {
  if (!(error instanceof IndexError)) throw error
  console.warn(`assessments disabled: ${error.message}`)
}

let llm: ReturnType<typeof createOpenAiCompatibleClient> | null = null
let extractor: FactExtractor | null = null
try {
  llm = createOpenAiCompatibleClient(loadLlmConfig(), { fetch: budgetedFetch(db, limits.dailyCalls) })
  extractor = createFactExtractor({ llm, cache: createSqliteFactCache(db) })
} catch (error) {
  if (!(error instanceof LlmError)) throw error
  console.warn(`fact extraction disabled, paths needing facts will read "cannot verify": ${error.message}`)
}

const warn = (message: string, details?: Record<string, unknown>) => app.log.warn(details ?? {}, message)

// Web search for models and topics the corpus does not cover (feature 017). Off without a key.
let webEvidence: WebEvidence | null = null
// The part lookup (feature 018) shares the provider chain, cache and daily cap.
let partSearch: PartWebSearch | null = null
// Web prices and local offers (feature 019) use the same providers and daily cap.
let webSearch: { config: SearchConfig; provider: SearchProvider; budget: SearchBudget } | null = null
try {
  const search = loadSearchConfig(env)
  if (!search) console.warn('web search off: no LANGSEARCH_API_KEY or TINYFISH_API_KEY set')
  else {
    webSearch = { config: search, provider: createConfiguredSearch(search, { warn }), budget: createSqliteSearchBudget(db, search.dailyCalls) }
    partSearch = {
      search: webSearch.provider,
      cache: createSqliteSearchCache(db),
      budget: webSearch.budget,
      timeoutMs: search.timeoutMs,
      resultsPerQuery: search.resultsPerQuery,
      maxChars: search.maxChars,
    }
    webEvidence = createWebEvidence({ ...partSearch, warn })
    console.log(`web search on: ${search.providers.map((p) => p.name).join(', then ')}`)
  }
} catch (error) {
  if (!(error instanceof SearchError)) throw error
  console.warn(`web search off: ${error.message}`)
}
const assessments = retriever ? createAssessmentService({ retriever, extractor, webEvidence, impactTable, weights, warn }) : undefined
// AI fallbacks are recorded for the admin page (feature 016 FR-016).
const fallbackLog = createFallbackLog(db)
const categorize = createCategoryService(db, llm, { impactTable, warn, onFallback: fallbackLog.record })
// Prices and offers ask the providers one by one rather than through the chain (search/lookup.ts).
const webLookup: WebLookup | null =
  llm && webSearch
    ? {
        providers: createProviders(webSearch.config),
        budget: webSearch.budget,
        llm,
        timeoutMs: webSearch.config.timeoutMs,
        resultsPerQuery: webSearch.config.resultsPerQuery,
        maxChars: webSearch.config.maxChars,
        warn,
      }
    : null
const prices =
  assessments && webLookup
    ? createPriceService({ web: webLookup, cache: createSqlitePriceCache(db), domains: priceSources, assessments, shownCategories: categorize.shown, impactTable })
    : undefined
// The town shared on a device link narrows local offers (feature 019). NOMINATIM_URL=none turns the
// lookup off; the button then always keeps Austria-wide offers.
const locationStore = createSqliteLocationStore(db)
const nominatimUrl = env.NOMINATIM_URL?.trim() || NOMINATIM_URL
const geocoder = nominatimUrl === 'none' ? null : createNominatim({ baseUrl: nominatimUrl, userAgent: `leaaf (${publicBaseUrl})`, warn })
const offers = assessments
  ? createOfferService(db, {
      web: webLookup,
      assessments,
      shownCategories: categorize.shown,
      townOf: locationStore.town,
      warn,
    })
  : undefined

// Part lookups need the corpus and an LLM; without the LLM the scan specs stay as before (feature 018 FR-007).
const parts = retriever && llm ? createPartLookupService({ retriever, llm, cache: createSqlitePartCache(db), web: partSearch, warn }) : undefined
if (!parts) console.warn('part lookup off: needs the corpus index and LLM_API_KEY')

const app = buildApp({
  limits,
  admin: loadAdminConfig(env),
  adminInsights: createAdminInsights(db, limits.dailyCalls),
  devices: createSqliteDeviceStore(db),
  sessions: createSqliteSessionStore(db),
  assessments,
  categorize,
  parts,
  steps: retriever && assessments ? createStepService(db, llm, { retriever, assessments, shownCategories: categorize.shown, warn, onFallback: fallbackLog.record }) : undefined,
  prices,
  offers,
  locations: { store: locationStore, geocoder },
  publicBaseUrl,
  scannerPaths,
  logger: {
    serializers: REQUEST_LOG_SERIALIZERS,
  },
})

// Scan data is deleted after SCAN_RETENTION_DAYS, as the privacy notice states (feature 006 FR-046).
schedulePurge(db, {
  purged: ({ devices, sessions }) => {
    if (devices || sessions) app.log.info({ devices, sessions }, 'deleted expired scan data')
  },
  failed: (error) => app.log.error({ err: error }, 'deleting expired scan data failed'),
})

await app.listen({ port, host })
