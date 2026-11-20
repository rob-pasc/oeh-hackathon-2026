// Static impact table (feature 003 FR-007): loads data/impact.yaml, validates its shape and
// cross-references, and checks coverage of the entries the calculator needs.
import { readFileSync } from 'node:fs'
import { Type, type Static } from 'typebox'
import { parse } from 'yaml'
import { createValidator, INTENDED_USES, IsoDate, PATHS } from '@leaaf/shared'

const strict = { additionalProperties: false } as const

export const ImpactSource = Type.Object(
  {
    title: Type.String({ minLength: 1 }),
    publisher: Type.String({ minLength: 1 }),
    url: Type.String({ format: 'uri' }),
    accessed_on: IsoDate,
  },
  strict,
)

export const ImpactEntry = Type.Object(
  {
    id: Type.String({ pattern: '^[a-z0-9_]+(\\.[a-z0-9_]+)+$' }),
    description: Type.String({ minLength: 1 }),
    low: Type.Number(),
    high: Type.Number(),
    unit: Type.Enum(['kg_co2e', 'eur', 'years']),
    /** sourced: derived from sources; assumption: informed by sources; placeholder: unsourced, fails coverage. */
    status: Type.Enum(['sourced', 'assumption', 'placeholder']),
    sources: Type.Array(Type.String({ minLength: 1 })),
    derivation: Type.Optional(Type.String({ minLength: 1 })),
    notes: Type.Optional(Type.String({ minLength: 1 })),
  },
  strict,
)
export type ImpactEntry = Static<typeof ImpactEntry>

export const ImpactTable = Type.Object(
  {
    schema_version: Type.Literal(1),
    sources: Type.Record(Type.String({ pattern: '^[a-z0-9_]+$' }), ImpactSource),
    entries: Type.Array(ImpactEntry, { minItems: 1 }),
  },
  strict,
)
export type ImpactTable = Static<typeof ImpactTable>

/**
 * Entries the calculator (T-004) relies on for every device. Model-specific entries for the demo
 * models are added here once the models are chosen (T-008).
 */
export const REQUIRED_ENTRY_IDS: readonly string[] = [
  'new_laptop.production_co2e',
  'new_laptop.price',
  'new_desktop.production_co2e',
  'new_desktop.price',
  'part.ram_8gb_ddr4.production_co2e',
  'part.ram_8gb_ddr4.price',
  'part.ram_16gb_ddr4.production_co2e',
  'part.ram_16gb_ddr4.price',
  'part.ssd_500gb.production_co2e',
  'part.ssd_500gb.price',
  'part.ssd_sata_500gb.price',
  'part.battery_laptop.production_co2e',
  'part.battery_laptop.price',
  'service.battery_replacement.price',
  'pass_on.handover_co2e',
  'recycle.processing_co2e',
  ...PATHS.flatMap((path) => INTENDED_USES.map((use) => `life_extra.${path}.${use}`)),
]

const isTable = createValidator(ImpactTable)

/** Shape and cross-field problems; an empty list means the table is valid. */
export function checkImpactTable(value: unknown): string[] {
  const shape = isTable(value)
  if (!shape.ok) return shape.errors.map((e) => `${e.path || '/'}: ${e.message}`)
  const table = shape.value
  const problems: string[] = []
  const seen = new Set<string>()
  for (const e of table.entries) {
    if (seen.has(e.id)) problems.push(`${e.id}: duplicate id`)
    seen.add(e.id)
    if (e.low > e.high) problems.push(`${e.id}: low ${e.low} is greater than high ${e.high}`)
    if (e.low < 0) problems.push(`${e.id}: negative values are not allowed`)
    for (const ref of e.sources) if (!(ref in table.sources)) problems.push(`${e.id}: unknown source ${ref}`)
    if (e.status !== 'placeholder') {
      if (e.sources.length === 0) problems.push(`${e.id}: ${e.status} entries need at least one source`)
      if (!e.derivation) problems.push(`${e.id}: ${e.status} entries need a derivation`)
    }
  }
  const used = new Set(table.entries.flatMap((e) => e.sources))
  for (const id of Object.keys(table.sources)) if (!used.has(id)) problems.push(`source ${id} is not used by any entry`)
  return problems
}

/** Required entries that are missing or still placeholders (AC-007 coverage check). */
export function coverageProblems(table: ImpactTable, required: readonly string[] = REQUIRED_ENTRY_IDS): string[] {
  const byId = new Map(table.entries.map((e) => [e.id, e]))
  return required.flatMap((id) => {
    const entry = byId.get(id)
    if (!entry) return [`${id}: missing`]
    return entry.status === 'placeholder' ? [`${id}: placeholder, needs a source`] : []
  })
}

export function parseImpactTable(text: string): ImpactTable {
  // merge: true enables YAML `<<` merge keys, used for the repetitive useful-life entries.
  const value: unknown = parse(text, { merge: true })
  const problems = checkImpactTable(value)
  if (problems.length > 0) throw new Error(`invalid impact table:\n- ${problems.join('\n- ')}`)
  return value as ImpactTable
}

export const DEFAULT_IMPACT_TABLE_PATH = new URL('../../../data/impact.yaml', import.meta.url)

/** Loads and validates the table; throws on any problem so that startup fails (like the weights, FR-011). */
export function loadImpactTable(path: string | URL = DEFAULT_IMPACT_TABLE_PATH): ImpactTable {
  return parseImpactTable(readFileSync(path, 'utf8'))
}
