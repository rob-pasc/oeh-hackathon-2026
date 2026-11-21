// Cross-field rules that JSON Schema cannot express. Each check returns a list of
// human-readable violations; an empty list means the value is consistent.
// Run these after schema validation, on both the producing and consuming side where practical.
import { PATHS, type Range } from './common.ts'
import { CRITERIA, type Assessment, type Weights } from './assessment.ts'
import { notApplicableFields, type DeviceScan } from './device.ts'
import type { FactSet } from './facts.ts'
import type { Report } from './report.ts'
import type { Passage } from './retrieval.ts'

/** Whether any value below `value` is null, skipping the dotted paths in `skip`. */
function containsNull(value: unknown, skip: ReadonlySet<string> = new Set(), path = ''): boolean {
  if (skip.has(path)) return false
  if (value === null) return true
  if (Array.isArray(value)) return value.some((v) => containsNull(v, skip, `${path}[]`))
  if (typeof value === 'object')
    return Object.entries(value).some(([k, v]) => containsNull(v, skip, path ? `${path}.${k}` : k))
  return false
}

export function checkDeviceScan(scan: DeviceScan): string[] {
  const errors: string[] = []
  const expected = containsNull(scan, new Set(notApplicableFields(scan))) ? 'partial' : 'complete'
  if (scan.scan_status !== expected) errors.push(`scan_status must be "${expected}"`)
  const { slots_total, slots_used } = scan.memory
  if (slots_total !== null && slots_used !== null && slots_used > slots_total)
    errors.push('memory.slots_used exceeds memory.slots_total')
  if (scan.battery.present === false) {
    const { design_capacity_mwh, full_charge_capacity_mwh, health_percent, cycle_count } = scan.battery
    if ([design_capacity_mwh, full_charge_capacity_mwh, health_percent, cycle_count].some((v) => v !== null))
      errors.push('battery values must be null when battery.present is false')
  }
  return errors
}

export function checkRange(range: Range, label: string): string[] {
  return range.low <= range.high ? [] : [`${label}: low (${range.low}) exceeds high (${range.high})`]
}

export function checkWeights(weights: Weights, label: string): string[] {
  const sum = CRITERIA.reduce((s, c) => s + weights[c], 0)
  return sum === 100 ? [] : [`${label}: weights sum to ${sum}, expected 100`]
}

export function checkPassage(passage: Passage): string[] {
  return passage.section === null && passage.page === null
    ? [`passage ${passage.passage_id}: section or page is required`]
    : []
}

function checkFivePaths(paths: readonly { path: string }[], label: string): string[] {
  const seen = new Set(paths.map((p) => p.path))
  const missing = PATHS.filter((p) => !seen.has(p))
  return seen.size === paths.length && missing.length === 0
    ? []
    : [`${label}: must contain each path exactly once (missing: ${missing.join(', ') || 'none'})`]
}

export function checkAssessment(a: Assessment): string[] {
  const errors = [
    ...checkWeights(a.weights.environment_first, 'weights.environment_first'),
    ...checkWeights(a.weights.money_first, 'weights.money_first'),
    ...checkRange(a.baseline.co2e_kg, 'baseline.co2e_kg'),
    ...checkRange(a.baseline.cost_eur, 'baseline.cost_eur'),
    ...checkFivePaths(a.paths, 'paths'),
  ]
  for (const p of a.paths) {
    const label = `paths[${p.path}]`
    if (p.status === 'not_suitable') {
      if (p.scores !== null) errors.push(`${label}: not_suitable paths must not have scores`)
      if (p.impact !== null) errors.push(`${label}: not_suitable paths must not have impact`)
      continue
    }
    if (p.scores === null) errors.push(`${label}: ${p.status} paths need scores`)
    if (p.impact === null) {
      errors.push(`${label}: ${p.status} paths need impact`)
      continue
    }
    const { cost_eur, useful_life_years, co2e_kg } = p.impact
    errors.push(
      ...checkRange(cost_eur, `${label}.impact.cost_eur`),
      ...checkRange(useful_life_years, `${label}.impact.useful_life_years`),
      ...checkRange(co2e_kg.path, `${label}.impact.co2e_kg.path`),
      ...checkRange(co2e_kg.avoided_vs_baseline, `${label}.impact.co2e_kg.avoided_vs_baseline`),
    )
    if (co2e_kg.baseline.low !== a.baseline.co2e_kg.low || co2e_kg.baseline.high !== a.baseline.co2e_kg.high)
      errors.push(`${label}.impact.co2e_kg.baseline must equal baseline.co2e_kg`)
    if (p.path === 'pass_on' && p.impact.displacement === 'assumed')
      errors.push(`${label}: pass_on displacement must be conditional or none (feature 003 FR-009)`)
    if (p.impact.displacement === 'conditional' && co2e_kg.avoided_vs_baseline.low > 0)
      errors.push(`${label}: conditional displacement cannot guarantee avoided CO2e (avoided_vs_baseline.low must be <= 0)`)
    if (p.impact.displacement === 'none' && co2e_kg.avoided_vs_baseline.high > 0)
      errors.push(`${label}: without displacement no baseline is credited (avoided_vs_baseline.high must be <= 0)`)
  }
  return errors
}

export function checkFactSet(set: FactSet): string[] {
  const keys = set.facts.map((f) => f.key)
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
  return dupes.length === 0 ? [] : [`duplicate fact keys: ${[...new Set(dupes)].join(', ')}`]
}

export function checkReport(report: Report): string[] {
  const errors = [...checkFivePaths(report.paths, 'paths'), ...report.passages.flatMap(checkPassage)]
  const known = new Set(report.passages.map((p) => p.passage_id))
  for (const p of report.paths)
    for (const claim of p.claims)
      for (const id of claim.passage_ids)
        if (!known.has(id)) errors.push(`paths[${p.path}]: claim cites unknown passage ${id}`)
  return errors
}
