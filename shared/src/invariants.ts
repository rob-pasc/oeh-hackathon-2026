// Cross-field rules that JSON Schema cannot express. Each check returns a list of
// human-readable violations; an empty list means the value is consistent.
// Run these after schema validation, on both the producing and consuming side where practical.
import { PATHS, type Range } from './common.ts'
import { CRITERIA, type Assessment, type Weights } from './assessment.ts'
import { notApplicableFields, type DeviceScan } from './device.ts'
import type { FactSet } from './facts.ts'
import type { Report } from './report.ts'
import type { CategoryResult } from './categories.ts'
import type { StepPlan } from './steps.ts'
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

function duplicates(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]
}

/** Cross-field rules of feature 008 FR-001 to FR-004; `baseline` is the assessment's baseline. */
export function checkCategoryResult(result: CategoryResult, baseline?: Assessment['baseline']): string[] {
  const errors = [...result.passages.flatMap(checkPassage)]
  const known = new Set(result.passages.map((p) => p.passage_id))
  const dupeCategories = duplicates(result.categories.map((c) => c.category_id))
  if (dupeCategories.length > 0) errors.push(`duplicate category ids: ${dupeCategories.join(', ')}`)
  if ((result.source === 'template') !== (result.notice !== null))
    errors.push('notice must be set exactly when source is template')
  for (const c of result.categories) {
    const dupeOptions = duplicates(c.options.map((o) => o.option_id))
    if (dupeOptions.length > 0) errors.push(`categories[${c.category_id}]: duplicate option ids: ${dupeOptions.join(', ')}`)
    for (const o of c.options) {
      const label = `categories[${c.category_id}].options[${o.option_id}]`
      for (const claim of o.claims)
        for (const id of claim.passage_ids) if (!known.has(id)) errors.push(`${label}: claim cites unknown passage ${id}`)
      const figures = [o.impact, o.impact_source, o.scores].filter((v) => v !== null).length
      if (o.status === 'not_suitable' && figures > 0) errors.push(`${label}: not_suitable options have no figures or scores`)
      if (figures !== 0 && figures !== 3) errors.push(`${label}: impact, impact_source and scores are all set or all null`)
      if (o.impact_source === 'ai_estimate' && (o.kind !== 'other' || o.path !== null))
        errors.push(`${label}: only AI options of kind other carry AI estimates`)
      if (o.impact_source === 'ai_estimate' && o.confidence.level === 'high')
        errors.push(`${label}: AI-estimated options have at most medium confidence`)
      if (!o.impact) continue
      const { cost_eur, useful_life_years, co2e_kg } = o.impact
      errors.push(
        ...checkRange(cost_eur, `${label}.impact.cost_eur`),
        ...checkRange(useful_life_years, `${label}.impact.useful_life_years`),
        ...checkRange(co2e_kg.path, `${label}.impact.co2e_kg.path`),
        ...checkRange(co2e_kg.avoided_vs_baseline, `${label}.impact.co2e_kg.avoided_vs_baseline`),
      )
      if (cost_eur.low < 0 || useful_life_years.low < 0) errors.push(`${label}: cost and extra life must not be negative`)
      if (baseline && (co2e_kg.baseline.low !== baseline.co2e_kg.low || co2e_kg.baseline.high !== baseline.co2e_kg.high))
        errors.push(`${label}.impact.co2e_kg.baseline must equal the assessment baseline`)
    }
  }
  if (result.plan) errors.push(...checkPlan(result, baseline))
  return errors
}

/** Feature 013: plan steps are distinct Good fit options, hand_down only last, figures consistent. */
function checkPlan(result: CategoryResult, baseline?: Assessment['baseline']): string[] {
  const plan = result.plan!
  const errors: string[] = []
  const seen = new Set<string>()
  plan.steps.forEach((step, i) => {
    const label = `plan.steps[${i}]`
    const option = result.categories.find((c) => c.category_id === step.category_id)?.options.find((o) => o.option_id === step.option_id)
    if (!option) return void errors.push(`${label}: unknown option ${step.category_id}/${step.option_id}`)
    const key = `${step.category_id}/${step.option_id}/${step.kind}`
    if (seen.has(key)) errors.push(`${label}: repeats ${key}`)
    seen.add(key)
    if (option.status !== 'viable') errors.push(`${label}: only Good fit options can be plan steps`)
    // The fallback's upgrade option (kind other, path upgrade) stands for its ssd and ram steps.
    const kindOk = option.kind === step.kind || (option.path === 'upgrade' && (step.kind === 'ssd' || step.kind === 'ram'))
    if (!kindOk) errors.push(`${label}: kind ${step.kind} does not match the option's kind ${option.kind}`)
    if (step.kind === 'hand_down' && i !== plan.steps.length - 1) errors.push(`${label}: hand_down can only be the last step`)
  })
  const ai = plan.steps.some(
    (s) => result.categories.find((c) => c.category_id === s.category_id)?.options.find((o) => o.option_id === s.option_id)?.impact_source === 'ai_estimate',
  )
  if ((plan.impact_source === 'ai_estimate') !== ai) errors.push('plan.impact_source is ai_estimate exactly when a step has AI-estimated figures')
  const { cost_eur, useful_life_years, co2e_kg } = plan.impact
  errors.push(
    ...checkRange(cost_eur, 'plan.impact.cost_eur'),
    ...checkRange(useful_life_years, 'plan.impact.useful_life_years'),
    ...checkRange(co2e_kg.path, 'plan.impact.co2e_kg.path'),
    ...checkRange(co2e_kg.avoided_vs_baseline, 'plan.impact.co2e_kg.avoided_vs_baseline'),
  )
  if (cost_eur.low < 0 || useful_life_years.low < 0) errors.push('plan: cost and extra life must not be negative')
  if (baseline && (co2e_kg.baseline.low !== baseline.co2e_kg.low || co2e_kg.baseline.high !== baseline.co2e_kg.high))
    errors.push('plan.impact.co2e_kg.baseline must equal the assessment baseline')
  return errors
}

/** Feature 009: citations resolve, technical steps are cited or professional, caution steps warn. */
export function checkStepPlan(plan: StepPlan): string[] {
  const errors = [...plan.passages.flatMap(checkPassage)]
  const known = new Set(plan.passages.map((p) => p.passage_id))
  if ((plan.source === 'template') !== (plan.notice !== null)) errors.push('notice must be set exactly when source is template')
  plan.steps.forEach((step, i) => {
    const label = `steps[${i}]`
    for (const id of step.passage_ids) if (!known.has(id)) errors.push(`${label}: cites unknown passage ${id}`)
    if (step.kind === 'technical' && step.passage_ids.length === 0 && step.safety !== 'professional')
      errors.push(`${label}: a technical step needs a citation unless it is professional`)
    if ((step.safety === 'caution') !== (step.warning !== null)) errors.push(`${label}: warning must be set exactly when safety is caution`)
    if (step.minutes) {
      errors.push(...checkRange(step.minutes, `${label}.minutes`))
      if (step.minutes.low < 0) errors.push(`${label}.minutes must not be negative`)
    }
  })
  return errors
}
