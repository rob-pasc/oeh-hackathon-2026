// Assessment and explanation events from the device report stream.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import {
  API_ROUTES,
  Assessment,
  checkAssessment,
  createValidator,
  PATHS,
  type DeviceRecord,
  type DeviceScan,
  type Fact,
  type IntendedUse,
} from '@leaaf/shared'
import { buildApp, type AppOptions } from '../src/app.ts'
import { createAssessmentService, loadWeights, type AssessmentService } from '../src/assessment/index.ts'
import { createSqliteDeviceStore } from '../src/devices/store.ts'
import { createFactExtractor, createMemoryFactCache } from '../src/facts/index.ts'
import { loadImpactTable } from '../src/impact/table.ts'
import { LlmError, type LlmClient } from '../src/llm/index.ts'
import { createRetriever, readCorpus, writeIndex, type Retriever } from '../src/retrieval/index.ts'
import { createSqliteSessionStore } from '../src/sessions/store.ts'

const FIXTURE_CORPUS = fileURLToPath(new URL('./fixtures/corpus/', import.meta.url))
const baseScan = JSON.parse(
  readFileSync(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url), 'utf8'),
) as DeviceScan
const isAssessment = createValidator(Assessment)
const impactTable = loadImpactTable()
const weights = loadWeights()

/** A laptop that matches the fixture corpus's Acme Book 14 (model evidence exists). */
const acmeScan: DeviceScan = {
  ...baseScan,
  identity: { ...baseScan.identity, manufacturer: 'Acme', model: 'Book 14', product_version: null, system_family: null },
  cpu: { ...baseScan.cpu, name: 'Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz' },
}
const unknownScan: DeviceScan = { ...acmeScan, identity: { ...acmeScan.identity, model: 'Book 99' } }

function fixtureRetriever(): Retriever {
  const db = new DatabaseSync(':memory:')
  writeIndex(db, readCorpus(FIXTURE_CORPUS))
  return createRetriever(db)
}

/** Fake LLM: answers every call with `facts(passageIds)`, or throws `error`; counts calls. */
function fakeLlm(options: { facts?: (ids: string[]) => Fact[]; error?: LlmError } = {}) {
  let calls = 0
  const llm: LlmClient = {
    async completeJson(request) {
      calls++
      if (options.error) throw options.error
      const passages = /<passages>\n([\s\S]*)\n<\/passages>/.exec(request.user)?.[1] ?? '[]'
      const ids = (JSON.parse(passages) as { passage_id: string }[]).map((p) => p.passage_id)
      return {
        value: { facts: options.facts?.(ids) ?? [] } as any,
        model: 'fake',
        attempts: 1,
        latency_ms: 1,
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }
    },
  }
  return { llm, calls: () => calls }
}

const record = (scan: DeviceScan): DeviceRecord => ({
  device_id: 'q3Xk9vT2mB7pLw0cZr1sEa',
  created_at: '2026-11-20T12:00:00.000Z',
  scan,
})

function service(llm: LlmClient | null, warnings: string[] = []) {
  return createAssessmentService({
    retriever: fixtureRetriever(),
    extractor: llm ? createFactExtractor({ llm, cache: createMemoryFactCache() }) : null,
    impactTable,
    weights,
    warn: (message) => warnings.push(message),
    now: () => new Date('2026-11-20T12:00:00Z'),
  })
}

describe('assessment service', () => {
  it('assesses a matched model with the facts extracted from its retrieved passages', async () => {
    const { llm, calls } = fakeLlm({
      facts: (ids) => [{ key: 'ram_soldered', value: 'all', source_passage_ids: [ids[0]!] } as Fact],
    })
    const { assessment, retrieval, facts } = await service(llm).assessDevice(record(acmeScan), 'office')

    expect(retrieval.model_evidence).toBe('model_specific')
    expect(facts.facts.map((f) => f.key)).toEqual(['ram_soldered'])
    expect(calls()).toBe(1)
    expect(isAssessment(assessment).ok).toBe(true)
    expect(checkAssessment(assessment)).toEqual([])
    expect(assessment).toMatchObject({ device_id: 'q3Xk9vT2mB7pLw0cZr1sEa', intended_use: 'office', model_evidence: 'model_specific' })
    expect(assessment.paths.map((p) => p.path)).toEqual([...PATHS])
  })

  it('marks compatibility-dependent paths "cannot verify" for an unknown model (FR-004)', async () => {
    const { assessment } = await service(fakeLlm().llm).assessDevice(record(unknownScan), 'office')

    expect(assessment.model_evidence).toBe('none')
    for (const path of ['upgrade', 'repair'] as const)
      expect(assessment.paths.find((p) => p.path === path)?.status).not.toBe('viable')
  })

  it('still assesses, without facts, when fact extraction fails', async () => {
    const warnings: string[] = []
    const { llm } = fakeLlm({ error: new LlmError('timeout', 'too slow') })
    const { assessment, facts } = await service(llm, warnings).assessDevice(record(acmeScan), 'office')

    expect(facts.facts).toEqual([])
    expect(checkAssessment(assessment)).toEqual([])
    expect(warnings).toEqual([expect.stringContaining('fact extraction failed')])
  })

  it('assesses without facts when no LLM is configured', async () => {
    const { facts, assessment } = await service(null).assessDevice(record(acmeScan), 'development')
    expect(facts.facts).toEqual([])
    expect(assessment.intended_use).toBe('development')
  })
})

