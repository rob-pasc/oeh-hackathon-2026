import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Assessment } from '@leaaf/shared/assessment'
import type { Report } from '@leaaf/shared/report'
import { formatEur, formatYears } from '../lib/impact'
import fixture from '@leaaf/fixtures/assessment.example-laptop-14.office.json'
import sampleReport from '@leaaf/fixtures/report.example-laptop-14.office.json'
import { rankPaths } from '@leaaf/shared/ranking'
import { ApiContext } from '../api'
import { App } from '../app/App'
import { createMockClient, MOCK_DEVICE_IDS } from '../api/mock'
import { Footer } from '../components/Footer'
import { Inline } from '../pages/Legal'
import { ReportDetails } from '../components/ReportDetails'
import { ResultsView } from '../components/ResultsView'
import { SpecsCard } from '../components/SpecsCard'
import type { DeviceScan } from '@leaaf/shared/device'
import type { ApiClient, ScanSessionEvent } from '../api/types'
import laptopScanJson from '@leaaf/fixtures/device-scan.laptop-complete.json'
import { PATH_TITLES } from '../lib/labels'
import { Landing } from '../pages/Landing'
import { ScanSession } from '../pages/ScanSession'

const fast = createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 5 })

function withApi(ui: React.ReactElement) {
  return <ApiContext.Provider value={fast}>{ui}</ApiContext.Provider>
}

