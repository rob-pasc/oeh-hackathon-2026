// Deterministic ordering of assessed paths (feature 003 FR-012, FR-013) and of AI categories and
// their options (feature 008).
// Lives in shared/ so the server and the browser's mode toggle produce the same order.
import { PATHS, type Suitability } from './common.ts'
import { CRITERIA, type CriterionScores, type PathAssessment, type Weights } from './assessment.ts'
import type { Category, CategoryOption } from './categories.ts'

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

// Options and categories (feature 008 FR-006 to FR-008). Same status-then-score rule as the paths.

export interface RankedOption {
  option: CategoryOption
  /** null for not_suitable options and for options whose AI estimate was rejected. */
  total: number | null
}

export interface RankedCategory {
  category: Category
  /** The best status among the category's options. */
  status: Suitability
  /** Highest total among the options with that status; null when the category has no fitting option. */
  total: number | null
  /** The category's options in their ranked order; the first is the category's best option. */
  options: RankedOption[]
}

const byStatusThenScore = <T extends { total: number | null }>(status: (item: T) => Suitability) =>
  (a: { item: T; index: number }, b: { item: T; index: number }) =>
    STATUS_ORDER[status(a.item)] - STATUS_ORDER[status(b.item)] ||
    // Unscored options of a fitting status sort after scored ones of the same status.
    (b.item.total ?? -1) - (a.item.total ?? -1) ||
    a.index - b.index

/** Good fit options by score, then Depends by score, then Not a fit; ties keep the input order. */
export function rankOptions(options: readonly CategoryOption[], weights: Weights): RankedOption[] {
  return options
    .map((option, index) => ({
      item: {
        option,
        total: option.status === 'not_suitable' || option.scores === null ? null : totalScore(option.scores, weights),
      },
      index,
    }))
    .sort(byStatusThenScore((r) => r.option.status))
    .map(({ item }) => item)
}

/**
 * Categories with a Good fit option by score, then those whose best option depends, then those
 * with no fitting option, which carry no score (FR-006). Ties keep the input order.
 */
export function rankCategories(categories: readonly Category[], weights: Weights): RankedCategory[] {
  return categories
    .map((category, index) => {
      const options = rankOptions(category.options, weights)
      const best = options[0]!
      const status = best.option.status
      return { item: { category, status, total: status === 'not_suitable' ? null : best.total, options }, index }
    })
    .sort(byStatusThenScore((r) => r.status))
    .map(({ item }) => item)
}

/** The category labelled "Recommended": the first one, if it has a Good fit option (FR-007). */
export function recommendedCategory(ranked: readonly RankedCategory[]): RankedCategory | null {
  const top = ranked[0]
  return top && top.status === 'viable' ? top : null
}
