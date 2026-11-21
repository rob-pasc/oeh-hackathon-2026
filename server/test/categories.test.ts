// AI categories and options (feature 008): server checks, figures, scores, fallback and cache.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CategoryResult,
  checkCategoryResult,
  createValidator,
  type Assessment,
  type DeviceScan,
  type FactSet,
  type RetrievalResult,
} from '@leaaf/shared'
import { calculateImpact, DIFFICULTY_FEASIBILITY, indexImpactTable, rubricScores, runGates } from '../src/assessment/index.ts'
import {
  AI_ESTIMATE_CONFIDENCE,
  buildCategoryRequest,
  buildResult,
  CATEGORY_SYSTEM,
  createCategoryService,
  FALLBACK_NOTICE,
  SAFETY_RULES,
} from '../src/categories/index.ts'
import * as prompt from '../src/categories/prompt.ts'
import { loadImpactTable } from '../src/impact/table.ts'
import { LlmError, type LlmClient } from '../src/llm/index.ts'
import { CATEGORY_FIXTURE, exampleCategories } from '../scripts/category-fixture.ts'

const shared = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`../../shared/fixtures/${name}.json`, import.meta.url), 'utf8')) as T

const scan = shared<DeviceScan>('device-scan.laptop-complete')
const assessment = shared<Assessment>('assessment.example-laptop-14.office')
const facts = shared<FactSet>('facts.example-laptop-14')
const retrieval = shared<RetrievalResult>('retrieval.example-laptop-14')
const input = { assessment, facts, retrieval }
const impactTable = loadImpactTable()
const sampleOutput = JSON.parse(
  readFileSync(new URL('./fixtures/category-output.example-laptop-14.json', import.meta.url), 'utf8'),
)
const isResult = createValidator(CategoryResult)
const NOW = '2026-11-21T12:00:00Z'

/** A fresh copy of the sample answer, so each test can change it. */
const answer = () => structuredClone(sampleOutput)
const build = (output = answer(), device: DeviceScan = scan) => buildResult(device, input, output, NOW, impactTable)
const option = (result: CategoryResult, id: string) => result.categories.flatMap((c) => c.options).find((o) => o.option_id === id)!

const valid = (result: CategoryResult) => {
  expect(isResult(result).ok).toBe(true)
  expect(checkCategoryResult(result, assessment.baseline)).toEqual([])
}

describe('the shared fixture', () => {
  it('is what the server builds from the sample answer (regenerate with scripts/category-fixture.ts)', () => {
    expect(JSON.parse(readFileSync(CATEGORY_FIXTURE, 'utf8'))).toEqual(exampleCategories())
  })
})

describe('category answers (AC-001, AC-002)', () => {
  it('keeps the categories, labels, summaries and options of a valid answer', () => {
    const output = answer()
    output.categories = output.categories.slice(0, 4)
    const result = build(output)
    valid(result)
    expect(result).toMatchObject({ source: 'llm', notice: null, device_id: assessment.device_id, intended_use: 'office' })
    expect(result.categories.map((c) => [c.category_id, c.label, c.summary])).toEqual(
      output.categories.map((c: any) => [c.category_id, c.label, c.summary]),
    )
    expect(result.categories.map((c) => c.options.map((o) => o.option_id))).toEqual(
      output.categories.map((c: any) => c.options.map((o: any) => o.option_id)),
    )
  })

  it.each([
    ['two categories', (o: any) => (o.categories = o.categories.slice(0, 2))],
    ['seven categories', (o: any) => (o.categories = [...o.categories, ...o.categories.slice(0, 2)])],
    ['an option without a kind', (o: any) => delete o.categories[0].options[0].kind],
    ['an option without a difficulty', (o: any) => delete o.categories[0].options[0].difficulty],
    ['a label longer than 24 characters', (o: any) => (o.categories[0].label = 'A label that is far too long')],
  ])('treats an answer with %s as invalid', (_name, change) => {
    const output = answer()
    change(output)
    expect(createValidator(prompt.CategoryOutput)(output).ok).toBe(false)
  })

  it('delivers a not-a-fit option with its reason and without figures or a score, even if the AI sent figures', () => {
    const gpu = option(build(), 'gpu-add')
    expect(sampleOutput.categories[3].options[0].estimate).not.toBeNull()
    expect(gpu).toMatchObject({ status: 'not_suitable', reason: expect.any(String), impact: null, impact_source: null, scores: null })
  })

  it('makes repeated IDs unique instead of rejecting the answer', () => {
    const output = answer()
    output.categories[1].category_id = 'faster-storage'
    output.categories[0].options[1].option_id = 'ssd-swap'
    const result = build(output)
    valid(result)
    expect(result.categories.map((c) => c.category_id).slice(0, 2)).toEqual(['faster-storage', 'faster-storage-2'])
    expect(result.categories[0]!.options.map((o) => o.option_id)).toEqual(['ssd-swap', 'ssd-swap-2'])
  })
})