describe('Landing', () => {
  it('shows the three steps and the Download and Scan now button', () => {
    render(withApi(<Landing />))
    expect(screen.getByRole('button', { name: /download and scan now/i })).toBeInTheDocument()
    for (const title of ['Scan Device', 'AI Analysis', 'Save CO₂ & Money']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('discloses scan data, exclusions and upload before download', async () => {
    render(withApi(<Landing />))
    await userEvent.click(screen.getByText('What does the scanner collect?'))
    expect(screen.getByText(/Windows asks for administrator access/)).toHaveTextContent(/device model.*processor.*battery health.*Secure Boot/)
    expect(screen.getByText(/uploads it to leaaf/)).toHaveTextContent(/personal files.*serial numbers.*network addresses/)
  })

  it('shows what the name stands for, with the initials spelling leaaf', () => {
    render(withApi(<Landing />))
    const first = screen.getByText('L', { selector: 'span' })
    const line = first.parentElement as HTMLElement
    expect(line).toHaveTextContent('Lifecycle Evaluation and Action Finder')
    // The line is uppercased by CSS, so the second a (from "and") is lowercase in the text.
    expect(Array.from(line.children).map((c) => c.textContent).join('').toUpperCase()).toBe('LEAAF')
    // The footer no longer repeats the name (FR-035, revised 2026-11-21).
    expect(screen.getByRole('contentinfo')).not.toHaveTextContent('Lifecycle Evaluation')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Questions? contact@leaaf.green')
  })

  it('shows the contact address as a mailto link', () => {
    render(withApi(<Landing />))
    expect(screen.getByRole('link', { name: 'contact@leaaf.green' })).toHaveAttribute('href', 'mailto:contact@leaaf.green')
  })

  it('opens a new tab on the session route when Scan now is clicked', async () => {
    const tab = { location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    render(withApi(<Landing />))
    await userEvent.click(screen.getByRole('button', { name: /download and scan now/i }))
    await waitFor(() => expect(tab.location.href).toMatch(/^\/s\/[0-9A-HJKMNP-TV-Z]{26}$/))
    expect(open).toHaveBeenCalledWith('', '_blank')
    open.mockRestore()
  })
})

describe('ScanSession', () => {
  it('shows the skeleton and a live status, then switches to the device route', async () => {
    window.history.pushState(null, '', '/s/aaaaaaaaaaaaaaaaaaaaaa')
    render(withApi(<ScanSession sessionId="aaaaaaaaaaaaaaaaaaaaaa" />))
    expect(screen.getByTestId('result-skeleton')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe(`/d/${MOCK_DEVICE_IDS.laptop}`))
  })

  it('lists the parts the scanner finds and shows the laptop view unless it is hidden', async () => {
    window.localStorage.clear()
    const slow = createMockClient({ stepMs: 200 })
    window.history.pushState(null, '', '/s/CCCCCCCCCCCCCCCCCCCCCCCCCC')
    render(
      <ApiContext.Provider value={slow}>
        <ScanSession sessionId="CCCCCCCCCCCCCCCCCCCCCCCCCC" />
      </ApiContext.Provider>,
    )
    const card = screen.getByRole('region', { name: 'Found in your device' })
    expect(within(card).getByRole('img', { name: /Laptop view/ })).toBeInTheDocument()
    expect(await within(card).findByText('Processor')).toBeInTheDocument()
    expect(await within(card).findByText('Matched')).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Hide laptop view' }))
    expect(within(card).queryByRole('img', { name: /Laptop view/ })).toBeNull()
    window.localStorage.clear()
  })

  // AC-043, AC-044 (FR-041). Tests run without motion, so the page shows the events unpaced.
  function renderWithSteps(events: ScanSessionEvent[]) {
    window.localStorage.clear()
    const client: ApiClient = {
      ...fast,
      subscribeScanSession: (_id, onEvent) => {
        events.forEach((event) => onEvent(event))
        return () => {}
      },
    }
    render(
      <ApiContext.Provider value={client}>
        <ScanSession sessionId="DDDDDDDDDDDDDDDDDDDDDDDDDD" />
      </ApiContext.Provider>,
    )
    const view = screen.getByRole('img', { name: /Laptop view/ })
    const state = (kind: string) => view.querySelector(`[data-zone="${kind}"]`)?.getAttribute('data-state')
    return { view, state }
  }

  it('lights the laptop view from step events alone', () => {
    const { view, state } = renderWithSteps([
      { type: 'step', step: 'cpu_memory', state: 'running' },
      { type: 'step', step: 'cpu_memory', state: 'done' },
      { type: 'step', step: 'storage', state: 'running' },
      { type: 'step', step: 'storage', state: 'done' },
      { type: 'step', step: 'battery', state: 'running' },
      { type: 'step', step: 'battery', state: 'done' },
    ])
    expect(['cpu', 'gpu', 'memory', 'storage', 'battery'].map(state)).toEqual(['found', 'found', 'found', 'found', 'found'])
    expect(view).toHaveAccessibleName('Laptop view: 5 of 5 areas found')
  })

  it('marks a skipped step in the laptop view and lights steps an older scanner only started', () => {
    const { view, state } = renderWithSteps([
      { type: 'step', step: 'cpu_memory', state: 'running' },
      { type: 'step', step: 'storage', state: 'running' },
      { type: 'step', step: 'battery', state: 'running' },
      { type: 'step', step: 'battery', state: 'skipped' },
    ])
    expect(state('cpu')).toBe('found')
    expect(state('storage')).toBe('found')
    expect(state('battery')).toBe('skipped')
    expect(view).toHaveAccessibleName('Laptop view: 4 of 5 areas found, 1 could not be read')
    window.localStorage.clear()
  })
})

describe('ResultsView', () => {
  it('renders five path cards with one recommendation, the gauge and the specs', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    await waitFor(() => expect(screen.getAllByRole('region').length).toBeGreaterThan(5))
    for (const name of ['Upgrade', 'Repair', 'Pass it on', 'Salvage for parts', 'Recycle']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
    expect(screen.getAllByText('Recommended')).toHaveLength(1)
    expect(screen.getByRole('img', { name: /CO₂e gauge/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Your device' })).toBeInTheDocument()
  })

  it('expands a card to show steps and why once the report has arrived', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const upgrade = await screen.findByRole('region', { name: 'Upgrade' })
    await userEvent.click(within(upgrade).getByRole('button'))
    expect(within(upgrade).getByText('What to do')).toBeInTheDocument()
    await waitFor(() => expect(within(upgrade).getAllByRole('listitem').length).toBeGreaterThan(0))
  })

  it('shows calculator ranges and the baseline for the recommended path', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const a = fixture as Assessment
    const top = rankPaths(a.paths, a.weights.environment_first).find(p => p.path.status === 'viable')!.path
    const impact = top.impact!
    const summary = await screen.findByLabelText('Recommendation summary')
    expect(summary).toHaveTextContent(PATH_TITLES[top.path])
    expect(summary).toHaveTextContent(formatEur(impact.cost_eur))
    expect(summary).toHaveTextContent(formatYears(impact.useful_life_years))
    expect(summary).toHaveTextContent(`${impact.co2e_kg.avoided_vs_baseline.low}–${impact.co2e_kg.avoided_vs_baseline.high} kg CO₂e`)
    expect(summary).toHaveTextContent(a.baseline.description)
  })

  it('shows the complete cited evidence on keyboard expansion', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const card = await screen.findByRole('region', { name: 'Upgrade' })
    within(card).getByRole('button').focus()
    await userEvent.keyboard('{Enter}')
    const details = await within(card).findByText('Evidence, assumptions and safety')
    await userEvent.click(details)
    const explanation = sampleReport.paths.find(p => p.path === 'upgrade')!
    for (const claim of explanation.claims) {
      expect(within(card).getByText(claim.text)).toBeVisible()
      for (const id of claim.passage_ids) {
        const p = sampleReport.passages.find(p => p.passage_id === id)!
        expect(within(card).getAllByText(p.text)[0]).toBeVisible()
        expect(Array.from(card.querySelectorAll('blockquote a')).some(a => a.getAttribute('href') === p.url && a.textContent?.includes(p.title))).toBe(true)
      }
    }
  })

  it('keeps the ranking and template notice when model evidence is missing', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.desktop} />))
    expect(await screen.findByText(/AI explanation unavailable/)).toBeVisible()
    for (const name of ['Upgrade', 'Repair']) {
      expect(screen.getByRole('region', { name })).toHaveTextContent(/cannot verify|could not be verified|cannot be verified/i)
    }
  })

  it('explains when no path is viable', async () => {
    const api: typeof fast = { ...fast, streamReport: (id, use, handlers) =>
      fast.streamReport(id, use, { ...handlers, onAssessment: a => handlers.onAssessment({
        ...a, paths: a.paths.map(p => ({ ...p, status: p.status === 'viable' ? 'conditional' : p.status })),
      }) }) }
    render(<ApiContext.Provider value={api}><ResultsView deviceId={MOCK_DEVICE_IDS.laptop} /></ApiContext.Provider>)
    expect(await screen.findByText(/no path is clearly recommended/i)).toBeVisible()
    expect(screen.queryByText('Recommended')).toBeNull()
  })

  it('offers the six use tags with General as default', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    expect(select.value).toBe('general')
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['general', 'office', 'study', 'development', 'pass_on', 'gaming'])
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['General', 'Office', 'Study', 'Development', 'Hand down', 'Gaming'])
    expect(screen.getByText('Intended use')).toBeInTheDocument()
  })

  it('switches the priority toggle', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const money = await screen.findByRole('button', { name: 'Money first' })
    expect(money).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(money)
    expect(money).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Environment first' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reorders by the Money first weights without a new request (feature 003 AC-012)', async () => {
    let assessment: Assessment | null = null
    let streams = 0
    const counting = {
      ...fast,
      streamReport: (deviceId, use, handlers) => {
        streams++
        return fast.streamReport(deviceId, use, {
          ...handlers,
          onAssessment: (a) => {
            assessment = a
            handlers.onAssessment(a)
          },
        })
      },
    } satisfies typeof fast
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(
      <ApiContext.Provider value={counting}>
        <ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />
      </ApiContext.Provider>,
    )
    await screen.findByRole('region', { name: 'Upgrade' })
    const cardOrder = () =>
      screen
        .getAllByRole('region')
        .map((r) => r.getAttribute('aria-label') ?? r.querySelector('h2,h3')?.textContent ?? '')
        .filter((name) => (Object.values(PATH_TITLES) as string[]).includes(name))

    await userEvent.click(screen.getByRole('button', { name: 'Money first' }))

    const a = assessment as Assessment | null
    if (!a) throw new Error('no assessment arrived')
    const expected = rankPaths(a.paths, a.weights.money_first).map(({ path }) => PATH_TITLES[path.path])
    await waitFor(() => expect(cardOrder()).toEqual(expected))
    expect(screen.getByRole('status')).toHaveTextContent(/moved above.*because cost now counts more/i)
    expect(streams).toBe(1)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('leaves out evidence, assumptions and safety sections that are empty', () => {
    const report = sampleReport as Report
    const explanation = report.paths.find((p) => p.path === 'upgrade')!
    const empty = { ...explanation, claims: [], assumptions: [], safety: [] }
    const { container, rerender } = render(<ReportDetails explanation={empty} passages={report.passages} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<ReportDetails explanation={{ ...empty, assumptions: ['The battery is replaceable.'] }} passages={report.passages} />)
    expect(container.querySelector('details')).not.toBeNull()
    expect(screen.getByText('Assumptions')).toBeInTheDocument()
    expect(screen.queryByText('Evidence')).toBeNull()
    expect(screen.queryByText('Safety and feasibility')).toBeNull()
    expect(screen.queryByText('None listed.')).toBeNull()
  })

  it('offers the overview and the five paths as tags next to the use dropdown', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const group = await screen.findByRole('group', { name: 'Show steps for' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Overview',
      'Upgrade',
      'Repair',
      'Pass on',
      'Salvage',
      'Recycle',
    ])
    expect(within(group).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the single actions of a path as cards when its tag is selected, and the overview again on request', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const group = await screen.findByRole('group', { name: 'Show steps for' })
    await screen.findByRole('region', { name: 'Upgrade' })
    await userEvent.click(within(group).getByRole('button', { name: 'Upgrade' }))

    const ssd = await screen.findByRole('region', { name: 'SSD upgrade' })
    for (const name of ['RAM upgrade', 'CPU upgrade', 'Graphics upgrade']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
    expect(within(screen.getByRole('region', { name: 'CPU upgrade' })).getByText('Not a fit')).toBeInTheDocument()

    // Opening an option looks like opening a card in the overview and shows its steps; the gauge follows it.
    await userEvent.click(within(ssd).getByRole('button'))
    // The path summary above the options is a plain block, not a button.
    expect(within(screen.getByRole('region', { name: 'Upgrade summary' })).queryByRole('button')).toBeNull()
    expect(within(ssd).getByText('What to do')).toBeInTheDocument()
    expect(within(ssd).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Upgrade · SSD upgrade')).toBeInTheDocument()
    // Before/after of the changed spec, and the gauge's avoided CO₂e as car kilometres.
    expect(within(within(ssd).getByTestId('before-after')).getByText('500 GB SSD · NVMe')).toBeInTheDocument()
    expect(within(screen.getByTestId('equivalents')).getByText('by car')).toBeInTheDocument()

    await userEvent.click(within(group).getByRole('button', { name: 'Overview' }))
    for (const name of ['Upgrade', 'Repair', 'Pass it on', 'Salvage for parts', 'Recycle']) {
      expect(await screen.findByRole('region', { name })).toBeInTheDocument()
    }
  })

  it('falls back to the path steps when the server sends no options', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.desktop} />))
    const group = await screen.findByRole('group', { name: 'Show steps for' })
    await screen.findByRole('region', { name: 'Upgrade' })
    await userEvent.click(within(group).getByRole('button', { name: 'Repair' }))
    expect(await screen.findByText('No steps available for this path.')).toBeInTheDocument()
  })

  it('stops waiting for the report when the stream ends without one', async () => {
    // Like the live server before feature 004: the assessment, then `end`, and no report.
    const noReport = {
      ...fast,
      streamReport: (deviceId, use, handlers) =>
        fast.streamReport(deviceId, use, {
          ...handlers,
          onReport: () => {},
          onOptions: () => {},
        }),
    } satisfies typeof fast
    render(
      <ApiContext.Provider value={noReport}>
        <ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />
      </ApiContext.Provider>,
    )
    const upgrade = await screen.findByRole('region', { name: 'Upgrade' })
    await userEvent.click(within(upgrade).getByRole('button'))
    expect(await within(upgrade).findByText('No steps available.')).toBeInTheDocument()
  })

  it('explains an unknown device instead of failing silently', async () => {
    render(withApi(<ResultsView deviceId="bbbbbbbbbbbbbbbbbbbbbb" />))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not find this scan/i)
  })
})