const servers: { close(): Promise<unknown> }[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()))
})

function setup(assessments?: AssessmentService, explain?: AppOptions['explain']) {
  const db = new DatabaseSync(':memory:')
  const devices = createSqliteDeviceStore(db)
  const app = buildApp({ devices, sessions: createSqliteSessionStore(db), assessments, explain, publicBaseUrl: 'https://leaaf.example' })
  servers.push(app)
  return { app, device: devices.create(acmeScan) }
}

/** Reads every SSE frame until the server closes the stream. */
async function readStream(url: string) {
  const res = await fetch(url)
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('text/event-stream')
  const events: { name: string; data: any }[] = []
  for (const frame of (await res.text()).split('\n\n')) {
    const name = /^event: (.+)$/m.exec(frame)?.[1]
    const data = /^data: (.+)$/m.exec(frame)?.[1]
    if (name && data) events.push({ name, data: JSON.parse(data) })
  }
  return events
}

describe('GET /api/devices/:id/report', () => {
  it('delivers the generated report between assessment and end', async () => {
    const sample = JSON.parse(readFileSync(new URL('../../shared/fixtures/report.example-laptop-14.office.json', import.meta.url), 'utf8'))
    const { app, device } = setup(service(null), async (_scan, { assessment }) => ({ ...sample, device_id: assessment.device_id }))
    const base = await app.listen({ port: 0, host: '127.0.0.1' })
    const events = await readStream(base + API_ROUTES.reportStream(device.device_id, 'office'))
    expect(events.map(e => e.name)).toEqual(['assessment', 'report', 'end'])
    expect(events[1]!.data).toEqual({ ...sample, device_id: device.device_id })
  })

  it('streams the assessment, then end, and closes', async () => {
    const { app, device } = setup(service(fakeLlm().llm))
    const base = await app.listen({ port: 0, host: '127.0.0.1' })
    const events = await readStream(base + API_ROUTES.reportStream(device.device_id, 'study'))

    expect(events.map((e) => e.name)).toEqual(['assessment', 'end'])
    const assessment = events[0]!.data
    expect(isAssessment(assessment).ok).toBe(true)
    expect(assessment).toMatchObject({ device_id: device.device_id, intended_use: 'study' })
    expect(events[1]!.data).toEqual({ status: 'complete' })
  })

  it('reports an internal error as an error event, without details', async () => {
    const failing: AssessmentService = {
      assessDevice: async () => {
        throw new Error('secret internal detail')
      },
    }
    const { app, device } = setup(failing)
    const base = await app.listen({ port: 0, host: '127.0.0.1' })
    const events = await readStream(base + API_ROUTES.reportStream(device.device_id, 'office'))

    expect(events).toEqual([{ name: 'error', data: { error: 'internal', message: 'the assessment failed' } }])
  })

  it.each(['general', 'gaming'] as const)('streams an assessment for the %s use (AC-016)', async (use) => {
    const { app, device } = setup(service(null))
    const base = await app.listen({ port: 0, host: '127.0.0.1' })
    const events = await readStream(base + API_ROUTES.reportStream(device.device_id, use))

    expect(events.map((e) => e.name)).toEqual(['assessment', 'end'])
    expect(isAssessment(events[0]!.data).ok).toBe(true)
    expect(events[0]!.data.intended_use).toBe(use)
  })

  it.each([undefined, 'work', 'OFFICE'])('rejects the intended use %s with 400', async (use) => {
    const { app, device } = setup(service(null))
    const query = use === undefined ? '' : `?intended_use=${use}`
    const res = await app.inject({ method: 'GET', url: `/api/devices/${device.device_id}/report${query}` })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ error: 'invalid_payload', fields: [{ path: '/intended_use' }] })
  })

  it('answers unknown and malformed device IDs with the same 404', async () => {
    const { app } = setup(service(null))
    for (const id of ['AAAAAAAAAAAAAAAAAAAAAA', 'not-an-id']) {
      const res = await app.inject({ method: 'GET', url: API_ROUTES.reportStream(id, 'office' as IntendedUse) })
      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ error: 'not_found', message: 'device not found' })
    }
  })

  it('fails with 500 when the server has no assessment service', async () => {
    const { app, device } = setup()
    const res = await app.inject({ method: 'GET', url: API_ROUTES.reportStream(device.device_id, 'office') })
    expect(res.statusCode).toBe(500)
    expect(res.json()).toMatchObject({ error: 'internal' })
  })
})
