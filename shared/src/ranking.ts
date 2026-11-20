// Deterministic ordering of assessed paths (feature 003 FR-012, FR-013).
// Lives in shared/ so the server and the browser's mode toggle produce the same order.
import { PATHS } from './common.ts'
import { CRITERIA, type CriterionScores, type PathAssessment, type Weights } from './assessment.ts'

/** Weighted sum on a 0–100 scale. */
export function totalScore(scores: CriterionScores, weights: Weights): number {
  return CRITERIA.reduce((sum, c) => sum + (scores[c] * weights[c]) / 100, 0)
}

export interface RankedPath {
  path: PathAssessment
  /** null for not_suitable paths, which never get a score. */
  total: number | null
}

const STATUS_ORDER = { viable: 0, conditional: 1, not_suitable: 2 } as const

/**
 * Viable paths by total score, then conditional paths by score, then not-suitable paths.
 * Ties fall back to the canonical PATHS order so the result never depends on input order.
 */
export function rankPaths(paths: readonly PathAssessment[], weights: Weights): RankedPath[] {
  return paths
    .map((path) => ({
      path,
      total: path.status === 'not_suitable' || path.scores === null ? null : totalScore(path.scores, weights),
    }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.path.status] - STATUS_ORDER[b.path.status] ||
        (b.total ?? 0) - (a.total ?? 0) ||
        PATHS.indexOf(a.path.path) - PATHS.indexOf(b.path.path),
    )
}

/** The path labelled "Recommended": the top viable one, or null if none is viable (feature 004 FR-001). */
export function recommendedPath(ranked: readonly RankedPath[]): RankedPath | null {
  const top = ranked[0]
  return top && top.path.status === 'viable' ? top : null
}
