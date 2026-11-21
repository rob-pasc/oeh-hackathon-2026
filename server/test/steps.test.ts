// Step plans (feature 009): the step call, its checks, templates, cache and route.
import type { FallbackEvent } from '../src/admin/fallbacks.ts'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  API_ROUTES,
  checkStepPlan,
  createValidator,
  OPTION_KINDS,
  StepPlan,
  type CategoryResult,
  type DeviceRecord,
  type DeviceScan,
  type Passage,
  type StepPlan as StepPlanT,
} from '@leaaf/shared'
import { buildApp } from '../src/app.ts'
import { createAssessmentService, loadWeights, type DeviceAssessment } from '../src/assessment/index.ts'
import { fallbackCategories } from '../src/categories/index.ts'
import { SAFETY_RULES } from '../src/categories/prompt.ts'
import { createSqliteDeviceStore } from '../src/devices/store.ts'
import { loadImpactTable } from '../src/impact/table.ts'
import { LlmError, type JsonRequest, type LlmClient } from '../src/llm/index.ts'
import { hasNoFigure } from '../src/report/text.ts'
import { createRetriever, readCorpus, writeIndex, type Retriever } from '../src/retrieval/index.ts'
import { createSqliteSessionStore } from '../src/sessions/store.ts'
import {
  CONCRETE_RULE,
  createStepService,
  DEFAULT_WARNING,
  optionQuery,
  PROFESSIONAL_SENTENCE,
  STEP_SYSTEM,
  StepsOutput,
  STEPS_UNAVAILABLE,
  TEMPLATE_STEPS,
  templateSteps,
} from '../src/steps/index.ts'
import { exampleSteps, STEP_FIXTURE, STEP_OUTPUT, TEMPLATE_FIXTURE, templateFixture } from '../scripts/step-fixture.ts'

const FIXTURE_CORPUS = fileURLToPath(new URL('./fixtures/corpus/', import.meta.url))
const read = <T>(url: URL): T => JSON.parse(readFileSync(url, 'utf8')) as T
const baseScan = read<DeviceScan>(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url))
const sampleCategories = read<CategoryResult>(new URL('../../shared/fixtures/categories.example-laptop-14.office.json', import.meta.url))
const isPlan = createValidator(StepPlan)
const isOutput = createValidator(StepsOutput)

/** A laptop that matches the fixture corpus's Acme Book 14. */
const acmeScan: DeviceScan = {
  ...baseScan,
  identity: { ...baseScan.identity, manufacturer: 'Acme', model: 'Book 14', product_version: null, system_family: null },
}
const DEVICE_ID = 'q3Xk9vT2mB7pLw0cZr1sEa'
const record = (scan: DeviceScan = acmeScan): DeviceRecord => ({ device_id: DEVICE_ID, created_at: '2026-11-20T12:00:00.000Z', scan })

function fixtureRetriever(): Retriever {
  const db = new DatabaseSync(':memory:')
  writeIndex(db, readCorpus(FIXTURE_CORPUS))
  return createRetriever(db)
}

const retriever = fixtureRetriever()
const assessments = createAssessmentService({ retriever, extractor: null, impactTable: loadImpactTable(), weights: loadWeights() })

/** The sample AI categories for this device; their option IDs are what a card opens. */
const aiCategories = (_scan: DeviceScan, input: DeviceAssessment): CategoryResult => ({
  ...structuredClone(sampleCategories),
  device_id: input.assessment.device_id,
  intended_use: input.assessment.intended_use,
})

/** The sample answer, citing fixture-corpus passages that option retrieval finds for the SSD option. */
const answer = () => {
  const output = read<any>(STEP_OUTPUT)
  for (const step of output.steps)
    step.passage_ids = step.passage_ids.map((id: string) =>
      id === 'ex14-hmm#storage-1' ? 'acme-book14-manual#storage-drive-1' : id === 'ex14-hmm#battery-1' ? 'acme-book14-manual#keyboard-1' : id,
    )
  return output
}

const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

function setup(options: { shown?: typeof aiCategories; llm?: LlmClient | null } = {}) {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const completeJson = vi.fn(async (_request: JsonRequest<any>) => ({
    value: answer(),
    model: 'fake',
    attempts: 1,
    latency_ms: 1,
    usage: { prompt_tokens: 1, completion_tokens: 1 },
  }))
  const llm: LlmClient = { completeJson: completeJson as unknown as LlmClient['completeJson'] }
  const warnings: string[] = []
  const fallbacks: FallbackEvent[] = []
  const deps = {
    retriever,
    assessments,
    shownCategories: options.shown ?? aiCategories,
    warn: (m: string) => warnings.push(m),
    onFallback: (e: FallbackEvent) => fallbacks.push(e),
  }
  const make = (client: LlmClient | null) => createStepService(db, client, deps)
  return { db, completeJson, llm, warnings, fallbacks, make, steps: make(options.llm === undefined ? llm : options.llm) }
}

