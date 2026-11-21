// Figures, scores and confidence of one AI option (feature 008 FR-002 to FR-005). Pure: the same
// option and assessment inputs always give the same result.
//
// Priced kinds reuse the feature 003 calculator with a plan built for the single part, so their
// figures trace back to impact table entries. Options of kind `other` keep the AI's ranges only when
// they pass the range checks, and are always labelled as AI estimates.
import type { Assessment, CategoryOption, Difficulty, Impact, IntendedUse, OptionKind, Path, Range, Suitability } from '@leaaf/shared'
import type { DeviceScan } from '@leaaf/shared'
import { calculateImpact, type ImpactIndex } from '../assessment/calculator.ts'
import type { GateResult, PathPlan } from '../assessment/gates.ts'
import { confidence, optionFeasibility, rubricScores } from '../assessment/scoring.ts'

type Baseline = Assessment['baseline']

/** The assessed path whose gate and life table a priced kind shares. */
export const KIND_PATH: Record<Exclude<OptionKind, 'other'>, Path> = {
  ssd: 'upgrade',
  ram: 'upgrade',
  battery: 'repair',
  hand_down: 'pass_on',
  salvage: 'salvage',
  recycle: 'recycle',
}

/** Kinds after which the current owner no longer has the computer. */
const ENDS_OWNERS_USE = new Set<OptionKind>(['hand_down', 'salvage', 'recycle'])

/** AI-supplied ranges for an option of kind `other`; co2e_kg is what the option itself causes. */
export interface AiEstimate {
  cost_eur: Range
  useful_life_years: Range
  co2e_kg: Range
}

export interface OptionContext {
  scan: DeviceScan
  use: IntendedUse
  baseline: Baseline
  modelEvidence: 'model_specific' | 'none'
  /** The feature 003 gate results for this device, one per path. */
  gates: readonly GateResult[]
  impactIndex: ImpactIndex
}

/** The AI's judgement of one option, before the server adds figures and scores. */
export interface OptionDraft {
  option_id: string
  title: string
  status: Suitability
  reason: string
  kind: OptionKind
  difficulty: Difficulty
  why: string
  claims: CategoryOption['claims']
  estimate: AiEstimate | null
}

export const AI_ESTIMATE_ASSUMPTION = 'AI estimate: the cost, extra life and CO₂e of this option come from the AI, not from the impact table.'
export const AI_ESTIMATE_CONFIDENCE = 'The figures are an AI estimate, not calculated from the impact table'

const gateFor = (ctx: OptionContext, path: Path) => {
  const gate = ctx.gates.find((g) => g.path === path)
  if (!gate) throw new Error(`no gate result for ${path}`)
  return gate
}

/**
 * The single-part plan the calculator prices for a priced kind. Part details follow the device's
 * own upgrade and repair gates (drive interface, RAM module size, who replaces the battery), so an
 * AI option never gets cheaper figures than the gates allow; a professional battery job is priced
 * whenever the gate or the AI calls for one.
 */
export function planFor(kind: Exclude<OptionKind, 'other'>, difficulty: Difficulty, ctx: OptionContext): PathPlan {
  switch (kind) {
    case 'ssd': {
      const upgrade = gateFor(ctx, 'upgrade').plan
      const ssd = upgrade?.path === 'upgrade' && upgrade.ssd ? upgrade.ssd : 'nvme'
      return { path: 'upgrade', ssd, ram: null, ram_after_gb: null }
    }
    case 'ram': {
      const upgrade = gateFor(ctx, 'upgrade').plan
      const ram = upgrade?.path === 'upgrade' && upgrade.ram ? upgrade.ram : { module_gb: 8 as const, kind: 'add' as const }
      return { path: 'upgrade', ssd: null, ram, ram_after_gb: null }
    }
    case 'battery': {
      const repair = gateFor(ctx, 'repair').plan
      const professional = difficulty === 'professional' || (repair?.path === 'repair' && repair.battery === 'professional')
      return { path: 'repair', battery: professional ? 'professional' : 'diy' }
    }
    case 'hand_down':
      return { path: 'pass_on' }
    case 'salvage':
      return { path: 'salvage' }
    case 'recycle':
      return { path: 'recycle' }
  }
}

const validRange = (r: Range, allowNegative = false) =>
  Number.isFinite(r.low) && Number.isFinite(r.high) && r.low <= r.high && (allowNegative || r.low >= 0)

