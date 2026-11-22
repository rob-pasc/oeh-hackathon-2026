// LangSearch Web Search API (docs.langsearch.com/api/web-search-api.md, read 2026-11-22):
// POST https://api.langsearch.com/v1/web-search with a Bearer key. `contents.text.maxCharacters`
// makes each result carry page text (`text`) instead of a `snippet`.
import { isHttpUrl, SearchError, statusError, transportError, type SearchHit, type SearchProvider } from './types.ts'

export const LANGSEARCH_URL = 'https://api.langsearch.com/v1/web-search'

interface LangSearchResult {
  name?: unknown
  url?: unknown
  snippet?: unknown
  text?: unknown
  datePublished?: unknown
}

export function createLangSearchProvider(apiKey: string, transport: typeof fetch = fetch): SearchProvider {
  const name = 'langsearch'
  return {
    name,
    async search(query, signal) {
      let body: unknown
      try {
        const response = await transport(LANGSEARCH_URL, {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            query: query.text,
            count: Math.min(50, Math.max(1, query.maxResults)),
            contents: { text: { maxCharacters: query.maxChars } },
          }),
          ...(signal ? { signal } : {}),
        })
        if (!response.ok) throw statusError(name, response.status)
        body = await response.json()
      } catch (error) {
        throw transportError(name, error)
      }
      // Errors can also come back as HTTP 200 with another `code`.
      const envelope = body as { code?: unknown; data?: { webPages?: { value?: unknown } } }
      if (typeof envelope.code === 'number' && envelope.code !== 200) throw statusError(name, envelope.code)
      const value = envelope.data?.webPages?.value
      if (value === undefined) return []
      if (!Array.isArray(value)) throw new SearchError('bad_response', `${name} answered without a result list`)
      return (value as LangSearchResult[]).flatMap((r): SearchHit[] => {
        const text = typeof r.text === 'string' && r.text.trim() ? r.text : typeof r.snippet === 'string' ? r.snippet : ''
        if (!isHttpUrl(r.url) || !text.trim()) return []
        return [{
          title: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : new URL(r.url).hostname,
          url: r.url,
          text,
          published: typeof r.datePublished === 'string' ? r.datePublished : null,
        }]
      })
    },
  }
}
