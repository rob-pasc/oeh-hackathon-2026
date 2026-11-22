// Criterion scores and confidence (feature 003 FR-010, FR-014, T-005).
//
// Each criterion is 0–100 and computed from one source only, so lifespan is not counted twice:
// environment from avoided CO2e, useful life from the extra-life range, economic from the owner's
// cost, feasibility from a fixed table. The rubrics, with examples, are in DESIGN.md.
import type { ConfidenceLevel, CriterionScores, DeviceScan, Difficulty, Impact, IntendedUse, ModelEvidence, Range, Suitability } from '@leaaf/shared'
import type { ImpactIndex } from './calculator.ts'
import type { GateResult } from './gates.ts'

const mid = (r: Range) => (r.low + r.high) / 2
const clampScore = (x: number) => Math.round(Math.min(100, Math.max(0, x)))

/** Extra useful life that earns the full useful-life score. Matches the upper end of the table's ranges. */
export const FULL_LIFE_YEARS = 4

/** Practical feasibility for the owner, before the conditional penalty. */
export const FEASIBILITY_BASE = {
  upgrade_one_part: 70,
  upgrade_two_parts: 60,
  repair_diy: 65,
  repair_professional: 60,
  pass_on: 85,
  salvage: 40,
  recycle: 95,
} as const
export const CONDITIONAL_FEASIBILITY_PENALTY = 20

/**
 * Feasibility of an AI option by difficulty (feature 008 FR-005), before the same conditional
 * penalty. Set within the range of FEASIBILITY_BASE: easy owner tasks like a one-part upgrade or
 * handing the device on, moderate ones like the two-part upgrade, and service jobs slightly below,
 * because they need an appointment and are the costliest to arrange.
 */
export const DIFFICULTY_FEASIBILITY = { diy_easy: 80, diy_moderate: 60, professional: 55 } as const satisfies Record<Difficulty, number>

export function optionFeasibility(difficulty: Difficulty, status: Suitability): number {
  return clampScore(DIFFICULTY_FEASIBILITY[difficulty] - (status === 'conditional' ? CONDITIONAL_FEASIBILITY_PENALTY : 0))
}

/** Paths after which the current owner no longer has this computer. */
const ENDS_OWNERS_USE = new Set(['pass_on', 'salvage', 'recycle'])

export interface RubricInput {
  impact: Impact
  use: IntendedUse
  baselineCost: Range
  /** The current owner no longer has the computer afterwards (passed on, salvaged or recycled). */
  endsOwnersUse: boolean
  /** The owner's needs stay unmet after the action; halves the useful-life score. */
  shortfall: boolean
}

/**
 * The three criteria computed from figures alone. Shared by the five paths and by the options of
 * feature 008, whose feasibility comes from their difficulty instead (FR-005).
 */
export function rubricScores({ impact, use, baselineCost, endsOwnersUse, shortfall }: RubricInput): Omit<CriterionScores, 'feasibility'> {
  // Environment: share of the baseline's production CO2e this path avoids (range midpoints).
  const environment = clampScore((100 * mid(impact.co2e_kg.avoided_vs_baseline)) / mid(impact.co2e_kg.baseline))

  // Useful life: extra years, halved when the device still falls short of what the use needs.
  const useful_life = clampScore(((100 * mid(impact.useful_life_years)) / FULL_LIFE_YEARS) * (shortfall ? 0.5 : 1))

  // Economic: the owner's out-of-pocket cost against buying new. If the owner wants to keep using a
  // computer but this path gives it away, they still have to buy a new one.
  const replacement = endsOwnersUse && use !== 'pass_on' ? mid(baselineCost) : 0
  const economic = clampScore(100 * (1 - (mid(impact.cost_eur) + replacement) / mid(baselineCost)))
  return { environment, useful_life, economic }
}

export interface ScoreInput {
  gate: GateResult
  impact: Impact
  use: IntendedUse
  baselineCost: Range
}

