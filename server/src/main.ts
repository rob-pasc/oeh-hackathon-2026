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
import { createSqliteSessionStore } from './sessions/store.ts'
import { createStepService } from './steps/service.ts'

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
const assessments = retriever ? createAssessmentService({ retriever, extractor, impactTable, weights, warn }) : undefined
// AI fallbacks are recorded for the admin page (feature 016 FR-016).
const fallbackLog = createFallbackLog(db)
const categorize = createCategoryService(db, llm, { impactTable, warn, onFallback: fallbackLog.record })

const app = buildApp({
  limits,
  admin: loadAdminConfig(env),
  adminInsights: createAdminInsights(db, limits.dailyCalls),
  devices: createSqliteDeviceStore(db),
  sessions: createSqliteSessionStore(db),
  assessments,
  categorize,
  steps: retriever && assessments ? createStepService(db, llm, { retriever, assessments, shownCategories: categorize.shown, warn, onFallback: fallbackLog.record }) : undefined,
  publicBaseUrl,
  scannerPaths,
  logger: {
    serializers: REQUEST_LOG_SERIALIZERS,
  },
})

await app.listen({ port, host })
