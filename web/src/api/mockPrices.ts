// FICTIONAL web prices and local offers for mock mode (feature 019), so the Web price line, the
// offers block and the Share location button can be seen without a backend. Links go to example
// domains; the UI marks mock mode with a "Sample data" badge.
import type { LocalOffer, OfferKind, WebPrice } from '@leaaf/shared/prices'

const offer = (title: string, publisher: string, price_eur: number) => ({ title, url: `https://${publisher}/sample-${title.toLowerCase().replace(/\W+/g, '-')}`, publisher, price_eur })

const price = (option_id: string, part: string, offers: WebPrice['offers']): WebPrice => {
  const values = offers.map((o) => o.price_eur)
  return { option_id, part, low_eur: Math.min(...values), high_eur: Math.max(...values), offer_count: offers.length, offers, retrieved_on: '2026-11-22' }
}

/** Sample prices for the laptop's SSD, RAM and battery options. */
export const SAMPLE_PRICES: WebPrice[] = [
  price('ssd-swap', '500 GB M.2 2280 NVMe SSD', [
    offer('Sample NVMe SSD 500 GB', 'example.com', 39.9),
    offer('Sample NVMe SSD 500 GB', 'example.com', 44.99),
    offer('Sample NVMe SSD 500 GB', 'example.org', 52),
  ]),
  price('ram-add', '8 GB DDR4 SO-DIMM', [offer('Sample SO-DIMM 8 GB', 'example.com', 21.49), offer('Sample SO-DIMM 8 GB', 'example.org', 26.9)]),
  price('battery-swap', 'Example Manufacturer Laptop 14 Akku', [offer('Sample battery 45 Wh', 'example.com', 59.9), offer('Sample battery 45 Wh', 'example.org', 74)]),
]

const place = (name: string, town: string): LocalOffer => ({ name, town, url: `https://example.org/${name.toLowerCase().replace(/\W+/g, '-')}`, publisher: 'example.org' })

const AUSTRIA: Record<OfferKind, LocalOffer[]> = {
  repair: [place('Sample Repair Café Wien', 'Wien'), place('Sample Reparaturcafé Graz', 'Graz'), place('Sample repair shop Linz', 'Linz')],
  pass_on: [place('Sample computer donation Wien', 'Wien'), place('Sample social shop Salzburg', 'Salzburg')],
  recycle: [place('Sample collection point Wien', 'Wien'), place('Sample recycling centre Innsbruck', 'Innsbruck')],
}

/** The town the mock "finds" for any location. */
export const SAMPLE_TOWN = 'Dornbirn'

export function sampleOffers(kind: OfferKind, town: string | null): LocalOffer[] {
  if (!town) return AUSTRIA[kind]
  const names: Record<OfferKind, string[]> = {
    repair: [`Sample Repair Café ${town}`, `Sample repair shop ${town}`],
    pass_on: [`Sample donation point ${town}`],
    recycle: [`Sample collection point ${town}`],
  }
  return names[kind].map((name) => place(name, town))
}
