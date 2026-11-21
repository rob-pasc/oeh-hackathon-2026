// Turns the Assessment into the five path cards shown while the categories are on their way, and
// defines the card shape that category and option cards share. Ordering comes from
// shared/src/ranking.ts so the browser and the server agree (feature 003 FR-012).
import type { Assessment, Impact } from '@leaaf/shared/assessment'
import type { Mode, Path, Range, Suitability } from '@leaaf/shared/common'
import { rankPaths, recommendedPath } from '@leaaf/shared/ranking'
import { formatEur, formatYears, gaugeValue, type GaugeValue } from './impact'
import { PATH_TITLES, STATUS_LABELS, type IconKind } from './labels'

export interface SourceRef {
  label: string
  url: string
}

export interface CardMetric {
  label: string
  value: string
  /** Short explanation shown on hover. */
  hint?: string
}

/** What a card needs to draw itself; shared by path, category and option cards. */
export interface CardView {
  /** Stable key within one list. */
  key: string
  iconPath: IconKind
  /** Rank within the list, or null for items that are not ranked (options). */
  rank: number | null
  title: string
  status: Suitability
  statusLabel: string
  isRecommended: boolean
  /** The figures are AI estimates, not calculated from the impact table (feature 008 FR-010). */
  aiEstimate: boolean
  /** One-sentence reason. */
  summary: string
  /** Short key figures under the summary. */
  metrics: CardMetric[]
  /** One-line "What to do" steps of a path card; null for categories and options, whose step plans come separately (feature 009). */
  steps: string[] | null
  why: string | null
  /** At most two cited sources. */
  sources: SourceRef[]
  gauge: GaugeValue | null
  /** Avoided CO₂e for the equivalents under the gauge; null when nothing is credited. */
  co2: { avoided: Range; conditional: boolean } | null
}

/** Avoided CO₂e of an impact for the equivalents, or null when the contract credits nothing. */
export function co2Of(impact: Impact | null): CardView['co2'] {
  if (!impact || impact.displacement === 'none' || !(impact.co2e_kg.avoided_vs_baseline.high > 0)) return null
  return { avoided: impact.co2e_kg.avoided_vs_baseline, conditional: impact.displacement === 'conditional' }
}

export interface PathView extends CardView {
  id: Path
  /** Weighted score for the active mode; null for not-suitable paths. */
  total: number | null
}

export const scoreMetric = (total: number | null): CardMetric => ({
  label: 'Score',
  value: total === null ? '—' : String(Math.round(total)),
  hint: '0–100. Higher is better for your priority.',
})

/** The five assessed paths, ranked for the mode; their details wait for the categories. */
export function buildPathViews(assessment: Assessment, mode: Mode): PathView[] {
  const ranked = rankPaths(assessment.paths, assessment.weights[mode])
  const recommended = recommendedPath(ranked)

  return ranked.map(({ path, total }, index) => {
    const firstReason = path.reasons[0]?.text ?? ''
    const missingModel = assessment.model_evidence === 'none' && (path.path === 'repair' || path.path === 'upgrade')
    const unknown = path.reasons.find(r => r.code.startsWith('cannot_verify') || /could not|cannot be verified/i.test(r.text))
    const missingReading = path.confidence.reasons.find(reason => reason.startsWith('Some scan readings were unavailable'))
    const evidenceNote = unknown?.text ?? missingReading ?? (missingModel ? `Model-specific ${path.path} compatibility could not be verified.` : '')

    return {
      key: path.path,
      id: path.path,
      iconPath: path.path,
      rank: index + 1,
      title: PATH_TITLES[path.path],
      status: path.status,
      statusLabel: STATUS_LABELS[path.status],
      total,
      isRecommended: recommended !== null && recommended.path.path === path.path,
      aiEstimate: false,
      metrics: [
        { label: 'Cost', value: path.impact ? formatEur(path.impact.cost_eur) : '—' },
        { label: 'Extra life', value: path.impact ? formatYears(path.impact.useful_life_years) : '—' },
        scoreMetric(total),
      ],
      summary: evidenceNote && !firstReason.includes(evidenceNote) ? `${firstReason} ${evidenceNote}` : firstReason,
      steps: [],
      why: null,
      sources: [],
      gauge: path.impact ? gaugeValue(path.impact, assessment.baseline) : null,
      co2: co2Of(path.impact),
    }
  })
}
