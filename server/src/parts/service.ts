// Part lookup service (feature 018): corpus first, web search when the corpus names nothing about
// a part, then one LLM call per device for the parts not cached yet. Lookups never change the
// assessment.
//
// Nothing is stored per device. Results are cached per part for 30 days (FR-006), keyed by the
// part's kind and identifier plus the corpus passages found for it, so a sentence drawn from one
// laptop model's manual is never shown for another model. Results caused by a failure (search
// error, cap, timeout, LLM error) read "No match" and are not cached, so a later visit retries.
import { createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { createValidator, PartLookup, type DeviceRecord, type Passage, type PartLookupResult } from '@leaaf/shared'
import type { Static } from 'typebox'
import type { LlmClient } from '../llm/index.ts'
import type { Retriever } from '../retrieval/index.ts'
import type { SearchBudget, SearchCache } from '../search/cache.ts'
import { excerpt, urlHash } from '../search/evidence.ts'
import { SearchError, type SearchHit, type SearchProvider } from '../search/types.ts'
import { scanParts, type PartQuery } from './identify.ts'
import { PART_LOOKUP_SYSTEM, PartLookupAnswer, partLookupUserPrompt, PROMPT_VERSION } from './prompt.ts'

export const PART_CACHE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
/** Web pages kept per part; the sentence cites one. */
export const WEB_PASSAGES_PER_PART = 2

type Found = Pick<PartLookup, 'status' | 'sentence' | 'source'>
const NO_MATCH: Found = { status: 'no_match', sentence: null, source: null }

export interface PartCache {
  get(key: string): Found | undefined
  set(key: string, value: Found): void
}

const isLookup = createValidator(PartLookup)

export function createSqlitePartCache(db: DatabaseSync, now: () => Date = () => new Date()): PartCache {
  db.exec(`CREATE TABLE IF NOT EXISTS part_cache (
    cache_key TEXT PRIMARY KEY,
    lookup TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`)
  const select = db.prepare('SELECT lookup, created_at FROM part_cache WHERE cache_key = ?')
  const upsert = db.prepare(
    `INSERT INTO part_cache (cache_key, lookup, created_at) VALUES (?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET lookup = excluded.lookup, created_at = excluded.created_at`,
  )
  const prune = db.prepare('DELETE FROM part_cache WHERE created_at < ?')
  return {
    get(key) {
      const row = select.get(key) as { lookup: string; created_at: string } | undefined
      if (!row || now().getTime() - Date.parse(row.created_at) >= PART_CACHE_DAYS * DAY_MS) return undefined
      const value = JSON.parse(row.lookup) as Found
      // A row in an unexpected shape is a miss and is looked up again.
      return isLookup({ part_id: 'x', kind: 'cpu', identifier: 'x', ...value }).ok ? value : undefined
    },
    set(key, value) {
      prune.run(new Date(now().getTime() - PART_CACHE_DAYS * DAY_MS).toISOString())
      upsert.run(key, JSON.stringify(value), now().toISOString())
    },
  }
}

export interface PartWebSearch {
  search: SearchProvider
  /** Feature 017's search cache and daily cap, shared with model searches. */
  cache: SearchCache
  budget: SearchBudget
  timeoutMs: number
  resultsPerQuery: number
  maxChars: number
}

export interface PartLookupDeps {
  retriever: Pick<Retriever, 'retrievePart'>
  llm: LlmClient
  cache: PartCache
  /** Null or absent without a search provider: only corpus lookups run (FR-007). */
  web?: PartWebSearch | null
  warn?: (message: string, details?: Record<string, unknown>) => void
}

export interface PartLookupService {
  /** The device's part lookups; waits for searches and the LLM call, never throws for their failures. */
  lookup(record: DeviceRecord): Promise<PartLookupResult>
  /** Starts the lookup in the background, right after the upload (FR-001). */
  start(record: DeviceRecord): void
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 16)

function webPartPassage(hit: SearchHit, part: PartQuery, retrievedOn: string): Passage {
  const id = `web:${urlHash(hit.url)}`
  const title = hit.title.slice(0, 300) || new URL(hit.url).hostname
  return {
    passage_id: `${id}:part-${part.kind}`,
    document_id: id,
    title,
    url: hit.url,
    publisher: new URL(hit.url).hostname.replace(/^www\./, ''),
    topic: 'repair-hardware',
    section: title,
    page: null,
    applicability: { kind: 'generic' },
    accessed_on: retrievedOn.slice(0, 10),
    text: excerpt(hit.text, { covers: part.pattern }),
    source: 'web',
  }
}

interface Pending {
  part: PartQuery
  key: string
  passages: Passage[]
  /** False when the evidence is incomplete because of a failure; the result is then not cached. */
  cacheable: boolean
}

export function createPartLookupService(deps: PartLookupDeps): PartLookupService {
  const inFlight = new Map<string, Promise<PartLookupResult>>()

  /** Web hits for one part, from feature 017's cache or a fresh search; null on failure or cap. */
  async function webHits(web: PartWebSearch, part: PartQuery, signal: AbortSignal): Promise<{ hits: SearchHit[]; created_at: string } | null> {
    const key = `part\u001f${part.kind}\u001f${part.identifier}`.toLowerCase()
    const cached = web.cache.get(key)
    if (cached) return cached
    if (!web.budget.reserve()) {
      deps.warn?.('daily web search limit reached; part looked up without web evidence', { kind: part.kind })
      return null
    }
    const accept = (h: SearchHit) => part.pattern.test(h.title) || part.pattern.test(h.text)
    try {
      const hits = await web.search.search({ text: part.webQuery, maxResults: web.resultsPerQuery, maxChars: web.maxChars, accept }, signal)
      return web.cache.set(key, hits.filter(accept))
    } catch (error) {
      if (!(error instanceof SearchError)) throw error
      deps.warn?.('part web search failed', { kind: part.kind, reason: error.kind })
      return null
    }
  }

  /** Corpus passages, else web passages, for each part that is not cached. */
  async function evidence(record: DeviceRecord, parts: PartQuery[], results: Map<string, Found>): Promise<Pending[]> {
    const pending: Pending[] = []
    const needWeb: Pending[] = []
    for (const part of parts) {
      const corpus = deps.retriever.retrievePart(record.scan, part.corpusTerms)
      const base = `${PROMPT_VERSION}\u001f${part.kind}\u001f${part.identifier.toLowerCase()}`
      const key = corpus.length > 0 ? `${base}\u001fcorpus:${hash(corpus.map((p) => p.passage_id).join(','))}` : `${base}\u001fweb`
      const cached = deps.cache.get(key)
      if (cached) results.set(part.part_id, cached)
      else if (corpus.length > 0) pending.push({ part, key, passages: corpus, cacheable: true })
      else needWeb.push({ part, key, passages: [], cacheable: !!deps.web })
    }
    const web = deps.web
    if (web && needWeb.length > 0) {
      // One deadline for all web searches of the device (FR-005); parts still open read "No match".
      const signal = AbortSignal.timeout(web.timeoutMs)
      const deadline = new Promise<'timeout'>((resolve) => signal.addEventListener('abort', () => resolve('timeout'), { once: true }))
      await Promise.all(
        needWeb.map(async (entry) => {
          const found = await Promise.race([webHits(web, entry.part, signal), deadline])
          if (found === 'timeout' || found === null) {
            entry.cacheable = false
            return
          }
          entry.passages = found.hits.slice(0, WEB_PASSAGES_PER_PART).map((hit) => webPartPassage(hit, entry.part, found.created_at))
        }),
      )
    }
    for (const entry of needWeb) {
      if (entry.passages.length > 0) pending.push(entry)
      else {
        // The corpus and the web answered without anything about the part, or the search failed.
        results.set(entry.part.part_id, NO_MATCH)
        if (entry.cacheable) deps.cache.set(entry.key, NO_MATCH)
      }
    }
    return pending
  }

  /** One LLM call for all pending parts (FR-003); a sentence without a valid citation is dropped. */
  async function sentences(pending: Pending[], results: Map<string, Found>): Promise<void> {
    if (pending.length === 0) return
    let answer: Static<typeof PartLookupAnswer>
    try {
      const response = await deps.llm.completeJson({
        task: 'part_lookup',
        system: PART_LOOKUP_SYSTEM,
        user: partLookupUserPrompt(pending),
        schema: PartLookupAnswer,
        maxTokens: 1500,
      })
      answer = response.value
    } catch (error) {
      deps.warn?.('part lookup call failed; parts read "No match"', { reason: error instanceof Error ? error.message : String(error) })
      for (const { part } of pending) results.set(part.part_id, NO_MATCH)
      return
    }
    for (const entry of pending) {
      const own = new Map(entry.passages.map((p) => [p.passage_id, p]))
      const entries = answer.parts.filter((a) => a.part_id === entry.part.part_id)
      const valid = entries.length === 1 && entries[0]!.passage_ids.every((id) => own.has(id)) ? entries[0]! : null
      const sentence = valid?.sentence.replace(/\s+/g, ' ').trim()
      const found: Found =
        valid && sentence
          ? (() => {
              const source = own.get(valid.passage_ids[0]!)!
              return { status: source.source === 'web' ? 'web' : 'knowledge_base', sentence, source }
            })()
          : NO_MATCH
      if (entries.length > 0 && !valid) deps.warn?.('part sentence dropped: invalid citation', { kind: entry.part.kind })
      results.set(entry.part.part_id, found)
      if (entry.cacheable) deps.cache.set(entry.key, found)
    }
  }

  async function run(record: DeviceRecord): Promise<PartLookupResult> {
    const parts = scanParts(record.scan)
    const results = new Map<string, Found>()
    const pending = await evidence(record, parts, results)
    await sentences(pending, results)
    return {
      device_id: record.device_id,
      parts: parts.map((p) => ({ part_id: p.part_id, kind: p.kind, identifier: p.identifier, ...(results.get(p.part_id) ?? NO_MATCH) })),
    }
  }

  function lookup(record: DeviceRecord): Promise<PartLookupResult> {
    // The upload's background run and the page's request share one run.
    const running = inFlight.get(record.device_id)
    if (running) return running
    const promise = run(record).finally(() => inFlight.delete(record.device_id))
    inFlight.set(record.device_id, promise)
    return promise
  }

  return {
    lookup,
    start(record) {
      lookup(record).catch((error: unknown) => deps.warn?.('part lookup failed', { reason: error instanceof Error ? error.message : String(error) }))
    },
  }
}