export function scorePath({ gate, impact, use, baselineCost }: ScoreInput): CriterionScores {
  const plan = gate.plan
  if (!plan) throw new Error(`cannot score not_suitable path ${gate.path}`)
  const rubric = rubricScores({ impact, use, baselineCost, endsOwnersUse: ENDS_OWNERS_USE.has(plan.path), shortfall: gate.shortfall })
  const { environment, useful_life, economic } = rubric

  let feasibility: number
  switch (plan.path) {
    case 'upgrade':
      feasibility = plan.ssd && plan.ram ? FEASIBILITY_BASE.upgrade_two_parts : FEASIBILITY_BASE.upgrade_one_part
      break
    case 'repair':
      feasibility = plan.battery === 'diy' ? FEASIBILITY_BASE.repair_diy : FEASIBILITY_BASE.repair_professional
      break
    default:
      feasibility = FEASIBILITY_BASE[plan.path]
  }
  if (gate.status === 'conditional') feasibility -= CONDITIONAL_FEASIBILITY_PENALTY

  return { environment, useful_life, economic, feasibility: clampScore(feasibility) }
}

/** An impact entry counts as wide when its high value is at least this many times its low value. */
export const WIDE_RANGE_FACTOR = 3

/** Paths whose feasibility depends on model-specific hardware facts. */
const COMPATIBILITY_PATHS = new Set(['upgrade', 'repair', 'salvage'])

export interface ConfidenceInput {
  gate: GateResult
  impact: Impact | null
  scan: DeviceScan
  modelEvidence: ModelEvidence
  impactIndex: ImpactIndex
}

/**
 * Starts at high and drops one level per penalty (two for missing model evidence on paths that
 * depend on it, one for web-only evidence): 0 penalties = high, 1 = medium, 2 or more = low.
 */
export function confidence({ gate, impact, scan, modelEvidence, impactIndex }: ConfidenceInput): {
  level: ConfidenceLevel
  reasons: string[]
} {
  const reasons: string[] = []
  let penalty = 0
  const flag = (text: string, weight = 1) => {
    reasons.push(text)
    penalty += weight
  }

  if (modelEvidence === 'none' && COMPATIBILITY_PATHS.has(gate.path))
    flag('No model-specific documentation was found for this computer', 2)
  // Web pages pass a model-name check and an LLM check (feature 017), but are not curated.
  if (modelEvidence === 'web' && COMPATIBILITY_PATHS.has(gate.path))
    flag('Model-specific facts come from web pages, not from the curated knowledge base')

  const missing = missingScanFields(gate.path, scan)
  if (missing.length > 0) flag(`Some scan readings were unavailable: ${missing.join(', ')}`)

  if (gate.path === 'repair' && scan.battery.health_percent === 100)
    flag('The battery reports exactly 100% of its design capacity, which some firmware reports regardless of wear')

  if (impact) {
    const entries = [...new Set(impact.assumptions.flatMap((a) => a.impact_refs))].map((id) => impactIndex.entry(id))
    const placeholders = entries.filter((e) => e.status === 'placeholder')
    if (placeholders.length > 0) flag(`Uses an estimate without a source yet: ${placeholders.map((e) => e.description).join('; ')}`)
    const estimates = entries.filter((e) => e.status === 'estimate')
    if (estimates.length > 0) flag(`Uses an estimate the sources do not cover: ${estimates.map((e) => e.description).join('; ')}`)
    const wide = entries.filter((e) => e.low > 0 && e.high >= WIDE_RANGE_FACTOR * e.low)
    if (wide.length > 0) flag(`Wide range in: ${wide.map((e) => e.description).join('; ')}`)
    if (impact.displacement === 'conditional')
      flag('The CO₂e saving depends on the recipient otherwise buying a new device')
  }

  const level: ConfidenceLevel = penalty === 0 ? 'high' : penalty === 1 ? 'medium' : 'low'
  return { level, reasons }
}

function missingScanFields(path: GateResult['path'], scan: DeviceScan): string[] {
  const missing: string[] = []
  switch (path) {
    case 'upgrade':
      if (scan.memory.total_gb === null) missing.push('installed RAM')
      if (scan.memory.slots_total === null || scan.memory.slots_used === null) missing.push('RAM slots')
      if (scan.storage === null || scan.storage.some((d) => d.media === 'unknown')) missing.push('drive type')
      break
    case 'repair':
      if (scan.battery.present === null) missing.push('battery presence')
      else if (scan.battery.present && scan.battery.health_percent === null) missing.push('battery wear')
      break
    case 'pass_on':
      if (scan.cpu.name === null) missing.push('CPU model')
      if (scan.storage === null) missing.push('drive health')
      break
    case 'salvage':
      if (scan.memory.slots_used === null) missing.push('RAM slots')
      if (scan.storage === null) missing.push('drive type')
      break
    case 'recycle':
      break
  }
  return missing
}
