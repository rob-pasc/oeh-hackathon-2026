import type { Assessment } from '@leaaf/shared/assessment'
import type { DeviceScan } from '@leaaf/shared/device'
import type { Report } from '@leaaf/shared/report'
import assessmentJson from '@leaaf/fixtures/assessment.example-laptop-14.office.json'
import scanJson from '@leaaf/fixtures/device-scan.laptop-complete.json'
import desktopScanJson from '@leaaf/fixtures/device-scan.desktop-partial.json'
import macScanJson from '@leaaf/fixtures/device-scan.macos-complete.json'
import linuxScanJson from '@leaaf/fixtures/device-scan.linux-complete.json'
import reportJson from '@leaaf/fixtures/report.example-laptop-14.office.json'
import { INTENDED_USES } from '@leaaf/shared/common'
import { describe, expect, it, vi } from 'vitest'
import { liveClient } from '../api/live'
import { USE_TAGS } from '../lib/labels'
import { explainModeChange } from '../lib/modeChange'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseRoute } from '../app/router'
import { legalDoc } from '../legal/content'
import { GAUGE, TRACK_PATH, arcPath, needleAngle, polar } from '../lib/gauge'
import { formatEur, formatYears, gaugeValue } from '../lib/impact'
import { LAPTOP_OPTIONS } from '../api/mockOptions'
import { buildOptionViews } from '../lib/optionView'
import { buildPathViews } from '../lib/pathView'
import { summarizeScan } from '../lib/specs'
import { detectOs } from '../lib/platform'
import { CAR_G_PER_KM, equivalents } from '../lib/equivalents'
import { interpolateText } from '../lib/motion'
import { partsFromScan, upsertPart } from '../lib/parts'

const assessment = assessmentJson as unknown as Assessment
const report = reportJson as unknown as Report

