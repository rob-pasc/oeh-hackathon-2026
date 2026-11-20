// Turns the server payloads (Assessment, Report) into what the result screen renders.
// Ordering comes from shared/src/ranking.ts so the browser and the server agree (feature 003 FR-012).
import type { Assessment, Impact } from '@leaaf/shared/assessment'
import type { ConfidenceLevel, Mode, Path, Suitability } from '@leaaf/shared/common'
import { rankPaths, recommendedPath } from '@leaaf/shared/ranking'
import type { Report } from '@leaaf/shared/report'
import { formatAvoided, formatEur, formatSavings, formatYears, gaugeValue, type GaugeValue } from './impact'
import { PATH_TITLES, STATUS_LABELS } from './labels'

export interface SourceRef {
  label: string
  url: string
}

export interface PathView {
  id: Path
  rank: number
  title: string
  status: Suitability
  statusLabel: string
  /** Weighted score for the active mode; null for not-suitable paths. */
  total: number | null
  isRecommended: boolean
  cost: string
  life: string
  avoided: string
  savings: string
  /** One-sentence reason: the explanation's summary once the report arrived, else the first assessment reason. */
  summary: string
  /** True while `summary` still comes from the assessment because the report has not arrived. */
  summaryFromAssessment: boolean
  steps: string[]
  why: string | null
  source: SourceRef | null
  /** What could not be verified (feature 004 FR-007). */
  notes: string[]
  gauge: GaugeValue | null
  confidence: ConfidenceLevel
  impact: Impact | null
}

export function buildPathViews(assessment: Assessment, report: Report | null, mode: Mode): PathView[] {
  const ranked = rankPaths(assessment.paths, assessment.weights[mode])
  const recommended = recommendedPath(ranked)

  return ranked.map(({ path, total }, index) => {
    const explanation = report?.paths.find((p) => p.path === path.path) ?? null
    const firstReason = path.reasons[0]?.text ?? ''
    const passageId = explanation?.claims[0]?.passage_ids[0]
    const passage = passageId ? (report?.passages.find((p) => p.passage_id === passageId) ?? null) : null

    return {
      id: path.path,
      rank: index + 1,
      title: PATH_TITLES[path.path],
      status: path.status,
      statusLabel: STATUS_LABELS[path.status],
      total,
      isRecommended: recommended !== null && recommended.path.path === path.path,
      cost: path.impact ? formatEur(path.impact.cost_eur) : '—',
      life: path.impact ? formatYears(path.impact.useful_life_years) : '—',
      avoided: path.impact ? formatAvoided(path.impact) : 'No figures for this path',
      savings: path.impact ? formatSavings(path.impact, assessment.baseline) : '—',
      summary: explanation?.summary ?? firstReason,
      summaryFromAssessment: explanation === null,
      steps: explanation?.next_steps ?? [],
      why: explanation?.why ?? null,
      source: passage
        ? { label: passage.section ? `${passage.title}, ${passage.section}` : passage.title, url: passage.url }
        : null,
      notes: explanation?.unverified ?? [],
      gauge: path.impact ? gaugeValue(path.impact, assessment.baseline) : null,
      confidence: path.confidence.level,
      impact: path.impact,
    }
  })
}