describe('figures (AC-003, AC-004)', () => {
  const index = indexImpactTable(impactTable)

  it('prices an ssd option with the calculator, exactly like the SSD part, with impact references', () => {
    const ssd = option(build(), 'ssd-swap')
    const expected = calculateImpact({
      plan: { path: 'upgrade', ssd: 'nvme', ram: null, ram_after_gb: null },
      use: 'office',
      scan,
      baseline: assessment.baseline,
      impact: index,
    })
    expect(ssd.impact_source).toBe('calculator')
    expect(ssd.impact).toEqual(expected)
    const refs = ssd.impact!.assumptions.flatMap((a) => a.impact_refs)
    expect(refs).toEqual(expect.arrayContaining(['part.ssd_500gb.price', 'part.ssd_500gb.production_co2e', 'life_extra.upgrade.office']))
  })

  it('prices a battery job as professional whenever the AI says so', () => {
    const output = answer()
    output.categories[2].options[0].difficulty = 'professional'
    const battery = option(build(output), 'battery-swap')
    expect(battery.impact!.assumptions.flatMap((a) => a.impact_refs)).toContain('service.battery_replacement.price')
  })

  it('keeps valid AI ranges of an other option, marked as an AI estimate', () => {
    const estimate = option(build(), 'clean-install')
    expect(estimate.impact_source).toBe('ai_estimate')
    expect(estimate.impact).toMatchObject({
      cost_eur: { low: 0, high: 0 },
      useful_life_years: { low: 0, high: 1 },
      co2e_kg: { path: { low: 0, high: 0 }, baseline: assessment.baseline.co2e_kg },
      assumptions: [{ text: expect.stringMatching(/^AI estimate/) }, expect.anything()],
    })
    expect(estimate.scores).not.toBeNull()
  })

  it.each([
    ['low above high', { cost_eur: { low: 50, high: 10 } }],
    ['a negative cost', { cost_eur: { low: -5, high: 10 } }],
    ['a negative extra life', { useful_life_years: { low: -1, high: 1 } }],
    ['a negative CO₂e', { co2e_kg: { low: -10, high: 0 } }],
  ])('drops the figures and score of an AI estimate with %s, leaving the other options alone', (_name, change) => {
    const output = answer()
    Object.assign(output.categories[0].options[1].estimate, change)
    const result = build(output)
    valid(result)
    expect(option(result, 'clean-install')).toMatchObject({ impact: null, impact_source: null, scores: null })
    expect(option(result, 'ssd-swap')).toEqual(option(build(), 'ssd-swap'))
  })
})