const valid = (plan: StepPlanT | null): StepPlanT => {
  expect(plan).not.toBeNull()
  expect(isPlan(plan).ok).toBe(true)
  expect(checkStepPlan(plan!)).toEqual([])
  return plan!
}

describe('the shared fixture', () => {
  it('is what the server builds from the sample answer (regenerate with scripts/step-fixture.ts)', () => {
    expect(read(STEP_FIXTURE)).toEqual(exampleSteps())
  })

  it('holds the template steps that mock mode shows for the fallback (regenerate with scripts/step-fixture.ts)', () => {
    expect(read(TEMPLATE_FIXTURE)).toEqual(templateFixture())
  })
})

describe('option retrieval', () => {
  it('finds the passages of the option kind first, then those of its closest path', () => {
    const ssd = sampleCategories.categories[0]!.options[0]!
    expect(optionQuery(ssd)).toMatchObject({ path: 'upgrade', facets: [{ name: 'kind' }, { name: 'title', terms: expect.arrayContaining(['swap', 'disk', 'ssd']) }] })
    const passages = retriever.retrieveOption(acmeScan, optionQuery(ssd))
    expect(passages[0]!.passage_id).toBe('acme-book14-manual#storage-drive-1')
    expect(passages.map((p) => p.document_id)).not.toContain('acme-book15-manual')
  })

  it('searches every topic for an option of kind other without a path', () => {
    const install = sampleCategories.categories[0]!.options[1]!
    expect(optionQuery(install).path).toBeNull()
    expect(retriever.retrieveOption(acmeScan, optionQuery(install)).map((p) => p.document_id)).toContain('reset-guide')
  })
})

describe('step answers (AC-002, AC-005, AC-006)', () => {
  it('keeps a valid answer as ordered steps with title, detail, tools, parts and time', async () => {
    const plan = valid(await setup().steps(record(), 'office', 'ssd-swap'))
    expect(plan).toMatchObject({ source: 'llm', notice: null, option_id: 'ssd-swap', device_id: DEVICE_ID, intended_use: 'office' })
    expect(plan.steps.map((s) => s.title)).toEqual(answer().steps.map((s: any) => s.title))
    expect(plan.steps[1]).toMatchObject({ parts: ['500 GB M.2 2280 NVMe SSD'], passage_ids: ['acme-book14-manual#storage-drive-1'] })
    expect(plan.passages.map((p) => p.passage_id).sort()).toEqual(['acme-book14-manual#keyboard-1', 'acme-book14-manual#storage-drive-1'])
  })

  it.each([
    ['no steps', (o: any) => (o.steps = [])],
    ['13 steps', (o: any) => (o.steps = Array.from({ length: 13 }, () => o.steps[0]))],
    ['a title over 80 characters', (o: any) => (o.steps[0].title = 'x'.repeat(81))],
    ['a step without a safety flag', (o: any) => delete o.steps[0].safety],
  ])('treats an answer with %s as invalid', (_name, change) => {
    const output = answer()
    expect(isOutput(output).ok).toBe(true)
    change(output)
    expect(isOutput(output).ok).toBe(false)
  })

  it('removes unknown citations, then technical steps left without one, and keeps uncited general steps', async () => {
    const { steps, completeJson } = setup()
    const general = { ...answer().steps[0], title: 'Back up your files' }
    const value = {
      steps: [
        { ...answer().steps[1], title: 'Cites an unknown passage', passage_ids: ['made-up#1'] },
        { ...answer().steps[3], title: 'Cites nothing', passage_ids: [] },
        general,
      ],
    }
    completeJson.mockResolvedValueOnce({ value, model: 'fake', attempts: 1, latency_ms: 1, usage: { prompt_tokens: 1, completion_tokens: 1 } })
    const plan = valid(await steps(record(), 'office', 'ssd-swap'))
    expect(plan.steps.map((s) => s.title)).toEqual(['Back up your files'])
    expect(plan.passages).toEqual([])
  })

  it('returns an empty plan when every step is removed (FR-006)', async () => {
    const { steps, completeJson } = setup()
    const value = { steps: [{ ...answer().steps[1], passage_ids: [] }] }
    completeJson.mockResolvedValueOnce({ value, model: 'fake', attempts: 1, latency_ms: 1, usage: { prompt_tokens: 1, completion_tokens: 1 } })
    const plan = valid(await steps(record(), 'office', 'ssd-swap'))
    expect(plan).toMatchObject({ source: 'llm', steps: [], passages: [] })
  })

  it('gives a caution step a warning, and makes a professional step name a service provider (FR-004)', async () => {
    const { steps, completeJson } = setup()
    const value = answer()
    value.steps[2].warning = null
    value.steps[3] = { ...value.steps[3], safety: 'professional', warning: 'stray', detail: 'Install the drive.' }
    completeJson.mockResolvedValueOnce({ value, model: 'fake', attempts: 1, latency_ms: 1, usage: { prompt_tokens: 1, completion_tokens: 1 } })
    const plan = valid(await steps(record(), 'office', 'ssd-swap'))
    expect(plan.steps[2]).toMatchObject({ safety: 'caution', warning: DEFAULT_WARNING })
    expect(plan.steps[3]).toMatchObject({ safety: 'professional', warning: null, detail: `Install the drive. ${PROFESSIONAL_SENTENCE}` })
  })

  it('drops a reversed time range, and Windows 11 steps on a Linux device', async () => {
    const { steps, completeJson } = setup()
    const value = answer()
    value.steps[0].minutes = { low: 20, high: 5 }
    value.steps[4].detail = 'Install Windows 11 from a USB stick.'
    completeJson.mockResolvedValue({ value, model: 'fake', attempts: 1, latency_ms: 1, usage: { prompt_tokens: 1, completion_tokens: 1 } })
    const windows = valid(await steps(record(), 'office', 'ssd-swap'))
    expect(windows.steps[0]!.minutes).toBeNull()
    expect(windows.steps).toHaveLength(5)
    const linux = valid(await steps(record({ ...acmeScan, os: { ...acmeScan.os, family: 'linux' } }), 'study', 'ssd-swap'))
    expect(linux.steps).toHaveLength(4)
  })
})

