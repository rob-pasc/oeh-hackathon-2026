// Live check of the configured web search providers: `npm run search:smoke -w server` (feature 017 FR-014).
// Reads server/.env. Asks each configured provider (not the chain) one query about a laptop that is
// not in the corpus and prints the result count, the results that pass the model match, and their
// domains. Never prints the API keys. Exits non-zero when a provider fails.
// Optional: `-- "<manufacturer>" "<model>"` to search for another model.
import { PROVIDERS, loadSearchConfig } from '../src/search/config.ts'
import { distinctiveModel, modelMatcher, SEARCH_TOPICS, topicQuery } from '../src/search/evidence.ts'
import { SearchError } from '../src/search/types.ts'

const [manufacturer = 'Lenovo', model = 'ThinkPad T470'] = process.argv.slice(2)

try {
  const config = loadSearchConfig()
  if (!config) throw new SearchError('config', 'no LANGSEARCH_API_KEY or TINYFISH_API_KEY set (see server/.env.example)')
  const target = { manufacturer, model }
  const name = distinctiveModel(target)
  if (!name) throw new SearchError('config', `"${model}" is not distinctive enough to search for`)
  const matches = modelMatcher(name)
  const topic = SEARCH_TOPICS[0]!
  const query = topicQuery(target, name, topic)
  console.log(`query: ${query}`)

  let failed = false
  for (const { name: provider, apiKey } of config.providers) {
    const started = Date.now()
    try {
      const hits = await PROVIDERS[provider]!.create(apiKey).search(
        { text: query, maxResults: config.resultsPerQuery, maxChars: config.maxChars },
        AbortSignal.timeout(Math.max(config.timeoutMs, 15000)),
      )
      const kept = hits.filter((h) => matches(h.title) || matches(h.text))
      console.log(`${provider}: ${hits.length} results, ${kept.length} name "${name}", ${Date.now() - started} ms`)
      for (const h of kept) console.log(`  ${new URL(h.url).hostname}  ${h.title.slice(0, 80)}  (${h.text.length} chars)`)
    } catch (error) {
      failed = true
      if (!(error instanceof SearchError)) throw error
      console.error(`${provider}: failed: ${error.kind}: ${error.message}`)
    }
  }
  if (failed) process.exitCode = 1
  else console.log('search smoke test passed')
} catch (error) {
  console.error('search smoke test failed:', error instanceof SearchError ? `${error.kind}: ${error.message}` : error)
  process.exitCode = 1
}
