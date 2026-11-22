import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Assessment } from '@leaaf/shared/assessment'
import type { CategoryResult } from '@leaaf/shared/categories'
import fixture from '@leaaf/fixtures/assessment.example-laptop-14.office.json'
import sampleCategories from '@leaaf/fixtures/categories.example-laptop-14.office.json'
import { rankCategories } from '@leaaf/shared/ranking'
import { ApiContext } from '../api'
import { App } from '../app/App'
import { createMockClient, MOCK_DEVICE_IDS } from '../api/mock'
import { Footer } from '../components/Footer'
import { Inline } from '../pages/Legal'
import { PROVIDER } from '../legal/provider'
import { ResultsView } from '../components/ResultsView'
import { SpecsCard } from '../components/SpecsCard'
import type { DeviceScan } from '@leaaf/shared/device'
import type { ApiClient, ScanSessionEvent } from '../api/types'
import laptopScanJson from '@leaaf/fixtures/device-scan.laptop-complete.json'
import { PATH_TITLES } from '../lib/labels'
import { Landing } from '../pages/Landing'
import { ScanSession } from '../pages/ScanSession'

const fast = createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 5, stepsMs: 5 })

function withApi(ui: React.ReactElement) {
  return <ApiContext.Provider value={fast}>{ui}</ApiContext.Provider>
}

const UA = {
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
  macos: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15',
  linux: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  phone: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36',
}
const useAgent = (ua: string) => vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)

