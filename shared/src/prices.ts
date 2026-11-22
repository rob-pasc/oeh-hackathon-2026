// Web prices and local offers (feature 019). Both come from web search and are shown alongside the
// impact table figures: they never change scores, the ranking, the gauge or plan totals (FR-002).
//
// GET    /api/devices/:id/prices?intended_use=<use>                       -> 200 WebPriceList
// GET    /api/devices/:id/options/:optionId/offers?intended_use=<use>     -> 200 LocalOfferList
// GET    /api/devices/:id/location                                        -> 200 DeviceLocation
// POST   /api/devices/:id/location   body LocationRequest                 -> 200 DeviceLocation
// DELETE /api/devices/:id/location                                        -> 200 DeviceLocation (town null)
import { Type, type Static } from 'typebox'
import { DeviceId, IntendedUse, IsoDate, Nullable } from './common.ts'
import { Slug } from './categories.ts'

const strict = { additionalProperties: false } as const

/** Option kinds that get a web price (FR-001). */
export const WEB_PRICE_KINDS = ['ssd', 'ram', 'battery'] as const

/** Fewer offers than this show no web price (FR-003). */
export const MIN_WEB_PRICE_OFFERS = 2

const Hostname = Type.String({ minLength: 1, description: 'Host of the page without "www.", e.g. "geizhals.at"' })

export const WebPriceOffer = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 200, description: 'Product or offer name as the page shows it' }),
    url: Type.String({ format: 'uri' }),
    publisher: Hostname,
    price_eur: Type.Number({ exclusiveMinimum: 0 }),
  },
  strict,
)
export type WebPriceOffer = Static<typeof WebPriceOffer>

export const WebPrice = Type.Object(
  {
    option_id: Slug,
    part: Type.String({ minLength: 1, description: 'The part that was searched, e.g. "500 GB M.2 2280 NVMe SSD"' }),
    low_eur: Type.Number({ exclusiveMinimum: 0 }),
    high_eur: Type.Number({ exclusiveMinimum: 0 }),
    offer_count: Type.Integer({ minimum: MIN_WEB_PRICE_OFFERS }),
    offers: Type.Array(WebPriceOffer, { minItems: MIN_WEB_PRICE_OFFERS }),
    retrieved_on: IsoDate,
  },
  { ...strict, description: 'low_eur and high_eur are the lowest and highest offer; offer_count equals offers.length' },
)
export type WebPrice = Static<typeof WebPrice>

export const WebPriceList = Type.Object(
  {
    device_id: DeviceId,
    intended_use: IntendedUse,
    prices: Type.Array(WebPrice, { description: 'Options without enough usable offers are left out' }),
  },
  strict,
)
export type WebPriceList = Static<typeof WebPriceList>

/** Option kinds whose step plans list local offers (FR-005), and what is searched for each. */
export const OFFER_KINDS = ['repair', 'pass_on', 'recycle'] as const
export const OfferKind = Type.Enum(OFFER_KINDS, {
  description: 'repair = repair cafés and shops; pass_on = donation; recycle = drop-off points',
})
export type OfferKind = Static<typeof OfferKind>

/** Offers shown per step plan (FR-005). */
export const MAX_LOCAL_OFFERS = 3

export const LocalOffer = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    town: Nullable(Type.String({ minLength: 1, maxLength: 80 })),
    url: Type.String({ format: 'uri' }),
    publisher: Hostname,
  },
  strict,
)
export type LocalOffer = Static<typeof LocalOffer>

export const LocalOfferList = Type.Object(
  {
    device_id: DeviceId,
    option_id: Slug,
    kind: OfferKind,
    town: Nullable(Type.String({ minLength: 1, description: 'The shared town the offers were searched for; null = Austria-wide' })),
    offers: Type.Array(LocalOffer, { maxItems: MAX_LOCAL_OFFERS }),
    retrieved_on: Nullable(IsoDate),
  },
  strict,
)
export type LocalOfferList = Static<typeof LocalOfferList>

/** Browser coordinates; the server rounds them to two decimals again before use (FR-006). */
export const LocationRequest = Type.Object(
  {
    lat: Type.Number({ minimum: -90, maximum: 90 }),
    lon: Type.Number({ minimum: -180, maximum: 180 }),
  },
  strict,
)
export type LocationRequest = Static<typeof LocationRequest>

export const DeviceLocation = Type.Object(
  { town: Nullable(Type.String({ minLength: 1, description: 'null = Austria-wide offers' })) },
  strict,
)
export type DeviceLocation = Static<typeof DeviceLocation>

/** Rounds a coordinate to two decimals (about 1 km), the only precision that leaves the browser (FR-006). */
export const roundCoordinate = (value: number): number => Math.round(value * 100) / 100