describe('figures (AC-008)', () => {
  it.each([
    ['a euro amount', 'An SSD costs about €40.'],
    ['a CO₂e amount', 'This saves 25 kg CO₂e.'],
  ])('rejects an answer whose step text contains %s, without caching it', async (_name, text) => {
    const { steps, completeJson, warnings, fallbacks } = setup()
    const value = answer()
    value.steps[1].detail = text
    completeJson.mockResolvedValueOnce({ value, model: 'fake', attempts: 1, latency_ms: 1, usage: { prompt_tokens: 1, completion_tokens: 1 } })
    const plan = valid(await steps(record(), 'office', 'ssd-swap'))
    expect(plan).toMatchObject({ source: 'template', notice: STEPS_UNAVAILABLE })
    expect(warnings).toEqual([expect.stringContaining('figure')])
    expect(fallbacks.map((f) => f.reason)).toEqual(['rejected_answer'])
    expect((await steps(record(), 'office', 'ssd-swap'))!.source).toBe('llm')
    expect(completeJson).toHaveBeenCalledTimes(2)
  })
})

describe('the step call (AC-009)', () => {
  it('sends the scan, intended use, option, facts and the option’s passages, with the concrete and safety rules', async () => {
    const { steps, completeJson } = setup()
    await steps(record(), 'study', 'ssd-swap')
    const request = completeJson.mock.calls[0]![0]
    expect(request.task).toBe('steps')
    expect(request.system).toBe(STEP_SYSTEM)
    expect(request.system).toContain(CONCRETE_RULE)
    for (const rule of SAFETY_RULES) expect(request.system).toContain(rule)
    expect(request.system).toMatch(/Austria/)
    const user = JSON.parse(request.user)
    expect(user.scan).toMatchObject({ manufacturer: 'Acme', model: 'Book 14', cpu: acmeScan.cpu, memory: acmeScan.memory })
    expect(user.intended_use).toBe('study')
    expect(user.option).toEqual({
      title: 'Swap the hard disk for a 500 GB SSD',
      kind: 'ssd',
      difficulty: 'diy_moderate',
      status: 'viable',
      reason: expect.any(String),
      why: expect.any(String),
    })
    expect(user.facts).toEqual([])
    const ids = user.passages.map((p: Passage) => p.passage_id)
    expect(ids[0]).toBe('acme-book14-manual#storage-drive-1')
    // The option's own category claim cites a passage that option retrieval did not find; it is supplied too.
    expect(ids).toContain('ex14-hmm#storage-1')
    expect(request.user).not.toContain(DEVICE_ID)
  })

  it('answers null for an option the shown categories do not have', async () => {
    const { steps, completeJson } = setup()
    expect(await steps(record(), 'office', 'no-such-option')).toBeNull()
    expect(completeJson).not.toHaveBeenCalled()
  })
})

