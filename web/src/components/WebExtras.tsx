// Web prices, local offers and the Share location bar (feature 019).
import type { OfferKind, WebPrice } from '@leaaf/shared/prices'
import type { LocationState } from '../lib/useWebExtras'
import { areaLabel, cheapestOffers, formatPrice, LOCATION_MESSAGES, OFFER_TITLES, OSM_COPYRIGHT, webPriceLine, type OfferState } from '../lib/webPrices'
import { formatRetrieved } from './SourceLink'
import { Thinking } from './Thinking'

const CHIP = 'rounded-full bg-amber-tint px-2 py-[2px] text-[11px] font-bold text-amber-ink'
const SECTION_LABEL = 'text-xs font-bold tracking-wider text-leaf uppercase'
const BUTTON =
  'cursor-pointer rounded-full border-2 border-leaf bg-white px-3.5 py-1.5 text-[13px] font-bold text-leaf hover:bg-leaf-tint disabled:cursor-wait disabled:opacity-60'

/** The header line next to the impact table figures (FR-001): no links, since the header is a button. */
export function WebPriceTag({ price }: { price: WebPrice }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[13px]" data-testid="web-price">
      <span className={CHIP}>Web price</span>
      <strong>{webPriceLine(price)}</strong>
    </span>
  )
}

/** The opened card's detail: the part searched, the three cheapest offers with links, and the retrieval date. */
export function WebPriceDetail({ price }: { price: WebPrice }) {
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2" data-testid="web-price-detail">
      <span className={SECTION_LABEL}>Web price</span>
      <span className="text-sm leading-snug">
        {price.offer_count} offers for a {price.part} found on the web on {formatRetrieved(price.retrieved_on)}, the cheapest first. The cost above comes
        from our impact table; web prices do not change the ranking.
      </span>
      <ul role="list" aria-label="Cheapest offers" className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
        {cheapestOffers(price).map((offer) => (
          <li key={offer.url + offer.title + offer.price_eur}>
            <strong>{formatPrice(offer.price_eur)}</strong>{' '}
            <a href={offer.url} target="_blank" rel="noreferrer" className="font-medium text-leaf hover:text-leaf-dark">
              {offer.title}
            </a>
            <span className="text-muted"> · {offer.publisher}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Up to three places for the option, each labelled as a web source to check (FR-005). */
export function OffersBlock({ kind, state }: { kind: OfferKind; state: OfferState | undefined }) {
  return (
    <div className="flex flex-col gap-2 sm:col-span-2" data-testid="local-offers">
      <span className={SECTION_LABEL}>{OFFER_TITLES[kind]}</span>
      {!state || state.state === 'loading' ? (
        <Thinking label="Looking for places…" />
      ) : state.state === 'error' ? (
        <span className="text-sm text-muted">The places could not be loaded. Close and reopen the option to try again.</span>
      ) : (
        <>
          <span className="text-[13px] text-muted">{areaLabel(state.list.town)}</span>
          {state.list.offers.length ? (
            <ul role="list" className="m-0 flex list-none flex-col gap-1.5 p-0">
              {state.list.offers.map((offer) => (
                <li key={offer.url + offer.name} className="text-[13px]">
                  <a href={offer.url} target="_blank" rel="noreferrer" className="font-medium text-leaf hover:text-leaf-dark">
                    <span className={`${CHIP} mr-1.5`}>Web source · check</span>
                    {offer.name}
                  </a>
                  <span className="text-muted">
                    {offer.town ? ` · ${offer.town}` : ''} · {offer.publisher}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-muted">No places found on the web yet.</span>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Where local offers are searched, with the Share location button (FR-006) or the way back to
 * Austria-wide offers, and the short message when no town could be used (FR-008).
 */
export function LocationBar({ location, onShare, onClear }: { location: LocationState; onShare: () => void; onClear: () => void }) {
  return (
    <section aria-label="Location for local offers" className="flex flex-col gap-1.5 px-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
        <span>
          <span className="text-muted">Local offers: </span>
          <strong>{location.town ? `Near ${location.town}` : 'Austria-wide'}</strong>
        </span>
        {location.town ? (
          <>
            <button type="button" className={BUTTON} disabled={location.busy} onClick={onClear}>
              Austria-wide
            </button>
            <span className="text-muted">
              Town from{' '}
              <a href={OSM_COPYRIGHT} target="_blank" rel="noreferrer" className="text-leaf hover:text-leaf-dark">
                © OpenStreetMap contributors
              </a>
            </span>
          </>
        ) : (
          <button type="button" className={BUTTON} disabled={location.busy} onClick={onShare}>
            {location.busy ? 'Finding your town…' : 'Share location'}
          </button>
        )}
      </div>
      {/* aria-live rather than role="status": the page already has a status region for mode changes. */}
      <p aria-live="polite" className="m-0 text-[13px] text-muted">
        {location.message ? LOCATION_MESSAGES[location.message] : ''}
      </p>
    </section>
  )
}
