// TinyFish Search and Fetch (docs.tinyfish.ai, read 2026-11-22). Search
// (GET https://api.search.tinyfish.ai?query=…) returns snippets only, so the top results' page text
// comes from Fetch (POST https://api.fetch.tinyfish.ai, at most 10 URLs). Both use `X-API-Key`.
// A failed fetch keeps the snippet: per-URL failures arrive with HTTP 200 in `errors[]`. Search
// takes `include_domains` (comma-separated), `location` (country code) and `language`.
import { isHttpUrl, SearchError, statusError, transportError, type SearchHit, type SearchProvider } from './types.ts'

export const TINYFISH_SEARCH_URL = 'https://api.search.tinyfish.ai'
export const TINYFISH_FETCH_URL = 'https://api.fetch.tinyfish.ai'
/** Fetch accepts at most 10 URLs per request. */
const MAX_FETCH_URLS = 10
/** Per-URL limit for Fetch; the whole call is still bounded by the caller's signal. */
const FETCH_URL_TIMEOUT_MS = 5000

interface SearchResult {
  title?: unknown
  url?: unknown
  snippet?: unknown
  date?: unknown
}

interface FetchResult {
  url?: unknown
  final_url?: unknown
  text?: unknown
}

export function createTinyFishProvider(apiKey: string, transport: typeof fetch = fetch): SearchProvider {
  const name = 'tinyfish'

  async function call(url: string, init: RequestInit): Promise<unknown> {
    try {
      const response = await transport(url, { ...init, headers: { 'x-api-key': apiKey, ...init.headers } })
      if (!response.ok) throw statusError(name, response.status)
      return await response.json()
    } catch (error) {
      throw transportError(name, error)
    }
  }

  /** Page text per requested URL; an empty map when Fetch fails, so the snippets remain. */
  async function pageTexts(urls: string[], maxChars: number, signal?: AbortSignal): Promise<Map<string, string>> {
    const texts = new Map<string, string>()
    if (urls.length === 0) return texts
    let body: unknown
    try {
      body = await call(TINYFISH_FETCH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ urls, format: 'markdown', per_url_timeout_ms: FETCH_URL_TIMEOUT_MS }),
        ...(signal ? { signal } : {}),
      })
    } catch (error) {
      // An expired deadline still ends the search; other Fetch problems leave the snippets.
      if (error instanceof SearchError && error.kind === 'timeout') throw error
      return texts
    }
    const results = (body as { results?: unknown }).results
    if (!Array.isArray(results)) return texts
    for (const r of results as FetchResult[]) {
      if (typeof r.text !== 'string' || !r.text.trim()) continue
      const text = r.text.slice(0, maxChars)
      for (const key of [r.url, r.final_url]) if (typeof key === 'string') texts.set(key, text)
    }
    return texts
  }

  return {
    name,
    async search(query, signal) {
      const params = new URLSearchParams({ query: query.text })
      if (query.includeDomains?.length) params.set('include_domains', query.includeDomains.join(','))
      if (query.locale) {
        params.set('location', query.locale.country)
        params.set('language', query.locale.language)
      }
      const body = await call(`${TINYFISH_SEARCH_URL}?${params}`, { method: 'GET', ...(signal ? { signal } : {}) })
      const results = (body as { results?: unknown }).results
      if (results === undefined) return []
      if (!Array.isArray(results)) throw new SearchError('bad_response', `${name} answered without a result list`)
      const hits = (results as SearchResult[])
        .filter((r): r is SearchResult & { url: string } => isHttpUrl(r.url))
        .slice(0, Math.min(query.maxResults, MAX_FETCH_URLS))
      const texts = await pageTexts(hits.map((h) => h.url), query.maxChars, signal)
      return hits.flatMap((r): SearchHit[] => {
        const text = texts.get(r.url) ?? (typeof r.snippet === 'string' ? r.snippet : '')
        if (!text.trim()) return []
        return [{
          title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : new URL(r.url).hostname,
          url: r.url,
          text,
          published: typeof r.date === 'string' ? r.date : null,
        }]
      })
    },
  }
}
