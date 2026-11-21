import { CRITERIA, type Assessment } from '@leaaf/shared/assessment'
import type { Mode } from '@leaaf/shared/common'
import { rankPaths } from '@leaaf/shared/ranking'
import { PATH_TITLES } from './labels'

// How each criterion is named in the one-line explanation.
const names = { environment: 'environmental impact', useful_life: 'extra life', economic: 'cost', feasibility: 'feasibility' }

/**
 * One short line per pair of paths that swapped places after a priority change, e.g.
 * "Repair moved above Upgrade because cost now counts more." Only criteria that gained weight and in which the
 * path that moved up is ahead are named; the exact weights stay in the assessment.
 */
export function explainModeChange(assessment: Assessment, previous: Mode, current: Mode): string[] {
  const from = assessment.weights[previous]
  const to = assessment.weights[current]
  const oldOrder = rankPaths(assessment.paths, from).map(item => item.path.path)
  const ranked = rankPaths(assessment.paths, to)
  const changes: string[] = []
  for (const [i, { path: ahead }] of ranked.entries()) {
    for (const { path: behind } of ranked.slice(i + 1)) {
      if (oldOrder.indexOf(ahead.path) < oldOrder.indexOf(behind.path) || !ahead.scores || !behind.scores) continue
      const a = ahead.scores
      const b = behind.scores
      const drivers = CRITERIA.filter(c => to[c] > from[c] && a[c] > b[c]).map(c => names[c])
      const reason = drivers.length > 0 ? `${drivers.join(' and ')} now ${drivers.length > 1 ? 'count' : 'counts'} more` : 'the priorities changed'
      changes.push(`${PATH_TITLES[ahead.path]} moved above ${PATH_TITLES[behind.path]} because ${reason}.`)
    }
  }
  return changes
}
