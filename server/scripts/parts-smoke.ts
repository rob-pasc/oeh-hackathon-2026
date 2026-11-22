// Live part lookup: `npm run parts:smoke -w server` (feature 018 AC-010).
// Reads server/.env and the corpus index. Looks up the parts of a sample laptop outside the corpus
// (ThinkPad T470 parts) with the configured LLM and search providers, using fresh in-memory caches,
// and prints each part's badge, sentence and source. Never prints the API keys. Exits non-zero
// when no part gets a Web search result, the check AC-010 asks for.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { DeviceScan } from '@leaaf/shared'
import { createOpenAiCompatibleClient, LlmError, loadLlmConfig } from '../src/llm/index.ts'
import { createPartLookupService, createSqlitePartCache } from '../src/parts/service.ts'
import { DEFAULT_CORPUS_INDEX_PATH, openRetriever } from '../src/retrieval/index.ts'
import { createSqliteSearchBudget, createSqliteSearchCache } from '../src/search/cache.ts'
import { createConfiguredSearch, loadSearchConfig } from '../src/search/config.ts'

const base = JSON.parse(readFileSync(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url), 'utf8')) as DeviceScan
const scan: DeviceScan = {
  ...base,
  identity: { ...base.identity, manufacturer: 'LENOVO', model: '20HD000MUS', product_version: 'ThinkPad T470', system_family: 'ThinkPad T470' },
  cpu: { name: 'Intel(R) Core(TM) i5-7300U CPU @ 2.60GHz', cores: 2, threads: 4 },
  gpus: ['Intel(R) HD Graphics 620'],
  storage: [{ media: 'ssd', bus: 'nvme', capacity_gb: 256, health: 'healthy' }],
}

try {
  const search = loadSearchConfig()
  if (!search) console.warn('no search provider configured: only corpus lookups run')
  const db = new DatabaseSync(':memory:')
  const service = createPartLookupService({
    retriever: openRetriever(resolve(process.env.CORPUS_INDEX_PATH ?? DEFAULT_CORPUS_INDEX_PATH)),
    llm: createOpenAiCompatibleClient(loadLlmConfig()),
    cache: createSqlitePartCache(db),
    web: search
      ? {
          search: createConfiguredSearch(search, { warn: (m, d) => console.warn(m, d ?? '') }),
          cache: createSqliteSearchCache(db),
          budget: createSqliteSearchBudget(db, search.dailyCalls),
          timeoutMs: search.timeoutMs,
          resultsPerQuery: search.resultsPerQuery,
          maxChars: search.maxChars,
        }
      : null,
    warn: (m, d) => console.warn(`warning: ${m}`, d ?? ''),
  })
  const started = Date.now()
  const result = await service.lookup({ device_id: 'smokeTestDevice0000000', created_at: new Date().toISOString(), scan })
  console.log(`${result.parts.length} parts in ${Date.now() - started} ms`)
  for (const p of result.parts) {
    console.log(`  ${p.part_id.padEnd(10)} ${p.identifier.padEnd(24)} ${p.status}`)
    if (p.sentence) console.log(`             ${p.sentence}\n             ${p.source!.url}`)
  }
  if (result.parts.some((p) => p.status === 'web')) console.log('parts smoke test passed')
  else {
    console.error('parts smoke test failed: no part got a web search result')
    process.exitCode = 1
  }
} catch (error) {
  console.error('parts smoke test failed:', error instanceof LlmError ? `${error.kind}: ${error.message}` : error)
  process.exitCode = 1
}
