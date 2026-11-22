// Display helpers for web prices and local offers (feature 019). Both are shown next to the impact
// table figures and never change a score, the ranking or a total (FR-002).
import type { CategoryOption } from '@leaaf/shared/categories'
import type { LocalOfferList, OfferKind, WebPrice } from '@leaaf/shared/prices'

/** "€39.90" with cents only when the amount has them. */
export function formatPrice(eur: number): string {
  return Number.isInteger(eur) ? `€${eur}` : `€${eur.toFixed(2)}`
}

/** "from €39.90 · 3 offers" for the card header (FR-001 as amended 2026-11-22: the lowest price, not a range). */
export function webPriceLine(price: WebPrice): string {
  return `from ${formatPrice(price.low_eur)} · ${price.offer_count} offers`
}

/** Offers listed in the opened card. */
export const SHOWN_OFFERS = 3

/** The cheapest offers, cheapest first, for the opened card. */
export function cheapestOffers(price: WebPrice, count = SHOWN_OFFERS): WebPrice['offers'] {
  return [...price.offers].sort((a, b) => a.price_eur - b.price_eur).slice(0, count)
}

/** Which local offers an option shows, as the server decides it (server/src/offers/service.ts offerKind). */
export function offerKindOf(option: CategoryOption): OfferKind | null {
  const path = option.path ?? ({ battery: 'repair', hand_down: 'pass_on', recycle: 'recycle' } as Partial<Record<string, OfferKind>>)[option.kind] ?? null
  return path === 'repair' || path === 'pass_on' || path === 'recycle' ? path : null
}

/** Heading of the offers block. */
export const OFFER_TITLES: Record<OfferKind, string> = {
  repair: 'Where to get it repaired',
  pass_on: 'Where to donate it',
  recycle: 'Where to hand it in',
}

export type OfferState = { state: 'loading' } | { state: 'ready'; list: LocalOfferList } | { state: 'error' }

/** The area line under the offers: "Near Dornbirn" or "In Austria". */
export const areaLabel = (town: string | null) => (town ? `Near ${town}` : 'In Austria')

export const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright'

/** Messages after Share location (FR-008); each keeps the Austria-wide offers. */
export const LOCATION_MESSAGES = {
  denied: 'Location permission was not given, so the offers stay Austria-wide.',
  unavailable: 'Your location is not available, so the offers stay Austria-wide.',
  not_found: 'We could not find your town, so the offers stay Austria-wide.',
  unsupported: 'This browser cannot share a location, so the offers stay Austria-wide.',
} as const
export type LocationMessage = keyof typeof LOCATION_MESSAGES
