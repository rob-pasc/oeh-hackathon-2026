import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  Assessment,
  DeviceScan,
  Fact,
  FactSet,
  Passage,
  Report,
  RetrievalResult,
  SCANNER_SESSION_MARKER,
  ScannerEvent,
  ScanSessionEvent,
  checkAssessment,
  checkDeviceScan,
  checkFactSet,
  checkPassage,
  checkReport,
  createValidator,
  type Assessment as AssessmentT,
  type DeviceScan as DeviceScanT,
  type FactSet as FactSetT,
  type Passage as PassageT,
  type Report as ReportT,
} from '../src/index.ts'

const fixture = <T = unknown>(name: string): T =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')) as T
const clone = <T>(v: T): T => structuredClone(v)

const validateScan = createValidator(DeviceScan)
const validateAssessment = createValidator(Assessment)
const validateReport = createValidator(Report)
const validateFact = createValidator(Fact)

describe('fixtures are valid examples', () => {
  const cases: [string, ReturnType<typeof createValidator>, ((v: never) => string[]) | null][] = [
    ['device-scan.laptop-complete.json', validateScan, checkDeviceScan as never],
    ['device-scan.desktop-partial.json', validateScan, checkDeviceScan as never],
    ['retrieval.example-laptop-14.json', createValidator(RetrievalResult), null],
    ['facts.example-laptop-14.json', createValidator(FactSet), checkFactSet as never],
    ['assessment.example-laptop-14.office.json', validateAssessment, checkAssessment as never],
    ['assessment.example-desktop-unknown.development.json', validateAssessment, checkAssessment as never],
    ['report.example-laptop-14.office.json', validateReport, checkReport as never],
  ]
  it.each(cases)('%s', (name, validate, check) => {
    const value = fixture(name)
    expect(validate(value)).toMatchObject({ ok: true })
    if (check) expect(check(value as never)).toEqual([])
  })

  it('passages.json', () => {
    const validate = createValidator(Passage)
    for (const p of fixture<PassageT[]>('passages.json')) {
      expect(validate(p)).toMatchObject({ ok: true })
      expect(checkPassage(p)).toEqual([])
    }
  })
})

describe('DeviceScan', () => {
  const scan = () => clone(fixture<DeviceScanT>('device-scan.laptop-complete.json'))

  it.each([
    ['root serial number', (s: Record<string, unknown>) => (s.serial_number = 'PF1ABC23')],
    ['identity serial number', (s: any) => (s.identity.serial_number = 'PF1ABC23')],
    ['system UUID', (s: any) => (s.identity.uuid = '4C4C4544-0042-3510-8052-B2C04F4B4A32')],
    ['host name', (s: any) => (s.os.host_name = 'ROBINS-LAPTOP')],
    ['user name', (s: any) => (s.os.user_name = 'robin')],
    ['MAC address', (s: any) => (s.mac_address = '00:1A:2B:3C:4D:5E')],
  ])('rejects identifying field: %s (feature 001 FR-005)', (_label, mutate) => {
    const s = scan() as unknown as Record<string, unknown>
    mutate(s as never)
    expect(validateScan(s).ok).toBe(false)
  })

  it('names every invalid field (feature 001 FR-007)', () => {
    const s = scan() as any
    delete s.identity.model
    s.memory.total_gb = '8'
    const result = validateScan(s)
    expect(result.ok).toBe(false)
    const paths = result.ok ? [] : result.errors.map((e) => e.path)
    expect(paths).toContain('/identity')
    expect(paths).toContain('/memory/total_gb')
  })

  it('requires unreadable fields to be present as null, not omitted', () => {
    const s = scan() as any
    delete s.battery.cycle_count
    expect(validateScan(s).ok).toBe(false)
  })

  it('flags scan_status that does not match null fields (feature 001 FR-004)', () => {
    const s = scan()
    s.battery.cycle_count = null
    expect(checkDeviceScan(s)).toEqual(['scan_status must be "partial"'])
  })

  it('flags battery values when no battery is present', () => {
    const s = scan()
    s.battery.present = false
    expect(checkDeviceScan(s)).toContain('battery values must be null when battery.present is false')
  })

  it('rejects an unknown schema version', () => {
    const s = scan() as any
    s.schema_version = 2
    expect(validateScan(s).ok).toBe(false)
  })
})

describe('Fact and FactSet', () => {
  it('rejects a fact without a supporting passage (feature 003 FR-002)', () => {
    expect(validateFact({ key: 'ram_soldered', value: 'all', source_passage_ids: [] }).ok).toBe(false)
  })

  it('rejects a value of the wrong type for its key', () => {
    expect(validateFact({ key: 'ram_slots_total', value: 'two', source_passage_ids: ['p1'] }).ok).toBe(false)
  })

  it('rejects unknown fact keys', () => {
    expect(validateFact({ key: 'gpu_upgradeable', value: true, source_passage_ids: ['p1'] }).ok).toBe(false)
  })

  it('flags duplicate keys', () => {
    const set = clone(fixture<FactSetT>('facts.example-laptop-14.json'))
    set.facts.push(set.facts[0]!)
    expect(checkFactSet(set)).toEqual(['duplicate fact keys: ram_soldered'])
  })
})

