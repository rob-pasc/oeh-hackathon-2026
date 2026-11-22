// Web prices, local offers and the shared town of a result page (feature 019).
import { roundCoordinate, type WebPrice } from '@leaaf/shared/prices'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '../api'
import type { UseTag } from './labels'
import type { LocationMessage, OfferState } from './webPrices'

/**
 * Web prices by option ID, loaded once the categories are shown. A failed request shows no web
 * prices: the impact table figures stay, which is all the card needs.
 */
export function useWebPrices(deviceId: string, use: UseTag, ready: boolean): Record<string, WebPrice> {
  const api = useApi()
  const [prices, setPrices] = useState<Record<string, WebPrice>>({})
  useEffect(() => {
    setPrices({})
    if (!ready) return
    let cancelled = false
    api.getPrices(deviceId, use).then(
      (list) => {
        if (!cancelled) setPrices(Object.fromEntries(list.prices.map((p) => [p.option_id, p])))
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [api, deviceId, use, ready])
  return prices
}

/** Local offers per option, requested when an option is opened, and again after the town changes. */
export function useLocalOffers(deviceId: string, use: UseTag, town: string | null) {
  const api = useApi()
  const [offers, setOffers] = useState<Record<string, OfferState>>({})
  const requested = useRef(new Set<string>())
  const key = useCallback((optionId: string) => `${use}\0${town ?? ''}\0${optionId}`, [use, town])

  const request = useCallback(
    (optionId: string) => {
      const k = key(optionId)
      if (requested.current.has(k)) return
      requested.current.add(k)
      setOffers((o) => ({ ...o, [k]: { state: 'loading' } }))
      api.getOffers(deviceId, use, optionId).then(
        (list) => setOffers((o) => ({ ...o, [k]: { state: 'ready', list } })),
        () => {
          requested.current.delete(k)
          setOffers((o) => ({ ...o, [k]: { state: 'error' } }))
        },
      )
    },
    [api, deviceId, use, key],
  )
  const get = useCallback((optionId: string): OfferState | undefined => offers[key(optionId)], [offers, key])
  return { get, request }
}

export type LocationState = { town: string | null; busy: boolean; message: LocationMessage | null }

/** Reads a position with the browser's permission prompt; low accuracy is enough for a town. */
function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 }),
  )
}

/**
 * The town shared on this device link (FR-006 to FR-008). Coordinates are rounded to two decimals
 * before they leave the browser; the server rounds them again and keeps only the town.
 */
export function useSharedLocation(deviceId: string) {
  const api = useApi()
  const [state, setState] = useState<LocationState>({ town: null, busy: false, message: null })

  useEffect(() => {
    let cancelled = false
    api.getLocation(deviceId).then(
      ({ town }) => {
        if (!cancelled) setState((s) => ({ ...s, town }))
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [api, deviceId])

  const share = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState((s) => ({ ...s, message: 'unsupported' }))
      return
    }
    setState((s) => ({ ...s, busy: true, message: null }))
    let position: GeolocationPosition
    try {
      position = await currentPosition()
    } catch (error) {
      const denied = (error as GeolocationPositionError | undefined)?.code === 1
      setState((s) => ({ ...s, busy: false, message: denied ? 'denied' : 'unavailable' }))
      return
    }
    try {
      const { town } = await api.shareLocation(deviceId, roundCoordinate(position.coords.latitude), roundCoordinate(position.coords.longitude))
      setState({ town, busy: false, message: town ? null : 'not_found' })
    } catch {
      // The request failed before a town was found; the page keeps what it showed.
      setState((s) => ({ ...s, busy: false, message: 'not_found' }))
    }
  }, [api, deviceId])

  const clear = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, message: null }))
    try {
      await api.clearLocation(deviceId)
      setState({ town: null, busy: false, message: null })
    } catch {
      setState((s) => ({ ...s, busy: false }))
    }
  }, [api, deviceId])

  return { ...state, share, clear }
}
