// Turns the proposed PathOption payload into cards for the path tabs. Figures are formatted from each option's
// own impact, with the same functions as for whole paths; nothing is computed here.
import type { Assessment } from '@leaaf/shared/assessment'
import type { Suitability } from '@leaaf/shared/common'
import type { PathOption } from '../api/types'
import { formatAdded, formatEur, formatYears, gaugeValue } from './impact'
import { STATUS_LABELS } from './labels'
import { co2Of, type CardView } from './pathView'

const STATUS_ORDER: Record<Suitability, number> = { viable: 0, conditional: 1, not_suitable: 2 }

export function buildOptionViews(options: readonly PathOption[], baseline: Assessment['baseline']): CardView[] {
  const views = options.map((option) => {
    const impact = option.impact
    const gauge = impact ? gaugeValue(impact, baseline) : null
    const view: CardView = {
      key: `${option.path}:${option.option_id}`,
      iconPath: option.path,
      rank: null,
      title: option.title,
      status: option.status,
      statusLabel: STATUS_LABELS[option.status],
      isRecommended: false,
      summary: option.summary,
      metrics: [
        { label: 'Cost', value: impact ? formatEur(impact.cost_eur) : '—' },
        { label: 'Extra life', value: impact ? formatYears(impact.useful_life_years) : '—' },
        { label: 'CO₂e added', value: impact ? formatAdded(impact) : '—' },
      ],
      steps: option.steps,
      why: option.why,
      source: null,
      notes: option.unverified,
      gauge,
      co2: co2Of(impact),
      changes: option.changes ?? [],
    }
    return view
  })
  // Suitable options first, then conditional, then not suitable; within a status the larger CO₂e credit first.
  return views
    .map((view, index) => ({ view, index }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.view.status] - STATUS_ORDER[b.view.status] ||
        (b.view.gauge?.mid ?? -1) - (a.view.gauge?.mid ?? -1) ||
        a.index - b.index,
    )
    .map(({ view }) => view)
}