describe('statuses capped by the gates (feature 011 AC-005 to AC-009)', () => {
  const gaming = { ...input, assessment: { ...assessment, intended_use: 'gaming' as const } }
  const buildFor = (device: DeviceScan, use: typeof gaming | typeof input, output = answer()) => buildResult(device, use, output, NOW, impactTable)
  const desktop: DeviceScan = { ...scan, identity: { ...scan.identity, form_factor: 'desktop' }, battery: { ...scan.battery, present: false } }

  it('lowers a Good fit SSD option to Depends when the upgrade gate depends, and keeps it with a viable gate (AC-005)', () => {
    expect(runGates({ scan, use: 'gaming', modelEvidence: assessment.model_evidence, facts: facts.facts }).find((g) => g.path === 'upgrade')!.status).toBe('conditional')
    expect(option(buildFor(scan, gaming), 'ssd-swap').status).toBe('conditional')
    expect(option(build(), 'ssd-swap').status).toBe('viable')
  })

  it('never raises an option the AI rated lower than its gate (AC-005)', () => {
    const output = answer()
    output.categories.find((c: { category_id: string }) => c.category_id === 'memory').options[0].status = 'conditional'
    expect(option(build(output), 'ram-add').status).toBe('conditional')
  })

  it('makes a battery option Not a fit on a desktop and leaves other kinds to the AI (AC-006, AC-007)', () => {
    const output = answer()
    const handDown = output.categories.find((c: { category_id: string }) => c.category_id === 'hand-down')
    handDown.options[1].kind = 'salvage' // the salvage gate is conditional for this laptop
    const result = buildFor(desktop, input, output)
    const battery = option(result, 'battery-swap')
    expect(battery).toMatchObject({ status: 'not_suitable', impact: null, scores: null })
    expect(battery.reason).toBe('No battery was detected, so there is no battery to repair.')
    expect(option(result, 'recycle').status).toBe('viable')
    expect(option(result, 'clean-install').status).toBe('conditional')
    expect(option(result, 'donate').status).toBe('viable')
    valid(result)
  })

  it('replaces the reason of a lowered option with the gate’s limiting reason (AC-007)', () => {
    const ssd = option(buildFor(scan, gaming), 'ssd-swap')
    expect(ssd.reason).toMatch(/integrated graphics/)
    expect(ssd.impact).not.toBeNull()
    expect(ssd.scores!.feasibility).toBe(DIFFICULTY_FEASIBILITY[ssd.difficulty] - 20)
    expect(option(build(), 'ssd-swap').reason).toBe(answer().categories[0].options[0].reason)
  })

  it('caps a cached answer as well, without another call (AC-008)', async () => {
    const { db, completeJson, categorize } = setup()
    await categorize(scan, gaming)
    const cached = await createCategoryService(db, null, { impactTable })(scan, gaming)
    expect(cached.source).toBe('llm')
    expect(option(cached, 'ssd-swap').status).toBe('conditional')
    expect(completeJson).toHaveBeenCalledTimes(1)
  })

  it('does not recommend an SSD upgrade for gaming on the tested 4 GB / i3 mini PC (AC-009)', () => {
    // From the team's scan of 2026-11-21 (MSI MS-B09611): no recognized graphics, 4 GB DDR3, 128 GB SSD.
    const miniPc: DeviceScan = {
      ...desktop,
      identity: { ...desktop.identity, manufacturer: 'MICRO-STAR INTERNATIONAL CO., LTD', model: 'MS-B09611' },
      cpu: { name: 'Intel(R) Core(TM) i3-5005U CPU @ 2.00GHz', cores: 2, threads: 4 },
      memory: { total_gb: 4, type: 'ddr3', speed_mts: 1333, slots_total: 4, slots_used: 1 },
      storage: [{ media: 'ssd', bus: 'sata', capacity_gb: 128, health: 'healthy' }],
      gpus: [],
    }
    const result = buildFor(miniPc, gaming)
    const ssd = option(result, 'ssd-swap')
    expect(ssd.status).not.toBe('viable')
    expect(result.categories.flatMap((c) => c.options).filter((o) => ['ssd', 'ram', 'battery'].includes(o.kind) && o.status === 'viable')).toEqual([])
  })
})

describe('scores and confidence (AC-005)', () => {
  it('scores an option with the rubrics and its difficulty', () => {
    const ram = option(build(), 'ram-add')
    const upgradeGate = runGates({ scan, use: 'office', modelEvidence: assessment.model_evidence, facts: facts.facts }).find((g) => g.path === 'upgrade')!
    expect(ram.scores).toEqual({
      ...rubricScores({ impact: ram.impact!, use: 'office', baselineCost: assessment.baseline.cost_eur, endsOwnersUse: false, shortfall: upgradeGate.shortfall }),
      feasibility: DIFFICULTY_FEASIBILITY.diy_moderate,
    })
  })

  it('takes the conditional penalty off the difficulty value', () => {
    expect(option(build(), 'clean-install').scores!.feasibility).toBe(DIFFICULTY_FEASIBILITY.diy_easy - 20)
  })

  it('counts passing on as ending the owner’s use, like the pass-on path', () => {
    const donate = option(build(), 'donate')
    expect(donate.scores!.economic).toBe(
      rubricScores({ impact: donate.impact!, use: 'office', baselineCost: assessment.baseline.cost_eur, endsOwnersUse: true, shortfall: false }).economic,
    )
  })

  it('gives an AI-estimated option at most medium confidence, naming the estimate', () => {
    const estimate = option(build(), 'clean-install')
    expect(estimate.confidence).toEqual({ level: 'medium', reasons: [AI_ESTIMATE_CONFIDENCE] })
    const unknown = buildResult(scan, { ...input, assessment: { ...assessment, model_evidence: 'none' } }, answer(), NOW, impactTable)
    expect(option(unknown, 'clean-install').confidence.level).toBe('low')
  })
})

