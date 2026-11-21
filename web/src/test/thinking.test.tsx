// Thinking line while the page waits for the AI (feature 006 FR-045, AC-050, AC-051).
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiContext } from '../api'
import { createMockClient, MOCK_DEVICE_IDS } from '../api/mock'
import { ResultsView } from '../components/ResultsView'
import { Thinking } from '../components/Thinking'
import { nextThinkingPhrase, THINKING_INTERVAL_MS, THINKING_PHRASES } from '../lib/thinking'

afterEach(() => {
  vi.useRealTimers()
})

describe('nextThinkingPhrase', () => {
  it('never returns the previous phrase', () => {
    for (const previous of THINKING_PHRASES) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999999]) {
        const next = nextThinkingPhrase(previous, () => r)
        expect(next).not.toBe(previous)
        expect(THINKING_PHRASES).toContain(next)
      }
    }
  })

  it('can pick every phrase as the first one', () => {
    const n = THINKING_PHRASES.length
    const picked = new Set(THINKING_PHRASES.map((_, i) => nextThinkingPhrase(null, () => i / n)))
    expect(picked.size).toBe(n)
  })

  it('falls back to the only phrase when there is no other', () => {
    expect(nextThinkingPhrase('Thinking…', () => 0, ['Thinking…'])).toBe('Thinking…')
  })
})

describe('Thinking', () => {
  it('changes to a different phrase every interval while screen readers get one steady label', () => {
    vi.useFakeTimers()
    render(<Thinking label="Writing the explanation…" />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Writing the explanation…')
    const phrase = () => status.querySelector('[aria-hidden="true"].fade-up')!.textContent
    let previous = phrase()
    expect(THINKING_PHRASES).toContain(previous)
    for (let i = 0; i < 5; i++) {
      act(() => vi.advanceTimersByTime(THINKING_INTERVAL_MS))
      const current = phrase()
      expect(current).not.toBe(previous)
      expect(THINKING_PHRASES).toContain(current)
      previous = current
    }
    expect(status.querySelector('svg')).not.toBeNull()
  })
})

describe('thinking line on the result screen', () => {
  it('shows above the result placeholders while the assessment loads', async () => {
    const slow = createMockClient({ stepMs: 5, assessmentMs: 60_000, reportMs: 60_000 })
    render(
      <ApiContext.Provider value={slow}>
        <ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />
      </ApiContext.Provider>,
    )
    const thinking = await screen.findByTestId('thinking')
    expect(thinking).toHaveTextContent('Assessing your computer…')
    expect(screen.getByTestId('result-skeleton')).toBeInTheDocument()
  })

  it('shows in an opened card until the report arrives, then disappears', async () => {
    const api = createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 400 })
    render(
      <ApiContext.Provider value={api}>
        <ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />
      </ApiContext.Provider>,
    )
    const upgrade = await screen.findByRole('region', { name: 'Upgrade' })
    await userEvent.click(within(upgrade).getByRole('button'))
    expect(within(upgrade).getByTestId('thinking')).toHaveTextContent('Writing the explanation…')
    await waitFor(() => expect(within(upgrade).queryByTestId('thinking')).toBeNull(), { timeout: 3000 })
    expect(within(upgrade).getAllByRole('listitem').length).toBeGreaterThan(0)
  })
})
