import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rankPaths, recommendedPath, totalScore, type Assessment } from '../src/index.ts'

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