/**
 * Turns an AI estimate into the Impact shape, or null when any range fails FR-004's checks. The
 * option's own CO₂e must not be negative either: a negative value would claim a saving that the
 * baseline comparison already credits.
 */
export function estimatedImpact(estimate: AiEstimate, use: IntendedUse, baseline: Baseline): Impact | null {
  const { cost_eur, useful_life_years, co2e_kg } = estimate
  if (![cost_eur, useful_life_years, co2e_kg].every((r) => validRange(r))) return null
  // Same displacement convention as the calculator: keeping the device in use credits the baseline;
  // passing it on, or an option that may add no life, credits it only in the high end.
  const displacement: Impact['displacement'] =
    useful_life_years.high <= 0 ? 'none' : useful_life_years.low <= 0 || use === 'pass_on' ? 'conditional' : 'assumed'
  const credited = displacement === 'assumed' ? baseline.co2e_kg : displacement === 'conditional' ? { low: 0, high: baseline.co2e_kg.high } : { low: 0, high: 0 }
  const assumptions: Impact['assumptions'] = [{ text: AI_ESTIMATE_ASSUMPTION, impact_refs: [] }]
  if (displacement === 'conditional')
    assumptions.push({
      text: 'Avoided new-device production counts only if the device then replaces a new purchase.',
      impact_refs: baseline.impact_refs.slice(0, 1),
    })
  return {
    cost_eur: { ...cost_eur },
    useful_life_years: { ...useful_life_years },
    co2e_kg: {
      path: { ...co2e_kg },
      baseline: { ...baseline.co2e_kg },
      avoided_vs_baseline: { low: credited.low - co2e_kg.high, high: credited.high - co2e_kg.low },
    },
    displacement,
    assumptions,
  }
}

/** Adds figures, scores and confidence to an AI option (FR-002 to FR-005). */
export function finishOption(draft: OptionDraft, ctx: OptionContext): CategoryOption {
  const { estimate: _estimate, ...base } = draft
  const unscored = (reasons: string[]): CategoryOption => ({
    ...base,
    impact: null,
    impact_source: null,
    scores: null,
    confidence: { level: reasons.length === 0 ? 'high' : 'medium', reasons },
    path: null,
  })

  // Not a fit: a reason and nothing else, whatever figures the AI sent (FR-002).
  if (draft.status === 'not_suitable') return unscored([])

  if (draft.kind === 'other') {
    const impact = draft.estimate ? estimatedImpact(draft.estimate, ctx.use, ctx.baseline) : null
    if (!impact) return unscored(['The AI estimate for this option was missing or inconsistent, so it has no figures'])
    const reasons = [AI_ESTIMATE_CONFIDENCE]
    if (ctx.modelEvidence === 'none') reasons.push('No model-specific documentation was found for this computer')
    return {
      ...base,
      impact,
      impact_source: 'ai_estimate',
      scores: {
        ...rubricScores({ impact, use: ctx.use, baselineCost: ctx.baseline.cost_eur, endsOwnersUse: false, shortfall: false }),
        feasibility: optionFeasibility(draft.difficulty, draft.status),
      },
      // At most medium (FR-005); low when model evidence is missing as well.
      confidence: { level: reasons.length > 1 ? 'low' : 'medium', reasons },
      path: null,
    }
  }

  const path = KIND_PATH[draft.kind]
  const gate = gateFor(ctx, path)
  const plan = planFor(draft.kind, draft.difficulty, ctx)
  const impact = calculateImpact({ plan, use: ctx.use, scan: ctx.scan, baseline: ctx.baseline, impact: ctx.impactIndex })
  return {
    ...base,
    impact,
    impact_source: 'calculator',
    scores: {
      ...rubricScores({
        impact,
        use: ctx.use,
        baselineCost: ctx.baseline.cost_eur,
        endsOwnersUse: ENDS_OWNERS_USE.has(draft.kind),
        shortfall: gate.shortfall,
      }),
      feasibility: optionFeasibility(draft.difficulty, draft.status),
    },
    confidence: confidence({
      gate: { path, status: draft.status, reasons: [], plan, shortfall: gate.shortfall },
      impact,
      scan: ctx.scan,
      modelEvidence: ctx.modelEvidence,
      impactIndex: ctx.impactIndex,
    }),
    path: null,
  }
}