describe('the category call (AC-012)', () => {
  it('sends the scan, intended use, assessment, facts and passages, with the four safety rules', () => {
    const request = buildCategoryRequest(scan, input)
    expect(request.task).toBe('categories')
    const user = JSON.parse(request.user)
    expect(user.scan).toMatchObject({ model: scan.identity.model, memory: scan.memory, battery: scan.battery, storage: scan.storage })
    expect(user.intended_use).toBe('office')
    expect(user.assessment.map((p: any) => p.path)).toEqual(assessment.paths.map((p) => p.path))
    expect(user.assessment[0]).toEqual(expect.objectContaining({ status: expect.any(String), scores: expect.anything(), impact: expect.anything() }))
    expect(user.facts).toEqual(facts.facts)
    expect(user.passages.map((p: any) => p.passage_id)).toEqual(expect.arrayContaining(['ex14-hmm#storage-1', 'ex14-hmm#battery-1']))
    expect(SAFETY_RULES).toHaveLength(4)
    for (const rule of SAFETY_RULES) expect(request.system).toContain(rule)
    expect(request.system).toBe(CATEGORY_SYSTEM)
  })

  it('removes claims citing unknown passages and claims with figures', () => {
    const output = answer()
    const ssd = output.categories[0].options[0]
    ssd.claims = [
      ssd.claims[0],
      { text: 'Supported by the manual.', passage_ids: ['ex14-hmm#storage-1', 'made-up#1'] },
    ]
    output.categories[1].options[0].claims = [{ text: 'A module costs €30.', passage_ids: ['ex14-hmm#memory-1'] }]
    const result = build(output)
    valid(result)
    expect(option(result, 'ssd-swap').claims).toEqual([sampleOutput.categories[0].options[0].claims[0]])
    expect(option(result, 'ram-add').claims).toEqual([])
    expect(result.passages.map((p) => p.passage_id)).not.toContain('made-up#1')
  })

  it('rejects text with a euro or CO₂e figure', () => {
    const output = answer()
    Object.assign(output.categories[0].options[0], { reason: 'Saves 120 kg CO₂e.', why: 'Costs about 40 euros.', title: 'A €40 SSD' })
    output.categories[0].summary = 'Spend €40 on an SSD.'
    output.categories[0].label = '€40 upgrade'
    const result = build(output)
    valid(result)
    const text = JSON.stringify(result.categories[0])
    expect(text).not.toMatch(/€\s*40|40 euros|120 kg/)
    expect(result.categories[0]!.label).not.toContain('€')
  })

  it('drops Windows 11 options on a Mac and falls back when fewer than three categories are left', async () => {
    const mac = { ...scan, os: { ...scan.os, family: 'macos' as const } }
    const output = answer()
    output.categories[1].options[0].title = 'Upgrade to Windows 11'
    output.categories[0].label = 'Windows 11 and storage'
    const result = build(output, mac)
    expect(result.categories.map((c) => c.category_id)).not.toContain('memory')
    expect(result.categories[0]!.label).toBe('Storage')
    expect(JSON.stringify(result)).not.toMatch(/windows\s*11/i)

    for (const c of output.categories) for (const o of c.options) o.reason = 'Windows 11 runs on it.'
    const db = new DatabaseSync(':memory:')
    const llm: LlmClient = { completeJson: async () => ({ value: output, model: 'fake', attempts: 1, latency_ms: 0, usage: { prompt_tokens: 0, completion_tokens: 0 } }) as any }
    expect((await createCategoryService(db, llm, { impactTable })(mac, input)).source).toBe('template')
  })
})

const databases: DatabaseSync[] = []
afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

