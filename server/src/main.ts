// Server entry point. Configuration comes from environment variables (server/.env.example).
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildApp } from './app.ts'
import { loadWeights } from './assessment/weights.ts'
import { createSqliteDeviceStore } from './devices/store.ts'
import { loadImpactTable } from './impact/table.ts'
import { createSqliteSessionStore } from './sessions/store.ts'

const env = process.env
const port = Number(env.PORT ?? 3000)
const host = env.HOST ?? '127.0.0.1'
const databasePath = resolve(env.DATABASE_PATH ?? 'data/leaaf.sqlite')
const publicBaseUrl = env.PUBLIC_BASE_URL ?? 'http://localhost:5173'
const scannerExePath = resolve(env.SCANNER_EXE_PATH ?? '../scanner/dist/leaaf-scanner.exe')

// Fail at startup, not on the first request, when the ranking config or impact table is invalid
// (feature 003 FR-011). The assessment route will receive these once it exists.
loadWeights()
loadImpactTable()

mkdirSync(dirname(databasePath), { recursive: true })
const db = new DatabaseSync(databasePath)

const app = buildApp({
  devices: createSqliteDeviceStore(db),
  sessions: createSqliteSessionStore(db),
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
