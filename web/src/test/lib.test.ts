import type { Assessment, Impact } from '@leaaf/shared/assessment'
import type { DeviceScan } from '@leaaf/shared/device'
import type { CategoryResult } from '@leaaf/shared/categories'
import assessmentJson from '@leaaf/fixtures/assessment.example-laptop-14.office.json'
import scanJson from '@leaaf/fixtures/device-scan.laptop-complete.json'
import desktopScanJson from '@leaaf/fixtures/device-scan.desktop-partial.json'
import macScanJson from '@leaaf/fixtures/device-scan.macos-complete.json'
import linuxScanJson from '@leaaf/fixtures/device-scan.linux-complete.json'
import categoriesJson from '@leaaf/fixtures/categories.example-laptop-14.office.json'
import { INTENDED_USES } from '@leaaf/shared/common'
import { describe, expect, it, vi } from 'vitest'
import { liveClient } from '../api/live'
import { USE_TAGS } from '../lib/labels'
import { explainCategoryModeChange, explainModeChange } from '../lib/modeChange'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseRoute } from '../app/router'
import { legalDoc } from '../legal/content'
import { GAUGE, TRACK_PATH, arcPath, needleAngle, polar } from '../lib/gauge'
import { formatAvoided, formatCaused, formatEur, formatYears, gaugeValue } from '../lib/impact'
import { fallbackCategories } from '../api/mockCategories'
import { avoidedHint, buildCategoryViews } from '../lib/categoryView'
import { buildPathViews } from '../lib/pathView'
import { summarizeScan } from '../lib/specs'
import { detectOs } from '../lib/platform'
import { CAR_G_PER_KM, equivalents } from '../lib/equivalents'
import { interpolateText } from '../lib/motion'
import { partsFromScan, upsertPart } from '../lib/parts'

const assessment = assessmentJson as unknown as Assessment
const categories = categoriesJson as unknown as CategoryResult

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
  // Feature 006 FR-049 / AC-059: salvage and recycle credit nothing, so avoided is the negated own emissions.
  const withCo2 = (path: [number, number], avoided: [number, number]) =>
    ({ co2e_kg: { path: { low: path[0], high: path[1] }, baseline: { low: 200, high: 330 }, avoided_vs_baseline: { low: avoided[0], high: avoided[1] } } }) as Impact
  it('shows "None" instead of a negative CO₂e avoided range and names the option’s own CO₂e (AC-059)', () => {
    const recycle = withCo2([0.5, 2], [-2, -0.5])
    expect(formatAvoided(recycle)).toBe('None')
    expect(formatCaused(recycle)).toBe('0.5–2 kg')
    expect(avoidedHint(recycle)).toBe('Nothing is credited against buying a comparable new laptop. This option itself causes about 0.5–2 kg CO₂e.')
    expect(formatAvoided(withCo2([0, 0], [0, 0]))).toBe('None')
  })
  it('keeps kg ranges whenever some CO₂e is avoided (AC-059)', () => {
    const passOn = withCo2([10, 25], [-25, 320])
    expect(formatAvoided(passOn)).toBe('-25–320 kg')
    expect(formatAvoided(withCo2([8, 20], [180, 322]))).toBe('180–322 kg')
    expect(avoidedHint(passOn)).toBe('Compared with buying a comparable new laptop now.')
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
    const views = buildPathViews(assessment, 'environment_first')
    expect(views).toHaveLength(5)
    expect(views.map((v) => v.rank)).toEqual([1, 2, 3, 4, 5])
    expect(views.filter((v) => v.isRecommended)).toHaveLength(1)
    expect(views[0]?.isRecommended).toBe(true)
  })
  it('puts not-suitable paths last and without a score', () => {
    const views = buildPathViews(assessment, 'money_first')
    const order = ['viable', 'conditional', 'not_suitable']
    const statuses = views.map((v) => order.indexOf(v.status))
    expect(statuses).toEqual([...statuses].sort((a, b) => a - b))
    for (const v of views.filter((x) => x.status === 'not_suitable')) expect(v.total).toBeNull()
  })
  it('uses the assessment reasons while the categories are on their way', () => {
    const views = buildPathViews(assessment, 'environment_first')
    expect(views.map((v) => v.summary)).toEqual(views.map((v) => assessment.paths.find((p) => p.path === v.id)!.reasons[0]!.text))
  })
})