describe('Passage', () => {
  it('requires a section or a page (feature 002 FR-007)', () => {
    const p = clone(fixture<PassageT[]>('passages.json')[0]!)
    p.section = null
    p.page = null
    expect(checkPassage(p)).toHaveLength(1)
  })
})

describe('Assessment invariants', () => {
  const assessment = () => clone(fixture<AssessmentT>('assessment.example-laptop-14.office.json'))
  const byPath = (a: AssessmentT, path: string) => a.paths.find((p) => p.path === path)!

  it('rejects weights that do not sum to 100 (feature 003 FR-011)', () => {
    const a = assessment()
    a.weights.money_first.economic = 44
    expect(checkAssessment(a)).toEqual(['weights.money_first: weights sum to 99, expected 100'])
  })

  it('rejects a not_suitable path with a score (feature 003 FR-012)', () => {
    const a = assessment()
    byPath(a, 'upgrade').status = 'not_suitable'
    const errors = checkAssessment(a)
    expect(errors).toContain('paths[upgrade]: not_suitable paths must not have scores')
    expect(errors).toContain('paths[upgrade]: not_suitable paths must not have impact')
  })

  it('requires each of the five paths exactly once', () => {
    const a = assessment()
    a.paths[4] = clone(a.paths[0]!)
    expect(checkAssessment(a).some((e) => e.includes('missing: recycle'))).toBe(true)
  })

  it('rejects inverted ranges', () => {
    const a = assessment()
    byPath(a, 'repair').impact!.cost_eur = { low: 90, high: 50 }
    expect(checkAssessment(a)).toEqual(['paths[repair].impact.cost_eur: low (90) exceeds high (50)'])
  })

  it('never credits pass_on with assumed displacement (feature 003 FR-009)', () => {
    const a = assessment()
    byPath(a, 'pass_on').impact!.displacement = 'assumed'
    expect(checkAssessment(a)).toContain(
      'paths[pass_on]: pass_on displacement must be conditional or none (feature 003 FR-009)',
    )
  })

  it('rejects guaranteed savings under conditional displacement', () => {
    const a = assessment()
    byPath(a, 'pass_on').impact!.co2e_kg.avoided_vs_baseline = { low: 100, high: 350 }
    expect(checkAssessment(a)).toHaveLength(1)
  })

  it('rejects avoided CO2e without displacement', () => {
    const a = assessment()
    byPath(a, 'recycle').impact!.co2e_kg.avoided_vs_baseline = { low: 0, high: 300 }
    expect(checkAssessment(a)).toHaveLength(1)
  })

  it('requires the per-path baseline to equal the shared baseline', () => {
    const a = assessment()
    byPath(a, 'upgrade').impact!.co2e_kg.baseline = { low: 1, high: 2 }
    expect(checkAssessment(a)).toEqual(['paths[upgrade].impact.co2e_kg.baseline must equal baseline.co2e_kg'])
  })

  it('rejects a path without reasons (feature 003 FR-003)', () => {
    const a = assessment()
    byPath(a, 'salvage').reasons = []
    expect(validateAssessment(a).ok).toBe(false)
  })
})

describe('Report invariants', () => {
  const report = () => clone(fixture<ReportT>('report.example-laptop-14.office.json'))

  it('rejects claims without citations (feature 004 FR-005)', () => {
    const r = report()
    r.paths[0]!.claims[0]!.passage_ids = []
    expect(validateReport(r).ok).toBe(false)
  })

  it('flags claims citing passages not included in the report', () => {
    const r = report()
    r.paths[0]!.claims[0]!.passage_ids = ['made-up#1']
    expect(checkReport(r)).toEqual(['paths[upgrade]: claim cites unknown passage made-up#1'])
  })
})

describe('scan sessions', () => {
  const laptop = fixture<DeviceScanT>('device-scan.laptop-complete.json')
  const id = '0123456789ABCDEFGHJKMNPQRS'

  it('accepts a scan with or without a session ID, and keeps it out of scan_status', () => {
    expect(validateScan({ ...laptop, session_id: id }).ok).toBe(true)
    expect(validateScan(laptop).ok).toBe(true)
    expect(checkDeviceScan({ ...laptop, session_id: id })).toEqual([])
  })

  it('rejects session IDs outside Crockford base32 or of the wrong length', () => {
    for (const bad of ['0123456789ABCDEFGHJKMNPQRI', '0123456789abcdefghjkmnpqrs', '0123456789ABCDEFGHJKMNPQR', null]) {
      expect(validateScan({ ...laptop, session_id: bad }).ok).toBe(false)
    }
  })

  it('marks the executable with an 11-byte marker, 37 bytes with the ID', () => {
    expect(SCANNER_SESSION_MARKER).toBe('LEAAFSCAN1:')
    expect(Buffer.byteLength(SCANNER_SESSION_MARKER + id)).toBe(37)
  })

  it('lets the scanner post steps and errors but not completion', () => {
    const scanner = createValidator(ScannerEvent)
    const stream = createValidator(ScanSessionEvent)
    expect(scanner({ type: 'step', step: 'storage', state: 'running' }).ok).toBe(true)
    expect(scanner({ type: 'error', code: 'upload_failed', message: 'offline' }).ok).toBe(true)
    const complete = { type: 'complete', device_id: 'q3Xk9vT2mB7pLw0cZr1sEa' }
    expect(scanner(complete).ok).toBe(false)
    expect(stream(complete).ok).toBe(true)
  })
})