describe('cache (AC-001)', () => {
  it('makes one call per device, use and option, shares concurrent opens, and survives a restart', async () => {
    const { completeJson, llm, make, steps } = setup()
    const [first, second] = await Promise.all([steps(record(), 'office', 'ssd-swap'), steps(record(), 'office', 'ssd-swap')])
    expect(second).toEqual(first)
    expect(await steps(record(), 'office', 'ssd-swap')).toEqual(first)
    expect(await make(llm)(record(), 'office', 'ssd-swap')).toEqual(first)
    expect(await make(null)(record(), 'office', 'ssd-swap')).toEqual(first)
    expect(completeJson).toHaveBeenCalledTimes(1)
    await steps(record(), 'office', 'ram-add')
    await steps(record(), 'gaming', 'ssd-swap')
    expect(completeJson).toHaveBeenCalledTimes(3)
  })

  it('asks again when the prompt or the option changed', async () => {
    const { db, completeJson, steps } = setup()
    await steps(record(), 'office', 'ssd-swap')
    db.exec("UPDATE step_cache SET prompt_hash = 'older-prompt'")
    await steps(record(), 'office', 'ssd-swap')
    expect(completeJson).toHaveBeenCalledTimes(2)

    const renamed = (scan: DeviceScan, input: DeviceAssessment) => {
      const result = aiCategories(scan, input)
      result.categories[0]!.options[0]!.title = 'Swap the hard disk for a 1 TB SSD'
      return result
    }
    const changed = createStepService(db, { completeJson } as unknown as LlmClient, { retriever, assessments, shownCategories: renamed })
    await changed(record(), 'office', 'ssd-swap')
    expect(completeJson).toHaveBeenCalledTimes(3)
  })
})