describe('router', () => {
  const id = 'q3Xk9vT2mB7pLw0cZr1sEa'
  const session = '0123456789ABCDEFGHJKMNPQRS'
  it('parses the three screens', () => {
    expect(parseRoute('/')).toEqual({ name: 'landing' })
    expect(parseRoute(`/s/${session}`)).toEqual({ name: 'session', id: session })
    expect(parseRoute(`/d/${id}/`)).toEqual({ name: 'device', id })
  })
  it('rejects malformed ids and unknown paths', () => {
    expect(parseRoute('/d/short')).toEqual({ name: 'not_found', device: true })
    // Each route accepts only its own ID format.
    expect(parseRoute(`/s/${id}`)).toEqual({ name: 'not_found' })
    expect(parseRoute(`/d/${session}`)).toEqual({ name: 'not_found', device: true })
    expect(parseRoute('/s/0123456789ABCDEFGHJKMNPQRI')).toEqual({ name: 'not_found' })
    expect(parseRoute('/x')).toEqual({ name: 'not_found' })
    expect(parseRoute('/imprint')).toEqual({ name: 'imprint' })
    expect(parseRoute('/impressum/')).toEqual({ name: 'imprint' })
    expect(parseRoute('/privacy')).toEqual({ name: 'privacy' })
    expect(parseRoute('/datenschutz')).toEqual({ name: 'privacy' })
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
  it('never sets the large-arc flag, because the scale is a half circle', () => {
    for (const [low, high] of [[0, 95], [0, 100], [10, 60], [65, 100], [0, 64], [0, 1]] as const) {
      const d = arcPath(low, high)
      expect(d).not.toBeNull()
      expect(d!).toContain(`A${GAUGE.r} ${GAUGE.r} 0 0 1 `)
    }
  })
  it('keeps arc end points on the gauge circle', () => {
    for (const pct of [0, 25, 64, 95, 100]) {
      const { x, y } = polar(pct)
      expect(Math.hypot(x - GAUGE.cx, y - GAUGE.cy)).toBeCloseTo(GAUGE.r)
    }
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

describe('option views', () => {
  const upgrade = buildOptionViews(
    LAPTOP_OPTIONS.filter((o) => o.path === 'upgrade'),
    assessment.baseline,
  )
  it('lists the single upgrades, suitable ones first and not-suitable ones last', () => {
    expect(upgrade.map((o) => o.key)).toEqual(['upgrade:ssd', 'upgrade:ram', 'upgrade:cpu', 'upgrade:gpu'])
    expect(upgrade.map((o) => o.status)).toEqual(['viable', 'viable', 'not_suitable', 'not_suitable'])
  })
  it('gives each suitable option its own CO2e figures and gauge value', () => {
    const [ssd, ram] = upgrade
    expect(ssd!.metrics.map((m) => m.label)).toEqual(['Cost', 'Extra life', 'CO₂e added'])
    expect(ssd!.metrics[2]!.value).toBe('+5–12 kg')
    expect(ssd!.gauge!.mid).toBeGreaterThan(ram!.gauge!.mid)
    for (const o of upgrade.slice(0, 2)) {
      expect(o.gauge!.mid).toBeGreaterThanOrEqual(0)
      expect(o.gauge!.mid).toBeLessThanOrEqual(100)
    }
  })
  it('shows no invented figures for options that are not suitable', () => {
    for (const o of upgrade.slice(2)) {
      expect(o.gauge).toBeNull()
      expect(o.metrics.every((m) => m.value === '—')).toBe(true)
    }
  })
  it('keeps every path covered by at least one option in the sample data', () => {
    for (const path of ['upgrade', 'repair', 'pass_on', 'salvage', 'recycle']) {
      expect(LAPTOP_OPTIONS.some((o) => o.path === path)).toBe(true)
    }
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
  it('says a Mac has no TPM to report instead of "Unknown" (feature 007 FR-019)', () => {
    const chip = (scan: unknown) => summarizeScan(scan as DeviceScan).rows.find((r) => r.label === 'Security chip')?.value
    expect(chip(macScanJson)).toBe('Not applicable')
    expect(chip(linuxScanJson)).toBe('TPM 2.0')
    expect(chip(scanJson)).toBe('TPM 2.0')
    expect(chip({ ...desktopScanJson, tpm: { present: null, spec_version: null } })).toBe('Unknown')
    expect(chip({ ...desktopScanJson, tpm: { present: false, spec_version: null } })).toBe('No TPM')
  })
})

describe('system detection (feature 007 FR-013)', () => {
  const cases: [string, Parameters<typeof detectOs>[0], ReturnType<typeof detectOs>][] = [
    ['Chrome on Windows', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0', userAgentData: { platform: 'Windows' } }, 'windows'],
    ['Firefox on Windows', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0' }, 'windows'],
    ['Safari on a Mac', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15', maxTouchPoints: 0 }, 'macos'],
    ['Chrome on a Mac', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', userAgentData: { platform: 'macOS' } }, 'macos'],
    ['Firefox on Linux', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0' }, 'linux'],
    ['Chrome on Linux', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0', userAgentData: { platform: 'Linux' } }, 'linux'],
    ['an iPad asking for the desktop site', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 5 }, null],
    ['an Android phone', { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131.0 Mobile' }, null],
    ['Chrome on Android with client hints', { userAgent: 'Mozilla/5.0 (Linux; Android 14)', userAgentData: { platform: 'Android' } }, null],
    ['a Chromebook', { userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 15917.71.0) Chrome/131.0' }, null],
    ['an iPhone', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)' }, null],
  ]
  it.each(cases)('%s', (_name, nav, expected) => {
    expect(detectOs(nav)).toBe(expected)
  })
})

describe('live session client', () => {
  it('asks for the scanner of the given system', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ session_id: 'S', download_url: '/x' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await liveClient.createScanSession('linux')
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({ method: 'POST', body: JSON.stringify({ os: 'linux' }) }))
    vi.unstubAllGlobals()
  })
})

describe('counting numbers', () => {
  it('moves each number of the text toward its target', () => {
    expect(interpolateText('€40–70', '€60–90', 0.5)).toBe('€50–80')
    expect(interpolateText('€40–70', '€60–90', 1)).toBe('€60–90')
  })

  it('starts from zero when the texts differ in shape, and keeps decimals and grouping', () => {
    expect(interpolateText('', '+1.5–2.5 years', 0)).toBe('+0.0–0.0 years')
    expect(interpolateText('No extra life', '1,320 km', 1)).toBe('1,320 km')
    expect(interpolateText('x', 'No extra life', 0.3)).toBe('No extra life')
  })
})

describe('CO₂e equivalents', () => {
  it('turns the avoided range into car kilometres and flights', () => {
    const [car, flight] = equivalents({ low: 180, high: 342 })!
    expect(car!.amount).toBe('1,300–2,500 km')
    expect(Math.round(180000 / CAR_G_PER_KM)).toBe(1317)
    expect(flight!.amount).toBe('0.6–1.2')
    expect(flight!.label).toBe('flights Vienna → London')
  })

  it('says "up to" for ranges that start at zero and returns nothing when nothing is avoided', () => {
    expect(equivalents({ low: 0, high: 260 })![0]!.amount).toBe('up to 1,900 km')
    expect(equivalents({ low: 0, high: 0 })).toBeNull()
  })
})

describe('detected parts', () => {
  it('lists the parts of a scan with the lookup pending', () => {
    const parts = partsFromScan(scanJson as unknown as DeviceScan)
    expect(parts.map((p) => p.part_id)).toEqual(['cpu', 'memory', 'gpu-0', 'storage-0', 'battery'])
    expect(parts.every((p) => p.lookup === 'pending')).toBe(true)
    expect(parts.find((p) => p.part_id === 'memory')!.value).toBe('8 GB DDR4 · 1/2 slots')
  })

  it('replaces a part in place when its lookup finishes', () => {
    const parts = partsFromScan(scanJson as unknown as DeviceScan)
    const updated = upsertPart(parts, { ...parts[0]!, lookup: 'catalog', detail: 'Soldered.' })
    expect(updated).toHaveLength(parts.length)
    expect(updated[0]!.lookup).toBe('catalog')
  })
})

describe('use tags in live mode (feature 003 AC-020)', () => {
  it('offers exactly the contract intended uses', () => {
    expect([...USE_TAGS].sort()).toEqual([...INTENDED_USES].sort())
  })

  it('requests the report stream with each tag unchanged', () => {
    const urls: string[] = []
    class FakeEventSource {
      constructor(url: string) {
        urls.push(url)
      }
      addEventListener() {}
      close() {}
    }
    vi.stubGlobal('EventSource', FakeEventSource)
    try {
      const noop = () => {}
      for (const use of USE_TAGS)
        liveClient.streamReport('q3Xk9vT2mB7pLw0cZr1sEa', use, { onAssessment: noop, onReport: noop, onEnd: noop, onError: noop })()
    } finally {
      vi.unstubAllGlobals()
    }
    expect(urls).toEqual(USE_TAGS.map((use) => `/api/devices/q3Xk9vT2mB7pLw0cZr1sEa/report?intended_use=${use}`))
  })
})

describe('mode change explanations', () => {
  it('explains reversals using the changed weighted score differences', () => {
    const a = assessmentJson as Assessment
    const changes = explainModeChange(a, 'environment_first', 'money_first')
    expect(changes.join(' ')).toContain('because cost now counts more')
    expect(changes.join(' ')).toContain('moved above')
    const unchanged = { ...a, weights: { ...a.weights, money_first: a.weights.environment_first } }
    expect(explainModeChange(unchanged, 'environment_first', 'money_first')).toEqual([])
  })
})

describe('legal texts and fonts (feature 006 FR-046)', () => {
  it('keeps the German and English texts in step', () => {
    for (const kind of ['imprint', 'privacy'] as const) {
      const de = legalDoc(kind, 'de').blocks
      const en = legalDoc(kind, 'en').blocks
      expect(de.map((block) => block.type)).toEqual(en.map((block) => block.type))
    }
  })

  it('formats the date of the last change per language', () => {
    expect(legalDoc('privacy', 'en').updated).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/)
    expect(legalDoc('privacy', 'de').updated).toMatch(/^\d{1,2}\. \p{L}+ \d{4}$/u)
  })

  it('self-hosts Inter: no font provider in index.html and every @font-face file exists', () => {
    // Read as plain files: with `css: false` Vitest would return an empty string for an imported .css file.
    const indexHtml = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8')
    const indexCss = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8')
    expect(indexHtml).not.toMatch(/googleapis|gstatic/)
    const files = [...indexCss.matchAll(/url\('(\/fonts\/[^']+)'\)/g)].map((match) => match[1] as string)
    expect(files.length).toBeGreaterThanOrEqual(5)
    for (const file of files) {
      expect(existsSync(fileURLToPath(new URL(`../../public${file}`, import.meta.url))), file).toBe(true)
    }
  })
})
