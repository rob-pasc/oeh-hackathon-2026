import { CRITERIA, type Assessment } from '@leaaf/shared/assessment'
import type { Mode } from '@leaaf/shared/common'
import { rankPaths } from '@leaaf/shared/ranking'
import { PATH_TITLES } from './labels'

const names = { environment: 'environmental impact', useful_life: 'extra useful life', economic: 'economic value', feasibility: 'feasibility' }

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
      const drivers = CRITERIA.filter(c => (a[c] - b[c]) * (to[c] - from[c]) > 0)
      changes.push(`${PATH_TITLES[ahead.path]} moved above ${PATH_TITLES[behind.path]}. Weight changes favouring this move: ${drivers.map(c => `${names[c]} (${from[c]}% → ${to[c]}%)`).join(', ')}.`)
    }
  }
  return changes
}