describe('category views (feature 008)', () => {
  const views = buildCategoryViews(categories, assessment, 'environment_first')
  const option = (id: string) => views.flatMap((c) => c.options).find((o) => o.id === id)!

  it('ranks the categories with one Recommended label on the first, and no score for Not a fit (AC-006, AC-007)', () => {
    expect(views.map((c) => c.title)).toEqual(['Memory', 'Battery', 'Faster storage', 'Hand it down', 'Graphics'])
    expect(views.map((c) => c.isRecommended)).toEqual([true, false, false, false, false])
    expect(views.at(-1)).toMatchObject({ status: 'not_suitable', statusLabel: 'Not a fit', total: null })
    expect(views.at(-1)!.metrics.at(-1)).toMatchObject({ label: 'Score', value: '—' })
  })

  it('heads each category with its best option’s figures', () => {
    const storage = views.find((c) => c.id === 'faster-storage')!
    expect(storage.best.id).toBe('ssd-swap')
    expect(storage.metrics.slice(0, 3)).toEqual(storage.best.metrics.slice(0, 3))
    expect(storage.options.map((o) => o.status)).toEqual(['viable', 'viable', 'conditional'])
  })

  it('shows cost, extra life, CO₂e avoided and score on an option, and marks AI estimates (AC-010)', () => {
    expect(option('ssd-swap').metrics.map((m) => m.label)).toEqual(['Cost', 'Extra life', 'CO₂e avoided', 'Score'])
    expect(option('ssd-swap').aiEstimate).toBe(false)
    expect(option('clean-install').aiEstimate).toBe(true)
    expect(option('gpu-add').metrics.every((m) => m.value === '—')).toBe(true)
    expect(option('gpu-add').gauge).toBeNull()
  })

  it('links at most two cited sources and has no steps section until feature 009', () => {
    for (const o of views.flatMap((c) => c.options)) {
      expect(o.sources.length).toBeLessThanOrEqual(2)
      expect(o.steps).toBeNull()
    }
    expect(option('ssd-swap').sources).toEqual([{ label: expect.stringContaining('Hardware Maintenance Manual'), url: expect.stringMatching(/^https?:/) }])
  })

  it('turns the five assessed paths into five categories for the mock fallback', () => {
    const fallback = buildCategoryViews(fallbackCategories(assessment), assessment, 'environment_first')
    expect(fallback.map((c) => c.id)).toEqual(buildPathViews(assessment, 'environment_first').map((p) => p.id))
    expect(fallback.map((c) => c.total)).toEqual(buildPathViews(assessment, 'environment_first').map((p) => p.total))
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
        liveClient.streamReport('q3Xk9vT2mB7pLw0cZr1sEa', use, { onAssessment: noop, onCategories: noop, onEnd: noop, onError: noop })()
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

  it('names the categories that swapped places (feature 008, 006 FR-039)', () => {
    const a = assessmentJson as Assessment
    const option = categories.categories[0]!.options[0]!
    const swap: CategoryResult = {
      ...categories,
      categories: [
        { category_id: 'green', label: 'Green', summary: 's', options: [{ ...option, option_id: 'g', scores: { environment: 95, useful_life: 60, economic: 10, feasibility: 60 } }] },
        { category_id: 'cheap', label: 'Cheap', summary: 's', options: [{ ...option, option_id: 'c', scores: { environment: 30, useful_life: 60, economic: 95, feasibility: 60 } }] },
        ...categories.categories.slice(1, 2),
      ],
    }
    expect(explainCategoryModeChange(swap, a, 'environment_first', 'money_first')).toContain('Cheap moved above Green because cost now counts more.')
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
    // Paths are resolved from the web workspace (Vitest's working directory), because under jsdom
    // `import.meta.url` is not a file: URL.
    const indexHtml = readFileSync(resolve('index.html'), 'utf8')
    const indexCss = readFileSync(resolve('src/index.css'), 'utf8')
    expect(indexHtml).not.toMatch(/googleapis|gstatic/)
    const files = [...indexCss.matchAll(/url\('(\/fonts\/[^']+)'\)/g)].map((match) => match[1] as string)
    expect(files.length).toBeGreaterThanOrEqual(5)
    for (const file of files) {
      expect(existsSync(resolve(`public${file}`)), file).toBe(true)
    }
  })
})
