// The combined plan (feature 013): which options may form a plan, and its figures as one plan.
//
// The AI proposes the plan in the category call; the server keeps it only when it passes FR-002 and
// FR-003, and prices it here (FR-004 to FR-006). The fallback plan of FR-009 is built from the gates.
// Pure: the same steps and context always give the same plan.
import { PLAN_MAX_STEPS, type Category, type CategoryOption, type Difficulty, type Impact, type Plan, type PlanStep, type Range } from '@leaaf/shared'
import { avoided, calculateImpact } from '../assessment/calculator.ts'
import type { RepairPlan, UpgradePlan } from '../assessment/gates.ts'
import { planFor, type OptionContext } from './options.ts'

type StepKind = PlanStep['kind']

/** Options of these kinds keep the computer with its owner, so they can be combined. */
const KEEPS_IN_USE = new Set<string>(['ssd', 'ram', 'battery', 'other'])

export const FALLBACK_PLAN_SUMMARY = 'These steps from the device assessment keep this computer useful for longer.'
export const PLAN_ASSUMPTION =
  'The steps are priced as one plan: their costs and emissions add up, a new purchase is avoided at most once, and the extra life is that of the longest-lasting step.'

/** A step with what pricing needs: the option's difficulty and, for `other`, its AI-estimated figures. */
export interface PlanInput extends PlanStep {
  status: CategoryOption['status']
  difficulty: Difficulty
  impact: Impact | null
  impact_source: CategoryOption['impact_source']
}

/** Why a proposed plan cannot be shown (FR-002, FR-003); empty when it can. */
export function planProblems(steps: readonly PlanInput[]): string[] {
  const problems: string[] = []
  if (steps.length < 2) problems.push('a plan needs at least two steps')
  if (steps.length > PLAN_MAX_STEPS) problems.push(`a plan has at most ${PLAN_MAX_STEPS} steps`)
  const seen = new Set<string>()
  steps.forEach((step, i) => {
    const key = `${step.category_id}/${step.option_id}/${step.kind}`
    if (seen.has(key)) problems.push(`step ${i + 1} repeats ${key}`)
    seen.add(key)
    if (step.status !== 'viable') problems.push(`step ${i + 1} is not a Good fit`)
    if (step.kind === 'hand_down' ? i !== steps.length - 1 : !KEEPS_IN_USE.has(step.kind))
      problems.push(`step ${i + 1} (${step.kind}) cannot be part of a plan at this position`)
    if (step.kind === 'other' && step.impact === null) problems.push(`step ${i + 1} has no figures to price`)
  })
  return problems
}

const add = (a: Range, b: Range): Range => ({ low: a.low + b.low, high: a.high + b.high })
const longest = (a: Range, b: Range): Range => ({ low: Math.max(a.low, b.low), high: Math.max(a.high, b.high) })

/**
 * One calculator run for the plan (FR-004, FR-005): SSD and RAM steps form one upgrade plan, a
 * battery step adds the repair, `other` steps add their AI ranges, and a final hand_down adds the
 * handover. Costs and own emissions add up; extra life is the longest step's; the baseline is
 * credited once. Ending with hand_down prices the parts as for "pass it on": the credit then
 * depends on the recipient.
 */
