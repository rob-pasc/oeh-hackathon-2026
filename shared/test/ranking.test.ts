import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  rankCategories,
  rankOptions,
  rankPaths,
  recommendedCategory,
  recommendedPath,
  totalScore,
  type Assessment,
  type Category,
  type CategoryOption,
  type CategoryResult,
} from '../src/index.ts'

const fixture = (name: string): Assessment =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')) as Assessment

const order = (a: Assessment, mode: keyof Assessment['weights']) =>
  rankPaths(a.paths, a.weights[mode]).map((r) => r.path.path)

describe('totalScore', () => {
  it('is the weighted sum on a 0-100 scale', () => {
    const scores = { environment: 85, useful_life: 80, economic: 75, feasibility: 80 }
    expect(totalScore(scores, { environment: 45, useful_life: 25, economic: 10, feasibility: 20 })).toBeCloseTo(81.75)
  })
})

describe('rankPaths', () => {
  const laptop = fixture('assessment.example-laptop-14.office.json')
  const desktop = fixture('assessment.example-desktop-unknown.development.json')

  it('orders viable paths by score, then conditional ones', () => {
    expect(order(laptop, 'environment_first')).toEqual(['upgrade', 'repair', 'pass_on', 'recycle', 'salvage'])
  })

  it('reorders when the mode changes (feature 003 FR-013)', () => {
    expect(order(laptop, 'money_first')).toEqual(['pass_on', 'upgrade', 'repair', 'recycle', 'salvage'])
  })

  it('puts not_suitable paths last and without a score', () => {
    const ranked = rankPaths(desktop.paths, desktop.weights.environment_first)
    expect(ranked.map((r) => r.path.status)).toEqual(['viable', 'viable', 'conditional', 'conditional', 'not_suitable'])
    expect(ranked.at(-1)).toMatchObject({ total: null, path: { path: 'pass_on' } })
  })

  it('does not depend on input order', () => {
    const reversed = [...laptop.paths].reverse()
    expect(rankPaths(reversed, laptop.weights.environment_first).map((r) => r.path.path)).toEqual(
      order(laptop, 'environment_first'),
    )
  })
})

describe('recommendedPath', () => {
  it('is the top viable path', () => {
    const a = fixture('assessment.example-laptop-14.office.json')
    expect(recommendedPath(rankPaths(a.paths, a.weights.environment_first))?.path.path).toBe('upgrade')
  })

  it('is null when no path is viable (feature 004 FR-001)', () => {
    const a = fixture('assessment.example-desktop-unknown.development.json')
    const noneViable = a.paths.map((p) => (p.status === 'viable' ? { ...p, status: 'conditional' as const } : p))
    expect(recommendedPath(rankPaths(noneViable, a.weights.environment_first))).toBeNull()
  })
})

describe('rankCategories and rankOptions (feature 008)', () => {
  const result = JSON.parse(
    readFileSync(new URL('../fixtures/categories.example-laptop-14.office.json', import.meta.url), 'utf8'),
  ) as CategoryResult
  const weights = fixture('assessment.example-laptop-14.office.json').weights
  const scores = (e: number, l: number, c: number, f: number) => ({ environment: e, useful_life: l, economic: c, feasibility: f })
  const opt = (id: string, status: CategoryOption['status'], s: CategoryOption['scores']): CategoryOption => ({
    ...result.categories[0]!.options[0]!,
    option_id: id,
    status,
    scores: s,
    ...(status === 'not_suitable' ? { impact: null, impact_source: null } : {}),
  })
  const cat = (id: string, options: CategoryOption[]): Category => ({ category_id: id, label: id, summary: 's', options })

  it('lists Good fit categories by score, then Depends, then Not a fit without a score (AC-006)', () => {
    const categories = [
      cat('none', [opt('n', 'not_suitable', null)]),
      cat('depends', [opt('d', 'conditional', scores(90, 90, 90, 90))]),
      cat('low', [opt('l', 'viable', scores(10, 10, 10, 10))]),
      cat('high', [opt('h1', 'conditional', scores(99, 99, 99, 99)), opt('h2', 'viable', scores(60, 60, 60, 60))]),
    ]
    const ranked = rankCategories(categories, weights.environment_first)
    expect(ranked.map((r) => r.category.category_id)).toEqual(['high', 'low', 'depends', 'none'])
    expect(ranked.map((r) => r.status)).toEqual(['viable', 'viable', 'conditional', 'not_suitable'])
    // A category's score is its best option of its best status, not its highest score overall.
    expect(ranked[0]!.total).toBeCloseTo(60)
    expect(ranked[0]!.options.map((o) => o.option.option_id)).toEqual(['h2', 'h1'])
    expect(ranked.at(-1)!.total).toBeNull()
  })

  it('orders the options inside a category Good fit, Depends, Not a fit, by score within each', () => {
    const ranked = rankOptions(
      [opt('x', 'not_suitable', null), opt('a', 'conditional', scores(50, 50, 50, 50)), opt('b', 'viable', scores(20, 20, 20, 20)), opt('c', 'viable', scores(40, 40, 40, 40)), opt('u', 'viable', null)],
      weights.environment_first,
    )
    expect(ranked.map((r) => r.option.option_id)).toEqual(['c', 'b', 'u', 'a', 'x'])
  })

  it('re-ranks categories and options with the other mode’s weights (AC-008)', () => {
    const green = opt('green', 'viable', scores(95, 60, 10, 60))
    const cheap = opt('cheap', 'viable', scores(30, 60, 95, 60))
    const categories = [cat('green', [green]), cat('cheap', [cheap]), cat('both', [green, cheap])]
    const order = (mode: keyof typeof weights) => rankCategories(categories, weights[mode])
    expect(order('environment_first').map((r) => r.category.category_id)).toEqual(['green', 'both', 'cheap'])
    expect(order('money_first').map((r) => r.category.category_id)).toEqual(['cheap', 'both', 'green'])
    expect(order('environment_first')[1]!.options.map((o) => o.option.option_id)).toEqual(['green', 'cheap'])
    expect(order('money_first')[1]!.options.map((o) => o.option.option_id)).toEqual(['cheap', 'green'])
  })

  it('ranks the example categories with the Not a fit category last', () => {
    for (const mode of ['environment_first', 'money_first'] as const)
      expect(rankCategories(result.categories, weights[mode]).map((r) => r.category.category_id)).toEqual(['memory', 'battery', 'faster-storage', 'hand-down', 'graphics'])
  })

  it('labels the first category Recommended only when it has a Good fit option (AC-007)', () => {
    expect(recommendedCategory(rankCategories(result.categories, weights.environment_first))?.category.category_id).toBe('memory')
    const noneFit = result.categories.map((c) => ({ ...c, options: c.options.map((o) => (o.status === 'viable' ? { ...o, status: 'conditional' as const } : o)) }))
    expect(recommendedCategory(rankCategories(noneFit, weights.environment_first))).toBeNull()
  })
})
