import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  Assessment,
  checkAssessment,
  createValidator,
  INTENDED_USES,
  PATHS,
  rankPaths,
  type DeviceScan,
  type Fact,
  type FactSet,
  type PathAssessment,
} from '@leaaf/shared'
import { loadImpactTable } from '../src/impact/table.ts'
import {
  assess,
  avoided,
  baselineFor,
  indexImpactTable,
  loadWeights,
  parseWeights,
  runGates,
  type AssessInput,
} from '../src/assessment/index.ts'

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`../../shared/fixtures/${name}`, import.meta.url), 'utf8')) as T

const laptop = fixture<DeviceScan>('device-scan.laptop-complete.json')
const desktop = fixture<DeviceScan>('device-scan.desktop-partial.json')
const laptopFacts = fixture<FactSet>('facts.example-laptop-14.json').facts
const impactTable = loadImpactTable()
const impactIndex = indexImpactTable(impactTable)
const weights = loadWeights()
const isAssessment = createValidator(Assessment)

type Patch = { [K in keyof DeviceScan]?: Partial<DeviceScan[K]> }
const scanWith = (base: DeviceScan, patch: Patch): DeviceScan => {
  const scan = structuredClone(base) as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) scan[k] = v !== null && typeof v === 'object' && !Array.isArray(v) ? { ...(scan[k] as object), ...v } : v
  return scan as DeviceScan
}
const withFacts = (facts: readonly Fact[], ...overrides: Fact[]): Fact[] => [
  ...facts.filter((f) => !overrides.some((o) => o.key === f.key)),
  ...overrides,
]
const without = (facts: readonly Fact[], ...keys: Fact['key'][]) => facts.filter((f) => !keys.includes(f.key))
const cite = ['ex14-hmm#memory-1']

const run = (overrides: Partial<AssessInput> = {}) =>
  assess({
    deviceId: 'q3Xk9vT2mB7pLw0cZr1sEa',
    scan: laptop,
    use: 'office',
    modelEvidence: 'model_specific',
    facts: laptopFacts,
    impactTable,
    weights,
    now: new Date('2026-11-20T12:00:00Z'),
    ...overrides,
  })
const pathOf = (a: { paths: PathAssessment[] }, path: PathAssessment['path']) => a.paths.find((p) => p.path === path)!

const scenarios: [string, Partial<AssessInput>][] = [
  ['complete laptop, model evidence', {}],
  ['complete laptop, no model evidence', { modelEvidence: 'none', facts: [] }],
  ['partial desktop, no model evidence', { scan: desktop, modelEvidence: 'none', facts: [] }],
  ['soldered RAM, development', { use: 'development', facts: withFacts(laptopFacts, { key: 'ram_soldered', value: 'all', source_passage_ids: cite }) }],
  ['unsupported CPU', { facts: withFacts(laptopFacts, { key: 'windows11_supported_cpu', value: false, source_passage_ids: ['os-cpu-list#intel-8th-gen'] }) }],
]

describe('assess', () => {
  it.each(scenarios.flatMap(([name, o]) => INTENDED_USES.map((use) => [`${name}, ${use}`, { ...o, use: o.use ?? use }] as const)))(
    'produces a valid assessment with all five paths, one status and a reason each (AC-003): %s',
    (_name, overrides) => {
      const a = run(overrides)
      expect(isAssessment(a).ok ? [] : isAssessment(a)).toEqual([])
      expect(checkAssessment(a)).toEqual([])
      expect(a.paths.map((p) => p.path)).toEqual([...PATHS])
      for (const p of a.paths) expect(p.reasons.length).toBeGreaterThan(0)
      // Every impact figure traces back to impact table entries (AC-008).
      for (const p of a.paths) for (const ref of p.impact?.assumptions.flatMap((x) => x.impact_refs) ?? []) expect(() => impactIndex.entry(ref)).not.toThrow()
    },
  )

  it('is deterministic for the same inputs', () => {
    expect(run({ use: 'study' })).toEqual(run({ use: 'study' }))
  })

  it('ranks an upgradeable office laptop with upgrade and repair ahead of recycling', () => {
    const a = run()
    expect(pathOf(a, 'upgrade').status).toBe('viable')
    const order = rankPaths(a.paths, a.weights.environment_first).map((r) => r.path.path)
    expect(order.indexOf('upgrade')).toBeLessThan(order.indexOf('recycle'))
    expect(order.indexOf('repair')).toBeLessThan(order.indexOf('recycle'))
  })
})

