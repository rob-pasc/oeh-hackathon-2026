// The five-path fallback (feature 008 FR-013): when the category call cannot be made or fails, each
// assessed path becomes one category with one option, carrying the assessment's own statuses,
// figures and scores and the template text of feature 004 FR-009.
import type { Category, CategoryOption, CategoryResult, Difficulty, OptionKind, Path, PathAssessment } from '@leaaf/shared'
import type { DeviceAssessment } from '../assessment/service.ts'
import { templateReport } from '../report/template.ts'

export const FALLBACK_NOTICE = 'AI explanation unavailable. These options use the device assessment.'

const LABEL: Record<Path, string> = {
  upgrade: 'Upgrade',
  repair: 'Repair',
  pass_on: 'Pass it on',
  salvage: 'Salvage for parts',
  recycle: 'Recycle',
}

/** The nearest option kind; `upgrade` may combine an SSD and RAM, so it is `other`. */
const KIND: Record<Path, OptionKind> = {
  upgrade: 'other',
  repair: 'battery',
  pass_on: 'hand_down',
  salvage: 'salvage',
  recycle: 'recycle',
}

function difficulty(path: PathAssessment): Difficulty {
  switch (path.path) {
    case 'upgrade':
    case 'salvage':
      return 'diy_moderate'
    case 'repair':
      // The gates name professional repairs explicitly; any other battery job still opens the device.
      return path.reasons.some((r) => r.code === 'professional_repair') ? 'professional' : 'diy_moderate'
    case 'pass_on':
    case 'recycle':
      return 'diy_easy'
  }
}

export function fallbackCategories(input: DeviceAssessment): CategoryResult {
  const { assessment } = input
  const report = templateReport(input)
  const cited = new Set<string>()
  const categories: Category[] = assessment.paths.map((path) => {
    const text = report.paths.find((p) => p.path === path.path)!
    const claims = text.claims.slice(0, 2)
    for (const claim of claims) for (const id of claim.passage_ids) cited.add(id)
    const fitting = path.status !== 'not_suitable' && path.impact !== null && path.scores !== null
    const option: CategoryOption = {
      option_id: path.path,
      title: LABEL[path.path],
      status: path.status,
      reason: path.reasons[0]!.text,
      kind: KIND[path.path],
      difficulty: difficulty(path),
      why: text.why,
      claims,
      impact: fitting ? path.impact : null,
      impact_source: fitting ? 'calculator' : null,
      scores: fitting ? path.scores : null,
      confidence: path.confidence,
      path: path.path,
    }
    return { category_id: path.path, label: LABEL[path.path], summary: text.summary, options: [option] }
  })
  return {
    device_id: assessment.device_id,
    intended_use: assessment.intended_use,
    generated_at: assessment.created_at,
    source: 'template',
    notice: FALLBACK_NOTICE,
    categories,
    passages: report.passages.filter((p) => cited.has(p.passage_id)),
  }
}