describe('Landing', () => {
  beforeEach(() => {
    useAgent(UA.windows)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

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

  it.each([
    ['macos', 'Mac', /Open Anyway/, /No password is needed/, ['Windows', 'Linux']],
    ['linux', 'Linux', /chmod \+x leaaf-scanner/, /Your password lets it also read memory type/, ['Windows', 'Mac']],
    ['windows', 'Windows', /SmartScreen/, /Windows asks for administrator access/, ['Mac', 'Linux']],
  ] as const)('offers the %s scanner with its steps and disclosure (feature 007 FR-013, FR-014)', async (os, label, step, reads, others) => {
    useAgent(UA[os])
    render(withApi(<Landing />))
    expect(screen.getByText(`Scanner for ${label}. Opens a new tab and downloads a small scanner.`)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: `How to run the scanner on ${label}` })).toHaveTextContent(step)
    await userEvent.click(screen.getByText('What does the scanner collect?'))
    expect(screen.getByText(reads)).toBeInTheDocument()
    const other = within(screen.getByRole('group', { name: 'Download for another system' }))
    expect(other.getAllByRole('button').map((button) => button.textContent)).toEqual(others)
  })

  it('shows the run steps as a numbered card with commands and button names set apart (feature 006 FR-047)', () => {
    useAgent(UA.linux)
    render(withApi(<Landing />))
    const card = screen.getByRole('region', { name: 'How to run the scanner on Linux' })
    expect(within(card).getAllByRole('listitem')).toHaveLength(3)
    expect(within(card).getByText('chmod +x leaaf-scanner').tagName).toBe('CODE')
    expect(within(card).getByText('Start scan').tagName).toBe('STRONG')
    expect(within(card).getByRole('heading', { name: 'How to run it on Linux' })).toBeInTheDocument()
  })

  it('asks the API for the system that was chosen', async () => {
    useAgent(UA.macos)
    const create = vi.spyOn(fast, 'createScanSession')
    vi.spyOn(window, 'open').mockReturnValue({ location: { href: '' }, close: vi.fn() } as unknown as Window)
    render(withApi(<Landing />))
    await userEvent.click(screen.getByRole('button', { name: /download and scan now/i }))
    await waitFor(() => expect(create).toHaveBeenCalledWith('macos'))
    await userEvent.click(screen.getByRole('button', { name: 'Linux' }))
    await waitFor(() => expect(create).toHaveBeenLastCalledWith('linux'))
    // Choosing another system shows its steps.
    expect(screen.getByRole('region', { name: 'How to run the scanner on Linux' })).toBeInTheDocument()
  })

  it('lets the visitor read the steps of another system before downloading anything (feature 006 FR-048)', async () => {
    useAgent(UA.windows)
    const create = vi.spyOn(fast, 'createScanSession')
    const open = vi.spyOn(window, 'open')
    render(withApi(<Landing />))
    const tabs = within(screen.getByRole('tablist', { name: 'Show the steps for' }))
    expect(tabs.getByRole('tab', { name: 'Windows' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'How to run the scanner on Windows' })).toBeInTheDocument()

    await userEvent.click(tabs.getByRole('tab', { name: 'Linux' }))
    expect(tabs.getByRole('tab', { name: 'Linux' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'How to run the scanner on Linux' })).toHaveTextContent(/chmod \+x leaaf-scanner/)
    expect(create).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    // The main button still downloads the detected system.
    expect(screen.getByText('Scanner for Windows. Opens a new tab and downloads a small scanner.')).toBeInTheDocument()
  })

  it('puts "What does the scanner collect?" below the download button and the run-steps card (feature 006 FR-049)', () => {
    useAgent(UA.windows)
    render(withApi(<Landing />))
    const button = screen.getByRole('button', { name: /download and scan now/i })
    const steps = screen.getByRole('region', { name: 'How to run the scanner on Windows' })
    const collect = screen.getByText('What does the scanner collect?')
    expect(button.compareDocumentPosition(collect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(steps.compareDocumentPosition(collect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the system switch as three equal segments with a symbol each (feature 006 FR-050)', () => {
    useAgent(UA.windows)
    render(withApi(<Landing />))
    const tabs = within(screen.getByRole('tablist', { name: 'Show the steps for' })).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Windows', 'Mac', 'Linux'])
    for (const tab of tabs) expect(tab.querySelector('svg')).not.toBeNull()
  })

  it('offers all three downloads on a phone', async () => {
    useAgent(UA.phone)
    render(withApi(<Landing />))
    expect(screen.queryByRole('button', { name: /download and scan now/i })).not.toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'Download the scanner' })
    for (const label of ['Windows', 'Mac', 'Linux'])
      expect(within(group).getByRole('button', { name: `Download for ${label}` })).toBeInTheDocument()
    expect(screen.getByText('Run the scanner on the computer you want to check.')).toBeInTheDocument()
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

  it('shows what the name stands for next to the logo while waiting (feature 006 FR-049)', () => {
    window.history.pushState(null, '', '/s/aaaaaaaaaaaaaaaaaaaaaa')
    render(withApi(<ScanSession sessionId="aaaaaaaaaaaaaaaaaaaaaa" />))
    expect(screen.getByRole('banner')).toHaveTextContent('Lifecycle Evaluation and Action Finder')
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
  const sample = sampleCategories as unknown as CategoryResult
  const laptop = fixture as Assessment
  const ranked = (result: CategoryResult, mode: keyof Assessment['weights'] = 'environment_first') =>
    rankCategories(result.categories, laptop.weights[mode])
  /** The mock client with the categories event changed. */
  const withCategories = (change: (result: CategoryResult) => CategoryResult): ApiClient => ({
    ...fast,
    streamReport: (id, use, handlers) =>
      fast.streamReport(id, use, { ...handlers, onCategories: (result) => handlers.onCategories(change(result)) }),
  })
  const renderWith = (api: ApiClient, deviceId: string = MOCK_DEVICE_IDS.laptop) =>
    render(<ApiContext.Provider value={api}><ResultsView deviceId={deviceId} /></ApiContext.Provider>)
  const tabGroup = () => screen.findByRole('group', { name: 'Show options for' })

  it('renders the ranked categories with one recommendation, the gauge and the specs (AC-006, AC-007)', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    for (const { category } of ranked(sample)) expect(await screen.findByRole('region', { name: category.label })).toBeInTheDocument()
    const first = screen.getByRole('region', { name: ranked(sample)[0]!.category.label })
    expect(within(first).getByText('Recommended')).toBeInTheDocument()
    expect(screen.getAllByText('Recommended')).toHaveLength(1)
    const graphics = screen.getByRole('region', { name: 'Graphics' })
    expect(within(graphics).getByText('Not a fit')).toBeInTheDocument()
    expect(within(graphics).getByText('Score').nextElementSibling).toHaveTextContent('—')
    expect(screen.getByRole('img', { name: /CO₂e gauge/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Your device' })).toBeInTheDocument()
  })

  it('shows card and gauge placeholders and a thinking line, not the five paths, until the categories arrive (feature 006 FR-054)', async () => {
    const slow = createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 60_000 })
    renderWith(slow)
    expect(await screen.findByText(/Finding options/)).toBeInTheDocument()
    expect(screen.getByTestId('card-skeleton')).toBeInTheDocument()
    expect(screen.getByTestId('gauge-skeleton')).toBeInTheDocument()
    for (const name of ['Upgrade', 'Repair', 'Pass it on', 'Salvage for parts', 'Recycle'])
      expect(screen.queryByRole('region', { name })).toBeNull()
    expect(screen.queryByRole('img', { name: /CO₂e gauge/ })).toBeNull()
    expect(await screen.findByRole('region', { name: 'Your device' })).toBeInTheDocument()
    expect(within(await tabGroup()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Overview'])
  })

  it('shows no recommendation summary paragraph on the Overview (feature 015 AC-001)', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    await screen.findByRole('region', { name: 'Your plan' })
    await screen.findByRole('region', { name: ranked(sample)[0]!.category.label })
    expect(screen.queryByLabelText('Recommendation summary')).toBeNull()
    expect(screen.queryByText(/Baseline:/)).toBeNull()
  })

  it('says "None" on the card when nothing is credited (feature 006 AC-059)', async () => {
    const uncredited = { low: 0.5, high: 2 }
    renderWith(withCategories((r) => ({
      ...r,
      categories: r.categories.map((c) => ({
        ...c,
        options: c.options.map((o) =>
          o.impact ? { ...o, impact: { ...o.impact, co2e_kg: { ...o.impact.co2e_kg, path: uncredited, avoided_vs_baseline: { low: -2, high: -0.5 } } } } : o,
        ),
      })),
    })))
    const first = await screen.findByRole('region', { name: ranked(sample)[0]!.category.label })
    await waitFor(() => expect(within(first).getByTitle(/Nothing is credited/)).toHaveTextContent('None'))
  })

  it('labels nothing Recommended and shows no summary line when no option is a good fit (008 AC-007, feature 015 AC-002)', async () => {
    renderWith(withCategories((r) => ({
      ...r,
      categories: r.categories.map((c) => ({ ...c, options: c.options.map((o) => (o.status === 'viable' ? { ...o, status: 'conditional' as const } : o)) })),
    })))
    await screen.findByRole('region', { name: ranked(sample)[0]!.category.label })
    expect(screen.queryByText(/no option is clearly recommended/i)).toBeNull()
    expect(screen.queryByText('Recommended')).toBeNull()
  })

  it('shows the five paths as categories with the notice when the AI is unavailable (AC-013)', async () => {
    renderWith(fast, MOCK_DEVICE_IDS.desktop)
    expect(await screen.findByText(/AI explanation unavailable/)).toBeVisible()
    const group = await tabGroup()
    await waitFor(() => expect(within(group).getAllByRole('button')).toHaveLength(6))
    for (const name of ['Upgrade', 'Repair', 'Pass it on', 'Salvage for parts', 'Recycle'])
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
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

  it('re-ranks categories and tabs for Money first without a new request or AI call (AC-008)', async () => {
    const option = sample.categories[0]!.options[0]!
    const swap = (r: CategoryResult): CategoryResult => ({
      ...r,
      categories: [
        { category_id: 'green', label: 'Green', summary: 'Good for the climate.', options: [{ ...option, option_id: 'g', scores: { environment: 95, useful_life: 60, economic: 10, feasibility: 60 } }] },
        { category_id: 'cheap', label: 'Cheap', summary: 'Good for the wallet.', options: [{ ...option, option_id: 'c', scores: { environment: 30, useful_life: 60, economic: 95, feasibility: 60 } }] },
        ...r.categories.slice(4),
      ],
    })
    let streams = 0
    const base = withCategories(swap)
    const counting: ApiClient = { ...base, streamReport: (...args) => { streams++; return base.streamReport(...args) } }
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderWith(counting)
    await screen.findByRole('region', { name: 'Green' })
    const group = await tabGroup()
    const pair = (names: (string | null)[]) => names.filter((n) => n === 'Green' || n === 'Cheap')
    const tabs = () => pair(within(group).getAllByRole('button').map((b) => b.textContent))
    const cards = () => pair(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')))
    expect(tabs()).toEqual(['Green', 'Cheap'])
    expect(cards()).toEqual(['Green', 'Cheap'])

    await userEvent.click(screen.getByRole('button', { name: 'Money first' }))
    await waitFor(() => expect(tabs()).toEqual(['Cheap', 'Green']))
    expect(cards()).toEqual(['Cheap', 'Green'])
    expect(screen.getByRole('status')).toHaveTextContent('Cheap moved above Green because cost now counts more.')
    expect(streams).toBe(1)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('offers Overview plus one tab per category, labelled by the AI, in Overview order (AC-009)', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    await screen.findByRole('region', { name: 'Graphics' })
    const group = await tabGroup()
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Overview', ...ranked(sample).map((r) => r.category.label)])
    expect(within(group).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a category tab with its plain header and its options, Good fit before Depends (AC-009, AC-010)', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const group = await tabGroup()
    await screen.findByRole('region', { name: 'Faster storage' })
    await userEvent.click(within(group).getByRole('button', { name: 'Faster storage' }))

    const header = await screen.findByRole('region', { name: 'Faster storage summary' })
    expect(within(header).queryByRole('button')).toBeNull()
    const view = screen.getByTestId('category-tab-view')
    const optionNames = within(view).getAllByRole('region').map((r) => r.getAttribute('aria-label')).slice(1)
    expect(optionNames).toEqual(['Swap the hard disk for a 500 GB SSD', 'Copy the system to the new SSD', 'Reinstall the operating system'])

    const ssd = screen.getByRole('region', { name: 'Swap the hard disk for a 500 GB SSD' })
    for (const label of ['Cost', 'Extra life', 'CO₂e avoided', 'Score']) expect(within(ssd).getByText(label)).toBeInTheDocument()
    expect(within(ssd).queryByText('AI estimate')).toBeNull()
    await userEvent.click(within(ssd).getByRole('button'))
    expect(within(ssd).getByText('Why')).toBeInTheDocument()
    // The option's own sources sit under "Why"; the step plan below brings its own (feature 009).
    const why = within(ssd).getByText('Why').parentElement!
    const links = within(why).getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
    expect(links.length).toBeLessThanOrEqual(2)
    expect(links[0]).toHaveTextContent(/^Source: /)
    expect(within(ssd).getByText('What to do')).toBeInTheDocument()
    expect(await within(ssd).findByRole('list', { name: 'Steps' })).toBeInTheDocument()

    await userEvent.click(within(group).getByRole('button', { name: 'Overview' }))
    expect(await screen.findByRole('region', { name: 'Graphics' })).toBeInTheDocument()
  })

  it('shows "AI estimate" on an estimated option and on the gauge once it is opened (AC-010, AC-011)', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const gauge = await screen.findByRole('region', { name: 'CO₂e gauge' })
    // Since feature 013 the Overview gauge shows the sample plan; a category tab shows its best option first.
    await userEvent.click((await screen.findByRole('region', { name: 'Faster storage' })).querySelector('button')!)
    await waitFor(() => expect(gauge).toHaveTextContent('Faster storage · Swap the hard disk for a 500 GB SSD'))
    expect(within(gauge).queryByText('AI estimate')).toBeNull()
    const estimate = await screen.findByRole('region', { name: 'Reinstall the operating system' })
    expect(within(estimate).getByText('AI estimate')).toBeInTheDocument()
    await userEvent.click(within(estimate).getByRole('button'))
    expect(gauge).toHaveTextContent('Faster storage · Reinstall the operating system')
    expect(within(gauge).getByText('AI estimate')).toBeInTheDocument()
  })

  it('moves the gauge with the selected tab and remembers the option opened in each tab (feature 011 AC-001 to AC-004)', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const gauge = await screen.findByRole('region', { name: 'CO₂e gauge' })
    const byLabel = (label: string) => ranked(sample).find((r) => r.category.label === label)!
    const bestOf = (label: string) => `${label} · ${byLabel(label).options[0]!.option.title}`
    // Feature 013 FR-008: with a plan, the Overview gauge shows the plan.
    await waitFor(() => expect(gauge).toHaveTextContent('Your plan'))
    const group = await tabGroup()

    // AC-001: a tab with nothing opened shows its best option.
    await userEvent.click(within(group).getByRole('button', { name: 'Faster storage' }))
    await waitFor(() => expect(gauge).toHaveTextContent(bestOf('Faster storage')))
    // AC-003: opening an option moves the gauge to it.
    await userEvent.click(within(await screen.findByRole('region', { name: 'Reinstall the operating system' })).getByRole('button'))
    expect(gauge).toHaveTextContent('Faster storage · Reinstall the operating system')
    await userEvent.click(within(group).getByRole('button', { name: 'Hand it down' }))
    await waitFor(() => expect(gauge).toHaveTextContent(bestOf('Hand it down')))
    // AC-002: back in the first tab, the option opened there again.
    await userEvent.click(within(group).getByRole('button', { name: 'Faster storage' }))
    await waitFor(() => expect(gauge).toHaveTextContent('Faster storage · Reinstall the operating system'))
    // AC-004 (as replaced by feature 013 FR-008): back on the Overview, the plan again; without a plan, the
    // first category's best option (see the plan tests).
    await userEvent.click(within(group).getByRole('button', { name: 'Overview' }))
    await waitFor(() => expect(gauge).toHaveTextContent('Your plan'))
  })

  it('shows "Your plan" above the categories with its steps in order, figures and no score (feature 013 AC-006, AC-009)', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const card = await screen.findByRole('region', { name: 'Your plan' })
    const plan = sample.plan!
    expect(card).toHaveTextContent(plan.summary)
    expect(within(within(card).getByRole('list', { name: 'Plan steps' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      plan.steps.map((s) => s.title),
    )
    for (const label of ['Cost', 'Extra life', 'CO₂e avoided']) expect(within(card).getByText(label)).toBeInTheDocument()
    expect(within(card).queryByText('Score')).toBeNull()
    expect(within(card).getByText('AI estimate')).toBeInTheDocument()
    // Above the categories.
    const first = screen.getByRole('region', { name: ranked(sample)[0]!.category.label })
    expect(card.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the plan on the Overview gauge, and the first category without a plan (feature 013 AC-006, AC-007)', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const gauge = await screen.findByRole('region', { name: 'CO₂e gauge' })
    await waitFor(() => expect(gauge).toHaveTextContent('Your plan'))
    expect(within(gauge).getByText('AI estimate')).toBeInTheDocument()
    cleanup()

    renderWith(withCategories(({ plan: _plan, ...rest }) => rest))
    const first = ranked(sample)[0]!
    const gauge2 = await screen.findByRole('region', { name: 'CO₂e gauge' })
    await waitFor(() => expect(gauge2).toHaveTextContent(`${first.category.label} · ${first.options[0]!.option.title}`))
    expect(screen.queryByRole('region', { name: 'Your plan' })).toBeNull()
  })

  it('stops waiting when the stream ends without categories', async () => {
    // Like a server before feature 008: the assessment, then `end`.
    const none: ApiClient = { ...fast, streamReport: (id, use, handlers) => fast.streamReport(id, use, { ...handlers, onCategories: () => {} }) }
    renderWith(none)
    const upgrade = await screen.findByRole('region', { name: 'Upgrade' })
    await userEvent.click(within(upgrade).getByRole('button'))
    expect(await within(upgrade).findByText('No steps available.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/Finding options/)).toBeNull())
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

describe('Result screen header (feature 006 FR-049)', () => {
  it('shows what the name stands for next to the logo on the device page', async () => {
    window.history.replaceState(null, '', `/d/${MOCK_DEVICE_IDS.laptop}`)
    render(withApi(<App />))
    expect(screen.getByRole('banner')).toHaveTextContent('Lifecycle Evaluation and Action Finder')
    await screen.findByRole('group', { name: 'Show options for' })
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
    // Check against the configured address rather than a fixed town, so a change of address in
    // provider.ts does not need a test change.
    for (const line of PROVIDER.address) expect(screen.getByRole('main')).toHaveTextContent(line)
    unmount()

    window.history.replaceState(null, '', '/privacy')
    render(withApi(<App />))
    expect(screen.getByRole('main')).toHaveTextContent('Marco Stadelmann')
  })
})