describe('gates', () => {
  const gate = (overrides: Partial<AssessInput> = {}) => {
    const { scan = laptop, use = 'office', modelEvidence = 'model_specific', facts = laptopFacts } = overrides
    return Object.fromEntries(runGates({ scan, use, modelEvidence, facts }).map((g) => [g.path, g]))
  }

  it('makes compatibility-dependent paths conditional with "cannot verify" without model evidence (AC-004)', () => {
    // Hardware facts are ignored without model evidence, even if they were extracted.
    const g = gate({ modelEvidence: 'none' })
    for (const path of ['upgrade', 'repair'] as const) {
      expect(g[path]!.status).toBe('conditional')
      expect(g[path]!.reasons.some((r) => r.code.startsWith('cannot_verify'))).toBe(true)
    }
    for (const p of Object.values(g)) if (p.path !== 'recycle' && p.path !== 'pass_on') expect(p.status).not.toBe('viable')
  })

  it('marks an upgrade that relies only on RAM not suitable when the RAM is soldered, citing the fact (AC-005)', () => {
    const ssdOnly = scanWith(laptop, { storage: [{ media: 'ssd', bus: 'nvme', capacity_gb: 256, health: 'healthy' }] } as Patch)
    const soldered: Fact = { key: 'ram_soldered', value: 'all', source_passage_ids: cite }
    const g = gate({ scan: ssdOnly, use: 'development', facts: withFacts(laptopFacts, soldered) })
    expect(g.upgrade!.status).toBe('not_suitable')
    const r = g.upgrade!.reasons.find((x) => x.code === 'ram_soldered')!
    expect(r.fact_keys).toEqual(['ram_soldered'])
    expect(r.passage_ids).toEqual(cite)
  })

  it('keeps the SSD part of an upgrade but marks it conditional when soldered RAM falls short of the use', () => {
    const g = gate({ use: 'development', facts: withFacts(laptopFacts, { key: 'ram_soldered', value: 'all', source_passage_ids: cite }) })
    expect(g.upgrade!.status).toBe('conditional')
    expect(g.upgrade!.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['ssd_slot_available', 'ram_soldered', 'ram_below_use']))
  })

  it('says no upgrade is needed when the device already has an SSD and enough RAM', () => {
    const g = gate({ scan: scanWith(laptop, { storage: [{ media: 'ssd', bus: 'nvme', capacity_gb: 512, health: 'healthy' }] } as Patch) })
    expect(g.upgrade!.status).toBe('not_suitable')
    expect(g.upgrade!.reasons[0]!.code).toBe('no_upgrade_needed')
  })

  it.each([
    ['not user-replaceable', withFacts(laptopFacts, { key: 'battery_user_replaceable', value: false, source_passage_ids: ['ex14-hmm#battery-1'] })],
    ['unknown replaceability', without(laptopFacts, 'battery_user_replaceable')],
  ])('sends a worn battery that is %s to a professional, at most conditional (AC-006)', (_name, facts) => {
    const g = gate({ facts })
    expect(g.repair!.status).toBe('conditional')
    expect(g.repair!.plan).toEqual({ path: 'repair', battery: 'professional' })
    const text = g.repair!.reasons.map((r) => r.text).join(' ')
    expect(text).toMatch(/professional repair shop/)
    expect(text).toMatch(/do not open/)
  })

  it('lets the owner replace a user-replaceable worn battery', () => {
    expect(gate().repair!.status).toBe('viable')
    expect(gate().repair!.plan).toEqual({ path: 'repair', battery: 'diy' })
  })

  it.each([
    ['a desktop', desktop, 'no_battery'],
    ['a healthy battery', scanWith(laptop, { battery: { health_percent: 95 } }), 'battery_healthy'],
  ])('marks repair not suitable for %s', (_name, scan, code) => {
    const g = gate({ scan })
    expect(g.repair!.status).toBe('not_suitable')
    expect(g.repair!.reasons[0]!.code).toBe(code)
  })

  it('marks pass it on not suitable for an unsupported CPU, and conditional when support is unknown', () => {
    const fact: Fact = { key: 'windows11_supported_cpu', value: false, source_passage_ids: ['os-cpu-list#intel-8th-gen'] }
    expect(gate({ facts: withFacts(laptopFacts, fact) }).pass_on!.status).toBe('not_suitable')
    expect(gate({ facts: without(laptopFacts, 'windows11_supported_cpu') }).pass_on!.status).toBe('conditional')
  })

  it('never puts recycling ahead of a path that keeps the device in use', () => {
    expect(gate().recycle!.status).toBe('conditional')
    expect(gate({ scan: desktop, modelEvidence: 'none', facts: [] }).recycle!.status).toBe('conditional')
    const dead = withFacts(laptopFacts, { key: 'windows11_supported_cpu', value: false, source_passage_ids: ['os-cpu-list#intel-8th-gen'] }, { key: 'ram_soldered', value: 'all', source_passage_ids: cite })
    const scan = scanWith(laptop, { storage: [{ media: 'ssd', bus: 'nvme', capacity_gb: 256, health: 'healthy' }], battery: { health_percent: 95 } } as Patch)
    expect(gate({ scan, facts: dead }).recycle!.status).toBe('viable')
  })

  it('cites the RAM fact for salvage only when the RAM modules are reusable', () => {
    const ssd = scanWith(laptop, { storage: [{ media: 'ssd', bus: 'nvme', capacity_gb: 256, health: 'healthy' }] } as Patch)
    const soldered = withFacts(laptopFacts, { key: 'ram_soldered', value: 'all', source_passage_ids: cite })
    const r = gate({ scan: ssd, facts: soldered }).salvage!.reasons.find((x) => x.code === 'parts_reusable')!
    expect(r.text).toBe('The SSD can serve another computer.')
    expect(r.fact_keys).toEqual([])
  })

  it('makes salvage viable only when the device cannot be used whole', () => {
    expect(gate().salvage!.status).toBe('conditional')
    const unsupported = withFacts(laptopFacts, { key: 'windows11_supported_cpu', value: false, source_passage_ids: ['os-cpu-list#intel-8th-gen'] })
    expect(gate({ facts: unsupported }).salvage!.status).toBe('viable')
  })
})

