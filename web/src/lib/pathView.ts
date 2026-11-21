// Turns the server payloads (Assessment, Report) into what the result screen renders.
// Ordering comes from shared/src/ranking.ts so the browser and the server agree (feature 003 FR-012).
import type { Assessment, Impact } from '@leaaf/shared/assessment'
import type { Mode, Path, Range, Suitability } from '@leaaf/shared/common'
import { rankPaths, recommendedPath } from '@leaaf/shared/ranking'
import type { Report } from '@leaaf/shared/report'
import type { SpecChange } from '../api/types'
import { formatEur, formatYears, gaugeValue, type GaugeValue } from './impact'
import { PATH_TITLES, STATUS_LABELS } from './labels'

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

/** What a card needs to draw itself; shared by path cards and option cards. */
export interface CardView {
  /** Stable key within one list. */
  key: string
  /** Path whose icon the card shows. */
  iconPath: Path
  /** Rank within the list, or null for items that are not ranked (options). */
  rank: number | null
  title: string
  status: Suitability
  statusLabel: string
  isRecommended: boolean
  /** One-sentence reason. */
  summary: string
  /** Short key figures under the summary. */
  metrics: CardMetric[]
  steps: string[]
  why: string | null
  source: SourceRef | null
  gauge: GaugeValue | null
  /** Avoided CO₂e for the equivalents under the gauge; null when nothing is credited. */
  co2: { avoided: Range; conditional: boolean } | null
  /** Spec lines the action changes (before → after); empty for whole paths. */
  changes: SpecChange[]
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
  /** True while `summary` still comes from the assessment because the report has not arrived. */
  summaryFromAssessment: boolean
}

export function buildPathViews(assessment: Assessment, report: Report | null, mode: Mode): PathView[] {
  const ranked = rankPaths(assessment.paths, assessment.weights[mode])
  const recommended = recommendedPath(ranked)

  return ranked.map(({ path, total }, index) => {
    const explanation = report?.paths.find((p) => p.path === path.path) ?? null
    const firstReason = path.reasons[0]?.text ?? ''
    const missingModel = assessment.model_evidence === 'none' && (path.path === 'repair' || path.path === 'upgrade')
    const unknown = path.reasons.find(r => r.code.startsWith('cannot_verify') || /could not|cannot be verified/i.test(r.text))
    const missingReading = path.confidence.reasons.find(reason => reason.startsWith('Some scan readings were unavailable'))
    const summary = explanation?.summary ?? firstReason
    const evidenceNote = unknown?.text ?? missingReading ?? (missingModel ? `Model-specific ${path.path} compatibility could not be verified.` : '')
    const passageId = explanation?.claims[0]?.passage_ids[0]
    const passage = passageId ? (report?.passages.find((p) => p.passage_id === passageId) ?? null) : null
    const cost = path.impact ? formatEur(path.impact.cost_eur) : '—'
    const life = path.impact ? formatYears(path.impact.useful_life_years) : '—'

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
      metrics: [
        { label: 'Cost', value: cost },
        { label: 'Extra life', value: life },
        {
          label: 'Score',
          value: total === null ? '—' : String(Math.round(total)),
          hint: '0–100. Higher is better for your priority.',
        },
      ],
      summary: evidenceNote && !summary.includes(evidenceNote) ? `${summary} ${evidenceNote}` : summary,
      summaryFromAssessment: explanation === null,
      steps: explanation?.next_steps ?? [],
      why: explanation?.why ?? null,
      source: passage
        ? { label: passage.section ? `${passage.title}, ${passage.section}` : passage.title, url: passage.url }
        : null,
      gauge: path.impact ? gaugeValue(path.impact, assessment.baseline) : null,
      co2: co2Of(path.impact),
      changes: [],
    }
  })
}
