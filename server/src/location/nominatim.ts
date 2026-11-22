// Reverse geocoding with OpenStreetMap Nominatim (feature 019 FR-006, FR-009). Coordinates arrive
// rounded to two decimals and are rounded again here; they live only in memory (the cache below)
// and are never written to the database or a log (FR-007).
//
// Nominatim's usage policy (operations.osmfoundation.org/policies/nominatim/): at most one request
// per second, an identifying User-Agent, and caching of results.
import { roundCoordinate } from '@leaaf/shared'

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'
const MIN_INTERVAL_MS = 1000
const TIMEOUT_MS = 5000
/** Rounded pairs kept in memory; about 1 km cells, so even a busy day stays far below this. */
const CACHE_ENTRIES = 1000

export interface Geocoder {
  /** Town for the coordinates, or null when Nominatim fails or names none. Never throws. */
  town(lat: number, lon: number): Promise<string | null>
}

export interface NominatimOptions {
  baseUrl?: string
  /** Identifies the app to Nominatim, e.g. "leaaf (https://leaaf.green)". */
  userAgent: string
  fetch?: typeof fetch
  /** Clock and timer, replaced in tests to simulate time. */
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  warn?: (message: string, details?: Record<string, unknown>) => void
}

/** The most specific settlement name of a reverse lookup's address. */
export function townOf(body: unknown): string | null {
  const address = (body as { address?: Record<string, unknown> } | null)?.address
  if (!address) return null
  for (const field of ['city', 'town', 'village', 'municipality']) {
    const value = address[field]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 80)
  }
  return null
}

export function createNominatim(options: NominatimOptions): Geocoder {
  const transport = options.fetch ?? fetch
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const base = (options.baseUrl ?? NOMINATIM_URL).replace(/\/+$/, '')
  // Successful lookups only, so a failure is retried on the next press.
  const cache = new Map<string, string | null>()
  // Requests run one after another, each at least MIN_INTERVAL_MS after the previous one started.
  let queue: Promise<unknown> = Promise.resolve()
  let lastStart = -Infinity

  async function request(lat: number, lon: number): Promise<{ ok: true; town: string | null } | { ok: false }> {
    const wait = lastStart + MIN_INTERVAL_MS - now()
    if (wait > 0) await sleep(wait)
    lastStart = now()
    const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lon), zoom: '10', 'accept-language': 'de' })
    try {
      const response = await transport(`${base}/reverse?${params}`, {
        headers: { 'user-agent': options.userAgent, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) {
        options.warn?.('town lookup failed', { status: response.status })
        return { ok: false }
      }
      return { ok: true, town: townOf(await response.json()) }
    } catch (error) {
      options.warn?.('town lookup failed', { reason: error instanceof Error ? error.name : 'unknown' })
      return { ok: false }
    }
  }

  return {
    async town(rawLat, rawLon) {
      const lat = roundCoordinate(rawLat)
      const lon = roundCoordinate(rawLon)
      const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
      if (cache.has(key)) return cache.get(key)!
      const run = queue.then(() => (cache.has(key) ? { ok: true as const, town: cache.get(key)! } : request(lat, lon)))
      queue = run.catch(() => undefined)
      const result = await run
      if (!result.ok) return null
      if (cache.size >= CACHE_ENTRIES) cache.delete(cache.keys().next().value!)
      cache.set(key, result.town)
      return result.town
    },
  }
}
