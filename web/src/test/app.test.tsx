import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiContext } from '../api'
import { createMockClient, MOCK_DEVICE_IDS } from '../api/mock'
import { ResultsView } from '../components/ResultsView'
import { Landing } from '../pages/Landing'
import { ScanSession } from '../pages/ScanSession'

const fast = createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 5 })

function withApi(ui: React.ReactElement) {
  return <ApiContext.Provider value={fast}>{ui}</ApiContext.Provider>
}

describe('Landing', () => {
  it('shows the three steps and the Scan now button', () => {
    render(withApi(<Landing />))
    expect(screen.getByRole('button', { name: /scan now/i })).toBeInTheDocument()
    for (const title of ['Scan Device', 'AI Analysis', 'Save CO₂ & Money']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('opens a new tab on the session route when Scan now is clicked', async () => {
    const tab = { location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    render(withApi(<Landing />))
    await userEvent.click(screen.getByRole('button', { name: /scan now/i }))
    await waitFor(() => expect(tab.location.href).toMatch(/^\/s\/[A-Za-z0-9_-]{22}$/))
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

  it('offers the five use tags with Office as default', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    expect(select.value).toBe('office')
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['office', 'study', 'development', 'pass_on', 'gaming'])
  })

  it('switches the priority toggle', async () => {
    render(withApi(<ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />))
    const money = await screen.findByRole('button', { name: 'Money first' })
    expect(money).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(money)
    expect(money).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Environment first' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('explains an unknown device instead of failing silently', async () => {
    render(withApi(<ResultsView deviceId="bbbbbbbbbbbbbbbbbbbbbb" />))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not find this scan/i)
  })
})
