import { CRITERIA, type Assessment, type CriterionScores, type Weights } from '@leaaf/shared/assessment'
import type { CategoryResult } from '@leaaf/shared/categories'
import type { Mode } from '@leaaf/shared/common'
import { rankCategories, rankPaths } from '@leaaf/shared/ranking'
import { PATH_TITLES } from './labels'

// How each criterion is named in the one-line explanation.
const names = { environment: 'environmental impact', useful_life: 'extra life', economic: 'cost', feasibility: 'feasibility' }

interface Ranked {
  id: string
  title: string
  scores: CriterionScores | null
}

/**
 * One short line per pair that swapped places after a priority change, e.g. "Repair moved above
 * Upgrade because cost now counts more." Only criteria that gained weight and in which the item that
 * moved up is ahead are named; the exact weights stay in the payload (feature 006 FR-039).
 */
function explainSwaps(oldOrder: readonly string[], ranked: readonly Ranked[], from: Weights, to: Weights): string[] {
  const changes: string[] = []
  for (const [i, ahead] of ranked.entries()) {
    for (const behind of ranked.slice(i + 1)) {
      if (oldOrder.indexOf(ahead.id) < oldOrder.indexOf(behind.id) || !ahead.scores || !behind.scores) continue
      const a = ahead.scores
      const b = behind.scores
      const drivers = CRITERIA.filter(c => to[c] > from[c] && a[c] > b[c]).map(c => names[c])
      const reason = drivers.length > 0 ? `${drivers.join(' and ')} now ${drivers.length > 1 ? 'count' : 'counts'} more` : 'the priorities changed'
      changes.push(`${ahead.title} moved above ${behind.title} because ${reason}.`)
    }
  }
  return changes
}

/** The five assessed paths, shown while the categories are on their way. */
export function explainModeChange(assessment: Assessment, previous: Mode, current: Mode): string[] {
  const from = assessment.weights[previous]
  const to = assessment.weights[current]
  const oldOrder = rankPaths(assessment.paths, from).map(item => item.path.path)
  const ranked = rankPaths(assessment.paths, to).map(({ path }) => ({ id: path.path, title: PATH_TITLES[path.path], scores: path.scores }))
  return explainSwaps(oldOrder, ranked, from, to)
}

/** The same for categories (feature 008), using each category's best option in the new mode. */
export function explainCategoryModeChange(result: CategoryResult, assessment: Assessment, previous: Mode, current: Mode): string[] {
  const from = assessment.weights[previous]
  const to = assessment.weights[current]
  const oldOrder = rankCategories(result.categories, from).map(r => r.category.category_id)
  const ranked = rankCategories(result.categories, to).map(r => ({
    id: r.category.category_id,
    title: r.category.label,
    scores: r.status === 'not_suitable' ? null : r.options[0]!.option.scores,
  }))
  return explainSwaps(oldOrder, ranked, from, to)
}
