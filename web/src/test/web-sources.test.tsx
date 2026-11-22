// Web sources on the result screen (feature 017): the "Web source" label (FR-007) and the
// "Searching the web…" thinking line (FR-013).
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Passage } from '@leaaf/shared/retrieval'
import { ApiContext } from '../api'
import { createMockClient, MOCK_DEVICE_IDS } from '../api/mock'
import { SAMPLE_WEB_PASSAGE } from '../api/mockCategories'
import type { ApiClient } from '../api/types'
import { ResultsView } from '../components/ResultsView'
import { formatRetrieved, SourceLink } from '../components/SourceLink'
import { Thinking } from '../components/Thinking'
import { sourceRef } from '../lib/pathView'
import { THINKING_INTERVAL_MS, WEB_SEARCH_PHRASE } from '../lib/thinking'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const corpus: Passage = {
  ...SAMPLE_WEB_PASSAGE,
  passage_id: 'ex14-hmm#memory-1',
  title: 'Example Laptop 14 Hardware Maintenance Manual',
  url: 'https://example.org/manuals/ex14-hmm.pdf',
  publisher: 'Example Manufacturer',
  section: 'Memory',
  page: 42,
  source: undefined,
}

describe('source links (FR-007)', () => {
  it('labels a web page with "Web source", its title, site and retrieval date, linking to it (AC-008)', () => {
    render(<SourceLink source={sourceRef(SAMPLE_WEB_PASSAGE)} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', SAMPLE_WEB_PASSAGE.url)
    expect(link).toHaveTextContent('Web source')
    expect(link).toHaveTextContent('Example Laptop 14 specifications · example.com · retrieved 22 Nov 2026')
    // The page title is not repeated as its section.
    expect(link.textContent).not.toContain('specifications, Example Laptop 14')
  })

  it('shows corpus sources as before (AC-008)', () => {
    render(<SourceLink source={sourceRef(corpus)} />)
    const link = screen.getByRole('link')
    expect(link).toHaveTextContent('Source: Example Laptop 14 Hardware Maintenance Manual, Memory')
    expect(link).not.toHaveTextContent('Web source')
  })

  it('formats the retrieval date as a calendar day', () => {
    expect(formatRetrieved('2026-01-01')).toBe('1 Jan 2026')
    expect(formatRetrieved('not a date')).toBe('not a date')
  })

  it('shows the sample web source on the mock laptop\'s memory option (AC-008)', async () => {
    const api = createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 5, stepsMs: 5 })
    render(<ApiContext.Provider value={api}><ResultsView deviceId={MOCK_DEVICE_IDS.laptop} /></ApiContext.Provider>)
    const group = await screen.findByRole('group', { name: 'Show options for' })
    await userEvent.click(await within(group).findByRole('button', { name: 'Memory' }))
    const view = await screen.findByTestId('category-tab-view')
    const option = within(view).getAllByRole('region').slice(1)[0]!
    await userEvent.click(within(option).getAllByRole('button')[0]!)
    const why = within(option).getByText('Why').parentElement!
    const link = within(why).getByRole('link', { name: /Web source/ })
    expect(link).toHaveAttribute('href', SAMPLE_WEB_PASSAGE.url)
  })
})

describe('web search thinking line (FR-013)', () => {
  it('keeps a fixed phrase instead of rotating', () => {
    vi.useFakeTimers()
    render(<Thinking phrase={WEB_SEARCH_PHRASE} label="Searching the web for this model…" />)
    expect(screen.getByText(WEB_SEARCH_PHRASE)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(THINKING_INTERVAL_MS * 3))
    expect(screen.getByText(WEB_SEARCH_PHRASE)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Searching the web for this model…')
  })

  it('shows "Searching the web…" after a web_search status until the assessment arrives (AC-015)', async () => {
    const base = createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 5, stepsMs: 5 })
    let release: () => void = () => {}
    const api: ApiClient = {
      ...base,
      streamReport: (id, use, handlers) => {
        handlers.onStatus?.({ phase: 'web_search' })
        let stop = () => {}
        release = () => {
          stop = base.streamReport(id, use, { ...handlers, onStatus: () => {} })
        }
        return () => stop()
      },
    }
    render(<ApiContext.Provider value={api}><ResultsView deviceId={MOCK_DEVICE_IDS.desktop} /></ApiContext.Provider>)
    expect(await screen.findByText(WEB_SEARCH_PHRASE)).toBeInTheDocument()
    act(() => release())
    await screen.findByRole('region', { name: 'Upgrade' })
    expect(screen.queryByText(WEB_SEARCH_PHRASE)).toBeNull()
  })

  it('does not show it without a status event', async () => {
    const api = createMockClient({ stepMs: 5, assessmentMs: 50, reportMs: 5, stepsMs: 5 })
    render(<ApiContext.Provider value={api}><ResultsView deviceId={MOCK_DEVICE_IDS.desktop} /></ApiContext.Provider>)
    expect(await screen.findByText('Assessing your computer…')).toBeInTheDocument()
    expect(screen.queryByText(WEB_SEARCH_PHRASE)).toBeNull()
  })
})
