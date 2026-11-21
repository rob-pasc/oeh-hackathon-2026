// Turns the CategoryResult (feature 008) into the Overview's category cards and each category's
// option cards. Ordering comes from shared/src/ranking.ts, so the mode toggle re-ranks without a
// request (FR-008); every figure comes from the payload.
import type { Assessment } from '@leaaf/shared/assessment'
import type { CategoryOption, CategoryResult } from '@leaaf/shared/categories'
import type { Mode } from '@leaaf/shared/common'
import { rankCategories, recommendedCategory, type RankedOption } from '@leaaf/shared/ranking'
import { formatAvoided, formatEur, formatYears, gaugeValue } from './impact'
import { KIND_ICONS, STATUS_LABELS } from './labels'
import { co2Of, scoreMetric, type CardView, type SourceRef } from './pathView'

export interface OptionView extends CardView {
  id: string
  total: number | null
  option: CategoryOption
}

export interface CategoryView extends CardView {
  id: string
  /** The category's score in the current mode; null when it has no fitting option. */
  total: number | null
  /** Ranked Good fit, Depends, Not a fit, by score within each (FR-009). */
  options: OptionView[]
  /** The option that decides the category's status and score. */
  best: OptionView
}

const MAX_SOURCES = 2

function optionView({ option, total }: RankedOption, categoryId: string, result: CategoryResult, baseline: Assessment['baseline']): OptionView {
  const impact = option.impact
  const passages = new Map(result.passages.map((p) => [p.passage_id, p]))
  const sources: SourceRef[] = []
  for (const id of option.claims.flatMap((c) => c.passage_ids)) {
    const p = passages.get(id)
    if (!p || sources.some((s) => s.url === p.url && s.label.startsWith(p.title))) continue
    sources.push({ label: p.section ? `${p.title}, ${p.section}` : p.title, url: p.url })
  }
  return {
    key: `${categoryId}:${option.option_id}`,
    id: option.option_id,
    option,
    total,
    iconPath: option.path ?? KIND_ICONS[option.kind],
    rank: null,
    title: option.title,
    status: option.status,
    statusLabel: STATUS_LABELS[option.status],
    isRecommended: false,
    aiEstimate: option.impact_source === 'ai_estimate',
    summary: option.reason,
    metrics: [
      { label: 'Cost', value: impact ? formatEur(impact.cost_eur) : '—' },
      { label: 'Extra life', value: impact ? formatYears(impact.useful_life_years) : '—' },
      { label: 'CO₂e avoided', value: impact ? formatAvoided(impact) : '—', hint: 'Compared with buying a comparable new laptop now.' },
      scoreMetric(total),
    ],
    // The option card shows its step plan (feature 009) through PathCard's `plan`, not these one-line steps.
    steps: null,
    why: option.why || null,
    sources: sources.slice(0, MAX_SOURCES),
    gauge: impact ? gaugeValue(impact, baseline) : null,
    co2: co2Of(impact),
  }
}

export function buildCategoryViews(result: CategoryResult, assessment: Assessment, mode: Mode): CategoryView[] {
  const ranked = rankCategories(result.categories, assessment.weights[mode])
  const recommended = recommendedCategory(ranked)
  return ranked.map((r, index) => {
    const options = r.options.map((o) => optionView(o, r.category.category_id, result, assessment.baseline))
    const best = options[0]!
    return {
      ...best,
      key: r.category.category_id,
      id: r.category.category_id,
      rank: index + 1,
      title: r.category.label,
      summary: r.category.summary,
      status: r.status,
      statusLabel: STATUS_LABELS[r.status],
      total: r.total,
      isRecommended: recommended?.category.category_id === r.category.category_id,
      // The header shows the best option's figures, except a score where the category has none.
      metrics: [...best.metrics.slice(0, -1), scoreMetric(r.total)],
      steps: null,
      why: null,
      sources: [],
      options,
      best,
    }
  })
}
