import type { Assessment } from '@leaaf/shared/assessment'
import type { DeviceScan } from '@leaaf/shared/device'
import type { Report } from '@leaaf/shared/report'
import assessmentJson from '@leaaf/fixtures/assessment.example-laptop-14.office.json'
import scanJson from '@leaaf/fixtures/device-scan.laptop-complete.json'
import desktopScanJson from '@leaaf/fixtures/device-scan.desktop-partial.json'
import reportJson from '@leaaf/fixtures/report.example-laptop-14.office.json'
import { describe, expect, it } from 'vitest'
import { parseRoute } from '../app/router'
import { GAUGE, TRACK_PATH, arcPath, needleAngle, polar } from '../lib/gauge'
import { formatEur, formatYears, gaugeValue } from '../lib/impact'
import { buildPathViews } from '../lib/pathView'
import { summarizeScan } from '../lib/specs'

const assessment = assessmentJson as unknown as Assessment
const report = reportJson as unknown as Report

describe('router', () => {
  const id = 'q3Xk9vT2mB7pLw0cZr1sEa'
  it('parses the three screens', () => {
    expect(parseRoute('/')).toEqual({ name: 'landing' })
    expect(parseRoute(`/s/${id}`)).toEqual({ name: 'session', id })
    expect(parseRoute(`/d/${id}/`)).toEqual({ name: 'device', id })
  })
  it('rejects malformed ids and unknown paths', () => {
    expect(parseRoute('/d/short')).toEqual({ name: 'not_found' })
    expect(parseRoute('/x')).toEqual({ name: 'not_found' })
  })
})

describe('gauge geometry', () => {
  it('maps 0, 50 and 100 percent to left, top and right of the half circle', () => {
    expect(polar(0).x).toBeCloseTo(GAUGE.cx - GAUGE.r)
    expect(polar(50).y).toBeCloseTo(GAUGE.cy - GAUGE.r)
    expect(polar(100).x).toBeCloseTo(GAUGE.cx + GAUGE.r)
    expect(polar(0).y).toBeCloseTo(GAUGE.cy)
  })
  it('rotates the needle from -90 to +90 degrees', () => {
    expect(needleAngle(0)).toBe(-90)
    expect(needleAngle(50)).toBe(0)
    expect(needleAngle(100)).toBe(90)
    expect(needleAngle(250)).toBe(90)
  })
  it('skips empty arcs', () => {
    expect(arcPath(40, 40)).toBeNull()
    expect(arcPath(10, 60)).toContain('A')
    expect(TRACK_PATH.startsWith('M')).toBe(true)
  })
})

describe('impact formatting', () => {
  it('formats ranges', () => {
    expect(formatEur({ low: 59.6, high: 120.2 })).toBe('€60–120')
    expect(formatEur({ low: 0, high: 0 })).toBe('€0')
    expect(formatYears({ low: 2, high: 3.04 })).toBe('+2–3 years')
    expect(formatYears({ low: 0, high: 0 })).toBe('No extra life')
  })
  it('keeps every gauge value within 0-100 and ordered', () => {
    for (const path of assessment.paths) {
      if (!path.impact) continue
      const g = gaugeValue(path.impact, assessment.baseline)
      expect(g).not.toBeNull()
      expect(g!.low).toBeGreaterThanOrEqual(0)
      expect(g!.high).toBeLessThanOrEqual(100)
      expect(g!.low).toBeLessThanOrEqual(g!.high)
    }
  })
})

describe('path views', () => {
  it('returns all five paths ranked, with exactly one recommendation first', () => {
    const views = buildPathViews(assessment, report, 'environment_first')
    expect(views).toHaveLength(5)
    expect(views.map((v) => v.rank)).toEqual([1, 2, 3, 4, 5])
    expect(views.filter((v) => v.isRecommended)).toHaveLength(1)
    expect(views[0]?.isRecommended).toBe(true)
  })
  it('puts not-suitable paths last and without a score', () => {
    const views = buildPathViews(assessment, report, 'money_first')
    const order = ['viable', 'conditional', 'not_suitable']
    const statuses = views.map((v) => order.indexOf(v.status))
    expect(statuses).toEqual([...statuses].sort((a, b) => a - b))
    for (const v of views.filter((x) => x.status === 'not_suitable')) expect(v.total).toBeNull()
  })
  it('falls back to assessment reasons until the report arrives', () => {
    const views = buildPathViews(assessment, null, 'environment_first')
    expect(views.every((v) => v.summaryFromAssessment)).toBe(true)
    expect(views.every((v) => v.steps.length === 0)).toBe(true)
  })
})

describe('scan summary', () => {
  it('shows battery health and storage for a complete laptop scan', () => {
    const s = summarizeScan(scanJson as unknown as DeviceScan)
    expect(s.title).toBe('Example Laptop 14')
    expect(s.batteryPercent).toBe(72)
    expect(s.rows.find((r) => r.label === 'Storage')?.value).toContain('HDD')
  })
  it('never invents values for a partial scan', () => {
    const s = summarizeScan(desktopScanJson as unknown as DeviceScan)
    expect(s.rows.some((r) => r.value === 'Unknown')).toBe(true)
  })
})
