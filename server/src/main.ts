// Server entry point. Configuration comes from environment variables (server/.env.example).
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildApp } from './app.ts'
import { createAssessmentService } from './assessment/service.ts'
import { loadWeights } from './assessment/weights.ts'
import { createSqliteDeviceStore } from './devices/store.ts'
import { createFactExtractor, createSqliteFactCache, type FactExtractor } from './facts/index.ts'
import { loadImpactTable } from './impact/table.ts'
import { createOpenAiCompatibleClient, LlmError, loadLlmConfig } from './llm/index.ts'
import { DEFAULT_CORPUS_INDEX_PATH, IndexError, openRetriever, type Retriever } from './retrieval/index.ts'
import { createSqliteSessionStore } from './sessions/store.ts'

const env = process.env
const port = Number(env.PORT ?? 3000)
const host = env.HOST ?? '127.0.0.1'
const databasePath = resolve(env.DATABASE_PATH ?? 'data/leaaf.sqlite')
const publicBaseUrl = env.PUBLIC_BASE_URL ?? 'http://localhost:5173'
const scannerExePath = resolve(env.SCANNER_EXE_PATH ?? '../scanner/dist/leaaf-scanner.exe')
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

let extractor: FactExtractor | null = null
try {
  extractor = createFactExtractor({ llm: createOpenAiCompatibleClient(loadLlmConfig()), cache: createSqliteFactCache(db) })
} catch (error) {
  if (!(error instanceof LlmError)) throw error
  console.warn(`fact extraction disabled, paths needing facts will read "cannot verify": ${error.message}`)
}

const app = buildApp({
  devices: createSqliteDeviceStore(db),
  sessions: createSqliteSessionStore(db),
  assessments: retriever ? createAssessmentService({ retriever, extractor, impactTable, weights, warn: (message, details) => app.log.warn(details ?? {}, message) }) : undefined,
  publicBaseUrl,
  scannerExePath,
  logger: {
    // Log the route pattern, never the raw URL or the client IP, so full device IDs are never
    // logged together with request IPs (feature 001 privacy requirement).
    serializers: {
      req: (req) => ({ method: req.method, route: req.routeOptions?.url ?? 'unmatched' }),
    },
  },
})

await app.listen({ port, host })
