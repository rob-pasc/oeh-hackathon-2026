// Web prices, local offers and Share location on the result screen (feature 019 T-005).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiContext } from '../api'
import { createMockClient, MOCK_DEVICE_IDS } from '../api/mock'
import { SAMPLE_PRICES, SAMPLE_TOWN } from '../api/mockPrices'
import type { ApiClient } from '../api/types'
import { ResultsView } from '../components/ResultsView'
import { formatPrice, LOCATION_MESSAGES, offerKindOf, priceSites, webPriceLine } from '../lib/webPrices'
import LAPTOP from '@leaaf/fixtures/categories.example-laptop-14.office.json'
import type { CategoryResult } from '@leaaf/shared/categories'

const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
afterEach(() => {
  cleanup()
  if (originalGeolocation) Object.defineProperty(navigator, 'geolocation', originalGeolocation)
  else delete (navigator as { geolocation?: unknown }).geolocation
})

const fast = () => createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 5, stepsMs: 5 })
const renderWith = (api: ApiClient) =>
  render(
    <ApiContext.Provider value={api}>
      <ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />
    </ApiContext.Provider>,
  )

async function openOption(tab: string, title: string) {
  const group = await screen.findByRole('group', { name: 'Show options for' })
  await userEvent.click(await within(group).findByRole('button', { name: tab }))
  const card = await screen.findByRole('region', { name: title })
  await userEvent.click(within(card).getAllByRole('button')[0]!)
  return card
}

/** A fake geolocation API answering with `answer`. */
function geolocation(answer: (ok: PositionCallback, fail: PositionErrorCallback) => void) {
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => answer(ok, fail))
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })
  return getCurrentPosition
}
const at = (latitude: number, longitude: number) => ({ coords: { latitude, longitude } }) as GeolocationPosition
const failure = (code: number) => ({ code, message: 'no' }) as GeolocationPositionError

describe('display helpers', () => {
  it('formats prices with cents only where they exist', () => {
    expect(formatPrice(52)).toBe('€52')
    expect(formatPrice(39.9)).toBe('€39.90')
    expect(webPriceLine(SAMPLE_PRICES[0]!)).toBe('€39.90–52 · 3 offers')
    expect(priceSites(SAMPLE_PRICES[0]!).map((s) => s.publisher)).toEqual(['example.com', 'example.org'])
  })

  it('shows offers for repair, pass it on and recycle options, as the server does', () => {
    const kinds = Object.fromEntries((LAPTOP as unknown as CategoryResult).categories.flatMap((c) => c.options).map((o) => [o.option_id, offerKindOf(o)]))
    expect(kinds).toMatchObject({ 'battery-swap': 'repair', donate: 'pass_on', recycle: 'recycle', 'ssd-swap': null, 'ram-add': null })
  })
})

describe('web prices (AC-001)', () => {
  it('shows a Web price next to the impact table figures, with sites and date when opened', async () => {
    renderWith(fast())
    const card = await openOption('Memory', 'Add an 8 GB DDR4 module')
    expect(within(card).getByText('Cost')).toBeInTheDocument()
    expect(await within(card).findByTestId('web-price')).toHaveTextContent('Web price€21.49–26.90 · 2 offers')
    const detail = within(card).getByTestId('web-price-detail')
    expect(detail).toHaveTextContent('for a 8 GB DDR4 SO-DIMM, found on the web on 22 Nov 2026')
    expect(within(detail).getAllByRole('link').map((a) => a.textContent)).toEqual(['example.com', 'example.org'])
  })

  it('shows no Web price when the server has none', async () => {
    const base = fast()
    renderWith({ ...base, getPrices: async (id, use) => ({ device_id: id, intended_use: use, prices: [] }) })
    const card = await openOption('Memory', 'Add an 8 GB DDR4 module')
    expect(within(card).getByText('Cost')).toBeInTheDocument()
    expect(within(card).queryByTestId('web-price')).toBeNull()
  })
})

describe('local offers (AC-005)', () => {
  it('lists Austrian places in the repair option, each labelled as a web source to check', async () => {
    renderWith(fast())
    const card = await openOption('Battery', 'Replace the battery')
    const block = await within(card).findByTestId('local-offers')
    expect(block).toHaveTextContent('Where to get it repaired')
    await within(block).findByText('In Austria')
    const links = within(block).getAllByRole('link')
    expect(links).toHaveLength(3)
    for (const link of links) expect(link).toHaveTextContent(/^Web source · check/)
  })

  it('shows no offers block for an SSD option', async () => {
    renderWith(fast())
    const card = await openOption('Faster storage', 'Swap the hard disk for a 500 GB SSD')
    expect(within(card).queryByTestId('local-offers')).toBeNull()
  })
})

describe('Share location (AC-006, AC-008)', () => {
  it('sends coordinates rounded to two decimals, shows the town and its offers, and goes back to Austria-wide', async () => {
    const base = fast()
    const shareLocation = vi.fn(base.shareLocation)
    renderWith({ ...base, shareLocation })
    geolocation((ok) => ok(at(47.41237, 9.74391)))
    const card = await openOption('Battery', 'Replace the battery')
    await within(card).findByText('In Austria')

    await userEvent.click(screen.getByRole('button', { name: 'Share location' }))
    expect(shareLocation).toHaveBeenCalledWith(MOCK_DEVICE_IDS.laptop, 47.41, 9.74)
    const bar = screen.getByRole('region', { name: 'Location for local offers' })
    await within(bar).findByText(`Near ${SAMPLE_TOWN}`)
    expect(within(bar).getByRole('link', { name: '© OpenStreetMap contributors' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
    await within(card).findByText(`Near ${SAMPLE_TOWN}`)
    expect(within(card).getByTestId('local-offers')).toHaveTextContent(`Sample Repair Café ${SAMPLE_TOWN}`)

    await userEvent.click(within(bar).getByRole('button', { name: 'Austria-wide' }))
    await within(bar).findByRole('button', { name: 'Share location' })
    await within(card).findByText('In Austria')
  })

  it.each([
    ['denied permission', () => geolocation((_ok, fail) => fail(failure(1))), LOCATION_MESSAGES.denied],
    ['unavailable location', () => geolocation((_ok, fail) => fail(failure(2))), LOCATION_MESSAGES.unavailable],
  ])('keeps Austria-wide offers with a short message after %s', async (_name, setup, message) => {
    const base = fast()
    const shareLocation = vi.fn(base.shareLocation)
    renderWith({ ...base, shareLocation })
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Share location' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(shareLocation).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Location for local offers' })).toHaveTextContent('Austria-wide')
  })

  it('keeps Austria-wide offers when the server finds no town', async () => {
    renderWith({ ...fast(), shareLocation: async () => ({ town: null }) })
    geolocation((ok) => ok(at(47.41, 9.74)))
    await userEvent.click(await screen.findByRole('button', { name: 'Share location' }))
    expect(await screen.findByText(LOCATION_MESSAGES.not_found)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share location' })).toBeInTheDocument()
  })

  it('says so when the browser has no geolocation', async () => {
    delete (navigator as { geolocation?: unknown }).geolocation
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined })
    renderWith(fast())
    await userEvent.click(await screen.findByRole('button', { name: 'Share location' }))
    expect(await screen.findByText(LOCATION_MESSAGES.unsupported)).toBeInTheDocument()
  })

  it('shows the town already shared on the device link', async () => {
    renderWith({ ...fast(), getLocation: async () => ({ town: 'Graz' }) })
    await waitFor(() => expect(screen.getByRole('region', { name: 'Location for local offers' })).toHaveTextContent('Near Graz'))
  })
})