describe('calculator', () => {
  it('outputs ranges with the baseline for every viable or conditional path (AC-008)', () => {
    const a = run()
    expect(a.baseline.description).toBe('The owner buys a comparable new laptop now')
    expect(a.baseline.impact_refs).toEqual(['new_laptop.production_co2e', 'new_laptop.price'])
    for (const p of a.paths.filter((x) => x.status !== 'not_suitable')) {
      expect(p.impact!.co2e_kg.baseline).toEqual(a.baseline.co2e_kg)
      expect(p.impact!.assumptions.length).toBeGreaterThan(0)
    }
    // The upgrade adds an NVMe SSD (the laptop has an HDD and an M.2 slot): its figures are exactly the table entries.
    const up = pathOf(a, 'upgrade').impact!
    const ssd = impactIndex.entry('part.ssd_500gb.price')
    const ssdCo2 = impactIndex.entry('part.ssd_500gb.production_co2e')
    expect(up.cost_eur).toEqual({ low: ssd.low, high: ssd.high })
    expect(up.co2e_kg.path).toEqual({ low: ssdCo2.low, high: ssdCo2.high })
    expect(up.useful_life_years).toEqual({ low: 2, high: 4 })
  })

  it('compares desktops against a new desktop', () => {
    expect(baselineFor(desktop, impactIndex).impact_refs).toEqual(['new_desktop.production_co2e', 'new_desktop.price'])
  })

  it('credits pass it on only conditionally and never sums paths (AC-009)', () => {
    const a = run()
    const passOn = pathOf(a, 'pass_on').impact!
    expect(passOn.displacement).toBe('conditional')
    expect(passOn.co2e_kg.avoided_vs_baseline.low).toBeLessThanOrEqual(0)
    expect(passOn.assumptions.some((x) => /only if the recipient would otherwise buy/.test(x.text))).toBe(true)
    // No field carries a total across paths: the assessment only has per-path impacts and one baseline.
    expect(Object.keys(a).sort()).toEqual(['baseline', 'created_at', 'device_id', 'intended_use', 'model_evidence', 'paths', 'weights'])
  })

  it('treats an upgrade or repair before passing on as conditional displacement', () => {
    const a = run({ use: 'pass_on' })
    expect(pathOf(a, 'upgrade').impact!.displacement).toBe('conditional')
    expect(pathOf(a, 'repair').impact!.displacement).toBe('conditional')
  })

  it('computes avoided CO2e by interval arithmetic for each displacement', () => {
    const base = { low: 100, high: 200 }
    const path = { low: 10, high: 30 }
    expect(avoided(base, path, 'assumed')).toEqual({ low: 70, high: 190 })
    expect(avoided(base, path, 'conditional')).toEqual({ low: -30, high: 190 })
    expect(avoided(base, path, 'none')).toEqual({ low: -30, high: -10 })
  })

  it('adds labour to a professional battery repair', () => {
    const facts = withFacts(laptopFacts, { key: 'battery_user_replaceable', value: false, source_passage_ids: ['ex14-hmm#battery-1'] })
    const pro = pathOf(run({ facts }), 'repair').impact!
    const diy = pathOf(run(), 'repair').impact!
    expect(pro.cost_eur.low).toBeGreaterThan(diy.cost_eur.low)
    expect(pro.assumptions[0]!.impact_refs).toContain('service.battery_replacement.price')
  })
})

