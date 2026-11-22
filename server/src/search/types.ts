// Provider-neutral web search interface (feature 017 FR-002). Callers never see provider details,
// so switching providers means adding one implementation and a registry entry in config.ts.

export interface SearchQuery {
  /** Free text, for example "Lenovo ThinkPad T470 RAM memory slots". Never contains scan values other than the model. */
  text: string
  /** Results to ask the provider for. */
  maxResults: number
  /** Page text characters to ask for per result. */
  maxChars: number
  /** Only results from these domains and their subdomains (feature 019 FR-003). Callers still check hosts themselves. */
  includeDomains?: readonly string[]
  /** Country (ISO 3166-1 alpha-2) and language (ISO 639-1) of the results; providers without such a setting ignore it. */
  locale?: { country: string; language: string }
  /**
   * Whether a hit is usable for the caller (for example: names the exact model). A provider chain
   * moves on to its fallback when no hit is usable; providers themselves ignore it.
   */
  accept?: (hit: SearchHit) => boolean
}

export interface SearchHit {
  title: string
  /** http(s) URL of the page. */
  url: string
  /** Page text when the provider returns it, else the snippet. */
  text: string
  /** Publication date as reported by the provider, if any. */
  published: string | null
}

export interface SearchProvider {
  readonly name: string
  search(query: SearchQuery, signal?: AbortSignal): Promise<SearchHit[]>
}

export type SearchErrorKind =
  | 'config' // missing or invalid configuration
  | 'auth' // the provider rejected the key
  | 'rate_limited' // provider limit, used-up free allowance, or the daily cap
  | 'timeout'
  | 'unavailable' // network errors and 5xx
  | 'bad_response' // unexpected status or body

/** The only error type the search layer throws. `message` never contains the key. */
export class SearchError extends Error {
  readonly kind: SearchErrorKind

  constructor(kind: SearchErrorKind, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SearchError'
    this.kind = kind
  }
}

/** Maps an HTTP status of a provider to an error kind. */
export function statusError(provider: string, status: number): SearchError {
  if (status === 401 || status === 403) return new SearchError('auth', `${provider} rejected the API key (HTTP ${status})`)
  if (status === 402 || status === 429) return new SearchError('rate_limited', `${provider} limit reached (HTTP ${status})`)
  if (status >= 500) return new SearchError('unavailable', `${provider} error (HTTP ${status})`)
  return new SearchError('bad_response', `${provider} rejected the request (HTTP ${status})`)
}

/** Turns fetch failures into SearchErrors; an abort becomes a timeout. */
export function transportError(provider: string, error: unknown): SearchError {
  if (error instanceof SearchError) return error
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
    return new SearchError('timeout', `${provider} did not answer in time`, { cause: error })
  return new SearchError('unavailable', `${provider} is unreachable`, { cause: error })
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