export function pricePlan(steps: readonly PlanInput[], ctx: OptionContext): Pick<Plan, 'impact' | 'impact_source'> {
  const handDown = steps.at(-1)?.kind === 'hand_down'
  const use = handDown ? 'pass_on' : ctx.use
  const calc = (plan: Parameters<typeof calculateImpact>[0]['plan']) =>
    calculateImpact({ plan, use, scan: ctx.scan, baseline: ctx.baseline, impact: ctx.impactIndex })
  const has = (kind: StepKind) => steps.some((s) => s.kind === kind)

  const parts: Impact[] = []
  if (has('ssd') || has('ram')) {
    const ssd = has('ssd') ? (planFor('ssd', 'diy_moderate', ctx) as UpgradePlan).ssd : null
    const ram = has('ram') ? (planFor('ram', 'diy_moderate', ctx) as UpgradePlan).ram : null
    parts.push(calc({ path: 'upgrade', ssd, ram, ram_after_gb: null }))
  }
  const battery = steps.find((s) => s.kind === 'battery')
  if (battery) parts.push(calc(planFor('battery', battery.difficulty, ctx) as RepairPlan))
  for (const step of steps) if (step.kind === 'other' && step.impact) parts.push(step.impact)
  if (handDown) parts.push(calculateImpact({ plan: { path: 'pass_on' }, use: ctx.use, scan: ctx.scan, baseline: ctx.baseline, impact: ctx.impactIndex }))

  const zero: Range = { low: 0, high: 0 }
  const cost = parts.reduce((sum, p) => add(sum, p.cost_eur), zero)
  const own = parts.reduce((sum, p) => add(sum, p.co2e_kg.path), zero)
  const life = parts.reduce((max, p) => longest(max, p.useful_life_years), zero)
  // Same convention as the calculator and AI estimates: keeping the computer credits the baseline;
  // handing it on, or a plan that may add no life, credits it only in the high end.
  const displacement: Impact['displacement'] =
    life.high <= 0 ? 'none' : handDown || use === 'pass_on' || life.low <= 0 ? 'conditional' : 'assumed'

  const conditionalText = 'Avoided new-device production counts only if'
  const assumptions: Impact['assumptions'] = [{ text: PLAN_ASSUMPTION, impact_refs: [] }]
  for (const a of parts.flatMap((p) => p.assumptions))
    if (!a.text.startsWith(conditionalText) && !assumptions.some((b) => b.text === a.text)) assumptions.push(a)
  if (displacement === 'conditional')
    assumptions.push({
      text: 'Avoided new-device production counts only if the computer then replaces a new purchase, for example by the person it is handed to.',
      impact_refs: ctx.baseline.impact_refs.slice(0, 1),
    })

  return {
    impact: {
      cost_eur: cost,
      useful_life_years: life,
      co2e_kg: { path: own, baseline: { ...ctx.baseline.co2e_kg }, avoided_vs_baseline: avoided(ctx.baseline.co2e_kg, own, displacement) },
      displacement,
      assumptions,
    },
    impact_source: steps.some((s) => s.impact_source === 'ai_estimate') ? 'ai_estimate' : 'calculator',
  }
}

/** The plan as the result carries it, or null when the steps fail FR-002/FR-003. */
export function finishPlan(summary: string, steps: readonly PlanInput[], ctx: OptionContext): Plan | null {
  if (planProblems(steps).length > 0) return null
  return {
    summary,
    steps: steps.map(({ category_id, option_id, title, kind }) => ({ category_id, option_id, title, kind })),
    ...pricePlan(steps, ctx),
  }
}

/**
 * Resolves the AI's option IDs (FR-001) to the result's options. An ID names the first option with
 * that ID; an unknown ID drops the whole plan, as the AI's order would no longer hold.
 */
export function resolvePlanSteps(optionIds: readonly string[], categories: readonly Category[]): PlanInput[] | null {
  const steps: PlanInput[] = []
  for (const id of optionIds) {
    const category = categories.find((c) => c.options.some((o) => o.option_id === id))
    const option = category?.options.find((o) => o.option_id === id)
    if (!category || !option) return null
    if (option.kind === 'salvage' || option.kind === 'recycle') return null
    steps.push({
      category_id: category.category_id,
      option_id: option.option_id,
      title: option.title,
      kind: option.kind,
      status: option.status,
      difficulty: option.difficulty,
      impact: option.impact,
      impact_source: option.impact_source,
    })
  }
  return steps
}

/**
 * The rule-based plan for the five-path fallback (FR-009): the upgrade's SSD and RAM steps, then the
 * battery repair, each only when its path is viable, in that fixed order.
 */
export function fallbackPlan(categories: readonly Category[], ctx: OptionContext): Plan | null {
  const optionOf = (path: string) => categories.find((c) => c.category_id === path)?.options[0]
  const steps: PlanInput[] = []
  const upgrade = optionOf('upgrade')
  const upgradeGate = ctx.gates.find((g) => g.path === 'upgrade')
  if (upgrade?.status === 'viable' && upgradeGate?.plan?.path === 'upgrade') {
    const { ssd, ram } = upgradeGate.plan
    const base = { category_id: 'upgrade', option_id: upgrade.option_id, status: upgrade.status, difficulty: upgrade.difficulty, impact: null, impact_source: null }
    if (ssd) steps.push({ ...base, kind: 'ssd', title: `Install a 500 GB ${ssd === 'nvme' ? 'NVMe M.2' : '2.5-inch SATA'} SSD` })
    if (ram)
      steps.push({ ...base, kind: 'ram', title: ram.kind === 'add' ? `Add a ${ram.module_gb} GB RAM module` : `Replace a RAM module with a ${ram.module_gb} GB one` })
  }
  const repair = optionOf('repair')
  if (repair?.status === 'viable')
    steps.push({
      category_id: 'repair',
      option_id: repair.option_id,
      kind: 'battery',
      title: repair.difficulty === 'professional' ? 'Have a repair shop replace the battery' : 'Replace the battery',
      status: repair.status,
      difficulty: repair.difficulty,
      impact: null,
      impact_source: null,
    })
  return finishPlan(FALLBACK_PLAN_SUMMARY, steps, ctx)
}