function setup(db = new DatabaseSync(':memory:')) {
  databases.push(db)
  const completeJson = vi.fn(async (): Promise<unknown> => answer())
  const llm: LlmClient = {
    async completeJson(request) {
      expect(request.task).toBe('categories')
      const value = await completeJson()
      return { value: value as any, model: 'fake', attempts: 1, latency_ms: 0, usage: { prompt_tokens: 0, completion_tokens: 0 } }
    },
  }
  const warnings: string[] = []
  return { db, completeJson, llm, warnings, categorize: createCategoryService(db, llm, { impactTable, warn: (m) => warnings.push(m) }) }
}

describe('fallback (AC-013)', () => {
  const expectFallback = (result: CategoryResult) => {
    valid(result)
    expect(result.source).toBe('template')
    expect(result.notice).toBe(FALLBACK_NOTICE)
    expect(result.notice).toMatch(/AI explanation unavailable/)
    expect(result.categories).toHaveLength(5)
    for (const path of assessment.paths) {
      const category = result.categories.find((c) => c.category_id === path.path)!
      expect(category.options).toHaveLength(1)
      expect(category.options[0]).toMatchObject({
        path: path.path,
        status: path.status,
        scores: path.scores,
        impact: path.impact,
        impact_source: path.impact ? 'calculator' : null,
        reason: path.reasons[0]!.text,
      })
    }
  }

  it('shows the five paths when no LLM is configured', async () => {
    const db = new DatabaseSync(':memory:')
    databases.push(db)
    expectFallback(await createCategoryService(db, null, { impactTable })(scan, input))
  })

  it.each([
    ['a provider error', new LlmError('unavailable', 'HTTP 503')],
    ['a timeout', new LlmError('timeout', 'Category deadline exceeded')],
    ['an invalid answer after repair', new LlmError('invalid_output', 'bad')],
    ['the daily budget', new LlmError('rate_limited', 'limit')],
  ])('shows the five paths after %s, and retries on the next open', async (_name, error) => {
    const { categorize, completeJson, warnings } = setup()
    completeJson.mockRejectedValueOnce(error)
    expectFallback(await categorize(scan, input))
    expect(warnings).toEqual([expect.stringContaining(error.message)])
    expect((await categorize(scan, input)).source).toBe('llm')
    expect(completeJson).toHaveBeenCalledTimes(2)
  })
})

describe('cache (AC-014)', () => {
  it('makes one call per device and use, shares concurrent opens, and survives a restart', async () => {
    const { db, llm, completeJson, categorize } = setup()
    const [first, second] = await Promise.all([categorize(scan, input), categorize(scan, input)])
    expect(second).toEqual(first)
    expect(await createCategoryService(db, llm, { impactTable })(scan, input)).toEqual(first)
    expect(await createCategoryService(db, null, { impactTable })(scan, input)).toEqual(first)
    expect(completeJson).toHaveBeenCalledTimes(1)
    await categorize(scan, { ...input, assessment: { ...assessment, intended_use: 'gaming' } })
    await categorize(scan, { ...input, assessment: { ...assessment, device_id: 'AAAAAAAAAAAAAAAAAAAAAA' } })
    expect(completeJson).toHaveBeenCalledTimes(3)
  })

  it('does not reuse an answer cached under another prompt', async () => {
    const { db, completeJson, categorize } = setup()
    db.exec(`CREATE TABLE IF NOT EXISTS category_cache (device_id TEXT NOT NULL, intended_use TEXT NOT NULL, prompt_hash TEXT NOT NULL,
      output TEXT NOT NULL, generated_at TEXT NOT NULL, PRIMARY KEY (device_id, intended_use))`)
    db.prepare('INSERT INTO category_cache VALUES (?, ?, ?, ?, ?)').run(assessment.device_id, 'office', 'older-prompt', JSON.stringify(answer()), NOW)
    await categorize(scan, input)
    expect(completeJson).toHaveBeenCalledTimes(1)
  })

  it('never caches an answer the server checks make unusable', async () => {
    const { completeJson, categorize } = setup()
    const mac = { ...scan, os: { ...scan.os, family: 'linux' as const } }
    const bad = answer()
    for (const c of bad.categories) for (const o of c.options) o.title = 'Windows 11 upgrade'
    completeJson.mockResolvedValueOnce(bad)
    expect((await categorize(mac, input)).source).toBe('template')
    expect((await categorize(mac, input)).source).toBe('llm')
    expect(completeJson).toHaveBeenCalledTimes(2)
  })
})
