// The "Your plan" card (feature 013): the server's combined plan as a card view. All figures come
// from the plan's impact, which the server prices as one plan; nothing is added up here.
import type { Assessment } from '@leaaf/shared/assessment'
import type { CategoryResult } from '@leaaf/shared/categories'
import { avoidedHint } from './categoryView'
import { formatAvoided, formatEur, formatYears, gaugeValue } from './impact'
import { STATUS_LABELS } from './labels'
import { co2Of, type CardView } from './pathView'

export const PLAN_TITLE = 'Your plan'

export interface PlanView extends CardView {
  /** Step titles in the plan's order. */
  stepTitles: string[]
}

/** The plan card, or null when the result has no plan (FR-007). It has no score (out of scope). */
export function buildPlanView(result: CategoryResult, baseline: Assessment['baseline']): PlanView | null {
  const plan = result.plan
  if (!plan) return null
  const { impact } = plan
  return {
    key: 'plan',
    iconPath: 'upgrade',
    rank: null,
    title: PLAN_TITLE,
    status: 'viable',
    statusLabel: STATUS_LABELS.viable,
    isRecommended: false,
    aiEstimate: plan.impact_source === 'ai_estimate',
    summary: plan.summary,
    metrics: [
      { label: 'Cost', value: formatEur(impact.cost_eur) },
      { label: 'Extra life', value: formatYears(impact.useful_life_years) },
      { label: 'CO₂e avoided', value: formatAvoided(impact), hint: avoidedHint(impact) },
    ],
    steps: null,
    why: null,
    sources: [],
    gauge: gaugeValue(impact, baseline),
    co2: co2Of(impact),
    stepTitles: plan.steps.map((s) => s.title),
  }
}
