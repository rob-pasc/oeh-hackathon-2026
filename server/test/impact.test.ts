import { PATHS } from '@leaaf/shared'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkImpactTable, coverageProblems, loadImpactTable, parseImpactTable, type ImpactTable } from '../src/impact/table.ts'

const source = { title: 'T', publisher: 'P', url: 'https://example.org/s', accessed_on: '2026-11-20' }
const entry = { id: 'part.x.price', description: 'X', low: 1, high: 2, unit: 'eur', status: 'sourced', sources: ['s'], derivation: 'd' }
const table = (entries: object[], sources: object = { s: source }) => ({ schema_version: 1, sources, entries })

describe('data/impact.yaml', () => {
  const real = loadImpactTable()

  it('is valid: every entry has low <= high, a unit, a status, and known sources with access dates (AC-007)', () => {
    expect(checkImpactTable(real)).toEqual([])
    for (const e of real.entries) if (e.status !== 'placeholder') expect(e.sources.length).toBeGreaterThan(0)
  })

  it('requires a life entry for every path with the general and gaming uses (AC-019)', () => {
    const without = { ...real, entries: real.entries.filter((e) => !/^life_extra\.\w+\.(general|gaming)$/.test(e.id)) }
    const missing = coverageProblems(without)
    for (const path of PATHS) for (const use of ['general', 'gaming']) expect(missing).toContain(`life_extra.${path}.${use}: missing`)
  })

  it('flags exactly the remaining placeholders in the coverage check (AC-007)', () => {
    expect(coverageProblems(real)).toEqual(['service.battery_replacement.price: placeholder, needs a source'])
  })

  it('defines every impact ref used by the shared assessment fixtures', () => {
    const ids = new Set(real.entries.map((e) => e.id))
    const dir = new URL('../../shared/fixtures/', import.meta.url)
    const refs = readdirSync(dir)
      .filter((f) => f.startsWith('assessment.'))
      .flatMap((f) => [...readFileSync(new URL(f, dir), 'utf8').matchAll(/"impact_refs":\s*\[([^\]]*)\]/g)])
      .flatMap((m) => [...m[1]!.matchAll(/"([^"]+)"/g)].map((r) => r[1]!))
    expect(refs.length).toBeGreaterThan(0)
    expect(refs.filter((r) => !ids.has(r))).toEqual([])
  })
})

describe('checkImpactTable', () => {
  it.each([
    ['low greater than high', table([{ ...entry, low: 3 }]), 'low 3 is greater than high 2'],
    ['duplicate ids', table([entry, entry]), 'duplicate id'],
    ['unknown sources', table([{ ...entry, sources: ['nope'] }]), 'unknown source nope'],
    ['sourced entries without sources', table([{ ...entry, sources: [] }], {}), 'need at least one source'],
    ['sourced entries without derivation', table([{ ...entry, derivation: undefined }]), 'need a derivation'],
    ['unused sources', table([entry], { s: source, extra: source }), 'source extra is not used'],
    ['a missing access date', table([entry], { s: { ...source, accessed_on: undefined } }), 'accessed_on'],
    ['an unknown unit', table([{ ...entry, unit: 'tons' }]), '/entries/0/unit'],
  ])('rejects %s', (_name, value, message) => {
    expect(checkImpactTable(JSON.parse(JSON.stringify(value))).join('\n')).toContain(message)
  })

  it('accepts placeholders without sources', () => {
    expect(checkImpactTable(table([entry, { ...entry, id: 'part.y.price', status: 'placeholder', sources: [], derivation: undefined }]))).toEqual([])
  })
})

describe('coverageProblems', () => {
  it('reports missing and placeholder entries', () => {
    const t = table([entry, { ...entry, id: 'part.y.price', status: 'placeholder' }]) as ImpactTable
    expect(coverageProblems(t, ['part.x.price', 'part.y.price', 'part.z.price'])).toEqual([
      'part.y.price: placeholder, needs a source',
      'part.z.price: missing',
    ])
  })
})

describe('parseImpactTable', () => {
  it('expands YAML merge keys and throws with all problems on invalid input', () => {
    const yaml = `schema_version: 1
sources: { s: { title: T, publisher: P, url: "https://example.org/s", accessed_on: 2026-11-20 } }
entries:
  - &e { id: part.a.price, description: A, low: 1, high: 2, unit: eur, status: sourced, sources: [s], derivation: d }
  - { <<: *e, id: part.b.price }
`
    expect(parseImpactTable(yaml).entries.map((e) => [e.id, e.high])).toEqual([['part.a.price', 2], ['part.b.price', 2]])
    expect(() => parseImpactTable(yaml.replace('high: 2', 'high: 0'))).toThrow(/low 1 is greater than high 0[\s\S]*part.b.price/)
  })
})