describe('template plans (AC-011, AC-012)', () => {
  it('shows the template plan for the option kind when no LLM is configured', async () => {
    const { steps, warnings, fallbacks } = setup({ llm: null })
    const plan = valid(await steps(record(), 'office', 'ram-add'))
    expect(fallbacks).toEqual([{ device_id: DEVICE_ID, intended_use: 'office', call: 'steps', option_id: 'ram-add', reason: 'no_llm' }])
    expect(plan).toMatchObject({ source: 'template', notice: STEPS_UNAVAILABLE })
    expect(plan.steps.map((s) => s.title)).toEqual(TEMPLATE_STEPS.ram.map((s) => s.title))
    expect(warnings).toEqual([expect.stringContaining('no LLM configured')])
  })

  it.each([
    ['a provider error', new LlmError('unavailable', 'HTTP 503')],
    ['a timeout', new LlmError('timeout', 'Step deadline exceeded')],
    ['an invalid answer after repair', new LlmError('invalid_output', 'bad')],
    ['the daily budget', new LlmError('rate_limited', 'limit')],
  ])('shows the template plan after %s, and retries on the next open', async (_name, error) => {
    const { steps, completeJson, warnings, fallbacks } = setup()
    completeJson.mockRejectedValueOnce(error)
    const plan = valid(await steps(record(), 'office', 'battery-swap'))
    expect(fallbacks.map((f) => f.reason)).toEqual([error.kind])
    expect(plan).toMatchObject({ source: 'template', notice: STEPS_UNAVAILABLE })
    expect(plan.steps.map((s) => s.title)).toEqual(TEMPLATE_STEPS.battery.map((s) => s.title))
    expect(warnings).toEqual([expect.stringContaining(error.message)])
    expect((await steps(record(), 'office', 'battery-swap'))!.source).toBe('llm')
    expect(completeJson).toHaveBeenCalledTimes(2)
  })

  it('uses template plans for the five-path fallback without any provider call (FR-012)', async () => {
    const { steps, completeJson, fallbacks } = setup({ shown: (_scan, input) => fallbackCategories(input) })
    for (const path of ['upgrade', 'repair', 'pass_on', 'salvage', 'recycle']) {
      const plan = valid(await steps(record(), 'office', path))
      expect(plan).toMatchObject({ source: 'template', notice: STEPS_UNAVAILABLE, option_id: path })
      expect(plan.steps.length).toBeGreaterThan(0)
    }
    expect(completeJson).not.toHaveBeenCalled()
    // The category fallback is recorded by the category service; the steps add nothing (feature 013 FR-016).
    expect(fallbacks).toEqual([])
  })

  describe.each(OPTION_KINDS)('the %s template', (kind) => {
    it('has 1 to 12 steps without figures, and cites or flags every technical step', () => {
      const passages = retriever.retrieveOption(acmeScan, { path: null, facets: [{ name: 'all', terms: ['battery', 'memory', 'drive', 'reset', 'collection'] }] }, { k: 20 })
      for (const available of [[], passages]) {
        const steps = templateSteps(kind, available)
        expect(steps.length).toBeGreaterThan(0)
        expect(steps.length).toBeLessThanOrEqual(12)
        const plan = { device_id: DEVICE_ID, intended_use: 'office', option_id: 'x', generated_at: '2026-11-21T12:00:00Z', source: 'template', notice: STEPS_UNAVAILABLE, steps, passages: available } as StepPlanT
        expect(isPlan(plan).ok).toBe(true)
        expect(checkStepPlan(plan)).toEqual([])
        for (const s of steps) {
          expect([s.title, s.detail, s.warning ?? '', ...s.tools, ...s.parts].every(hasNoFigure)).toBe(true)
          if (s.kind === 'technical') expect(s.passage_ids.length > 0 || s.safety === 'professional').toBe(true)
          if (s.safety === 'professional') expect(s.detail).toMatch(/service provider/i)
        }
        if (available.length === 0) for (const s of steps) expect(s.kind === 'general' || s.safety === 'professional').toBe(true)
      }
    })
  })

  it('cites the device’s own manual in the SSD template when it matches', () => {
    const passages = retriever.retrieveOption(acmeScan, optionQuery(sampleCategories.categories[0]!.options[0]!))
    const steps = templateSteps('ssd', passages)
    expect(steps.find((s) => s.title === 'Swap the drive')).toMatchObject({ safety: 'none', passage_ids: ['acme-book14-manual#storage-drive-1'] })
  })
})

describe('GET /api/devices/:id/options/:optionId/steps', () => {
  function app() {
    const db = new DatabaseSync(':memory:')
    databases.push(db)
    const devices = createSqliteDeviceStore(db)
    const { steps } = setup()
    const server = buildApp({ devices, sessions: createSqliteSessionStore(db), steps, publicBaseUrl: 'https://leaaf.example' })
    return { server, device: devices.create(acmeScan) }
  }

  it('answers the plan as JSON', async () => {
    const { server, device } = app()
    const res = await server.inject({ method: 'GET', url: API_ROUTES.optionSteps(device.device_id, 'ssd-swap', 'office') })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    const plan = valid(res.json())
    expect(plan).toMatchObject({ device_id: device.device_id, option_id: 'ssd-swap', source: 'llm' })
  })

  it.each([
    ['an unknown intended use', (id: string) => `/api/devices/${id}/options/ssd-swap/steps?intended_use=mining`, 400],
    ['a missing intended use', (id: string) => `/api/devices/${id}/options/ssd-swap/steps`, 400],
    ['an unknown device', () => API_ROUTES.optionSteps('AAAAAAAAAAAAAAAAAAAAAA', 'ssd-swap', 'office'), 404],
    ['an unknown option', (id: string) => API_ROUTES.optionSteps(id, 'no-such-option', 'office'), 404],
  ])('rejects %s', async (_name, url, status) => {
    const { server, device } = app()
    const res = await server.inject({ method: 'GET', url: url(device.device_id) })
    expect(res.statusCode).toBe(status)
    expect(res.json()).toMatchObject({ error: status === 400 ? 'invalid_payload' : 'not_found' })
  })

  it('answers 500 when the server cannot build step plans', async () => {
    const db = new DatabaseSync(':memory:')
    databases.push(db)
    const devices = createSqliteDeviceStore(db)
    const server = buildApp({ devices, sessions: createSqliteSessionStore(db), publicBaseUrl: 'https://leaaf.example' })
    const res = await server.inject({ method: 'GET', url: API_ROUTES.optionSteps(devices.create(acmeScan).device_id, 'ssd-swap', 'office') })
    expect(res.statusCode).toBe(500)
  })
})