describe('scoring', () => {
  it('gives each viable or conditional path four scores between 0 and 100 (AC-010)', () => {
    for (const use of INTENDED_USES)
      for (const p of run({ use }).paths) {
        if (p.status === 'not_suitable') {
          expect(p.scores).toBeNull()
          continue
        }
        for (const v of Object.values(p.scores!)) expect(v >= 0 && v <= 100).toBe(true)
      }
  })

  it('scores the same soldered-RAM laptop differently for office and programming use (AC-013)', () => {
    const facts = withFacts(laptopFacts, { key: 'ram_soldered', value: 'all', source_passage_ids: cite })
    const office = pathOf(run({ use: 'office', facts }), 'upgrade').scores!
    const dev = pathOf(run({ use: 'development', facts }), 'upgrade').scores!
    expect(dev.useful_life).toBeLessThan(office.useful_life)
    expect(dev.feasibility).toBeLessThan(office.feasibility)
  })

  it('counts the cost of a replacement when the owner gives away a computer they still need', () => {
    expect(pathOf(run({ use: 'office' }), 'pass_on').scores!.economic).toBe(0)
    expect(pathOf(run({ use: 'pass_on' }), 'pass_on').scores!.economic).toBe(100)
  })

  it('changes totals with the mode but only reorders when the data supports it (journey 4)', () => {
    const a = run({ use: 'pass_on' })
    const totals = (w: typeof a.weights.money_first) => rankPaths(a.paths, w).map((r) => [r.path.path, r.total])
    expect(totals(a.weights.money_first)).not.toEqual(totals(a.weights.environment_first))
    // Passing it on costs nothing and keeps the whole device in use, so it leads in both modes here.
    expect(rankPaths(a.paths, a.weights.money_first)[0]!.path.path).toBe('pass_on')
  })

  it('halves the useful-life score of a repair that leaves RAM below what the use needs', () => {
    expect(pathOf(run({ use: 'development' }), 'repair').scores!.useful_life).toBeLessThan(pathOf(run({ use: 'office' }), 'repair').scores!.useful_life)
  })
})

describe('confidence (AC-014)', () => {
  it('is lower with unread battery wear and no model evidence, listing both reasons', () => {
    const complete = pathOf(run(), 'repair').confidence
    const weak = pathOf(run({ scan: scanWith(laptop, { battery: { health_percent: null, full_charge_capacity_mwh: null }, scan_status: 'partial' } as Patch), modelEvidence: 'none', facts: [] }), 'repair').confidence
    const rank = { high: 0, medium: 1, low: 2 } as const
    expect(rank[weak.level]).toBeGreaterThan(rank[complete.level])
    expect(weak.level).toBe('low')
    expect(weak.reasons.join(' ')).toMatch(/No model-specific documentation/)
    expect(weak.reasons.join(' ')).toMatch(/battery wear/)
  })

  it('flags wide impact ranges and unsourced estimates', () => {
    const facts = withFacts(laptopFacts, { key: 'battery_user_replaceable', value: false, source_passage_ids: ['ex14-hmm#battery-1'] })
    const reasons = pathOf(run({ facts }), 'repair').confidence.reasons.join(' ')
    expect(reasons).toMatch(/Wide range in: .*replacement laptop battery/)
    expect(reasons).toMatch(/without a source yet/)
  })
})

describe('weights (AC-010)', () => {
  it('loads the illustrative defaults, each summing to 100', () => {
    expect(weights).toEqual({
      environment_first: { environment: 45, useful_life: 25, economic: 10, feasibility: 20 },
      money_first: { environment: 15, useful_life: 20, economic: 45, feasibility: 20 },
    })
  })

  it.each([
    ['a mode that does not sum to 100', 'environment_first: {environment: 50, useful_life: 25, economic: 10, feasibility: 20}\nmoney_first: {environment: 15, useful_life: 20, economic: 45, feasibility: 20}', 'sum to 105'],
    ['a missing mode', 'environment_first: {environment: 45, useful_life: 25, economic: 10, feasibility: 20}', 'money_first'],
    ['an unknown criterion', 'environment_first: {environment: 45, useful_life: 25, economic: 10, feasibility: 20, fun: 0}\nmoney_first: {environment: 15, useful_life: 20, economic: 45, feasibility: 20}', 'invalid weights'],
  ])('rejects %s', (_name, yaml, message) => {
    expect(() => parseWeights(yaml)).toThrow(message)
  })
})