describe('App routes (feature 001 AC-010)', () => {
  it('says the scan was not found for a malformed device link, and "page not found" elsewhere', () => {
    window.history.replaceState(null, '', '/d/short')
    const { unmount } = render(withApi(<App />))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('We could not find this scan')
    unmount()

    window.history.replaceState(null, '', '/nowhere')
    render(withApi(<App />))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found')
    window.history.replaceState(null, '', '/')
  })
})

describe('SpecsCard (feature 001 AC-009)', () => {
  it('shows values the scan could not read as "Unknown", including battery health', () => {
    const base = laptopScanJson as unknown as DeviceScan
    const scan: DeviceScan = {
      ...base,
      scan_status: 'partial',
      battery: { ...base.battery, present: true, health_percent: null },
      cpu: { ...base.cpu, name: null },
    }
    render(<SpecsCard scan={scan} />)
    const card = screen.getByRole('region', { name: 'Your device' })
    const valueOf = (label: string) => within(card).getByText(label).nextElementSibling
    expect(valueOf('Battery health')).toHaveTextContent(/^Unknown$/)
    expect(valueOf('Processor')).toHaveTextContent(/^Unknown$/)
    expect(within(card).getByText(/Results are less certain/)).toBeInTheDocument()
  })
})

describe('Imprint and privacy notice (feature 006 FR-046)', () => {
  beforeEach(() => {
    // jsdom has no layout; the page scrolls to the top when it opens.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('links to both pages from the footer', () => {
    render(<Footer />)
    const legal = within(screen.getByRole('navigation', { name: 'Legal' }))
    expect(legal.getByRole('link', { name: 'Imprint' })).toHaveAttribute('href', '/imprint')
    expect(legal.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  })

  it('shows the imprint in English first and switches between German and English', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/imprint')
    render(withApi(<App />))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Imprint')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Deutsch' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Impressum')
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('main')).toHaveAttribute('lang', 'de')
    expect(screen.getByRole('heading', { name: 'Medieninhaber und Diensteanbieter' })).toBeInTheDocument()
    expect(window.location.search).toBe('?lang=de')
  })

  it('opens in the language of ?lang= and keeps it when moving to the privacy notice', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/imprint?lang=de')
    render(withApi(<App />))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Impressum')

    await user.click(screen.getByRole('link', { name: /Zur Datenschutzerklärung/ }))
    expect(window.location.pathname).toBe('/privacy')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Datenschutzerklärung')
  })

  it('answers /impressum and /datenschutz with the same pages', () => {
    window.history.replaceState(null, '', '/datenschutz?lang=de')
    render(withApi(<App />))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Datenschutzerklärung')
  })

  it('states what is stored, for how long and where it goes, in both languages', () => {
    for (const lang of ['de', 'en'] as const) {
      window.history.replaceState(null, '', `/privacy?lang=${lang}`)
      const { unmount } = render(withApi(<App />))
      const text = screen.getByRole('main').textContent ?? ''
      expect(text).toContain('30')
      expect(text).toContain('DeepSeek')
      expect(text).toContain('Vorarlberg')
      expect(text).toContain('dsb@dsb.gv.at')
      expect(text).toContain('contact@leaaf.green')
      unmount()
    }
  })

  it('highlights details that are still in [square brackets] and links addresses', () => {
    render(<Inline text="Write to [Street and number], see https://example.org/a. Mail contact@leaaf.green." />)
    expect(screen.getByText('[Street and number]').tagName).toBe('MARK')
    expect(screen.getByRole('link', { name: 'https://example.org/a' })).toHaveAttribute('href', 'https://example.org/a')
    expect(screen.getByRole('link', { name: 'contact@leaaf.green' })).toHaveAttribute('href', 'mailto:contact@leaaf.green')
  })

  it('names the provider in the imprint and the server operator in the privacy notice', () => {
    window.history.replaceState(null, '', '/imprint')
    const { unmount } = render(withApi(<App />))
    expect(screen.getByRole('main')).toHaveTextContent('Yannik Fischer')
    expect(screen.getByRole('main')).toHaveTextContent('Hohenems')
    unmount()

    window.history.replaceState(null, '', '/privacy')
    render(withApi(<App />))
    expect(screen.getByRole('main')).toHaveTextContent('Marco Stadelmann')
  })
})
