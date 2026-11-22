// Web evidence for model facts (feature 017). When retrieval has no model-specific passage for a
// fact topic, the model and topic are searched on the web, results naming the exact model become
// passages marked `source: "web"`, and they are added to the paths that use the topic. After fact
// extraction, `finishWebEvidence` keeps only the web passages a kept fact cites.
import { createHash } from 'node:crypto'
import { PATHS, type FactSet, type ModelMatch, type Passage, type Path, type RetrievalResult } from '@leaaf/shared'
import { HARDWARE_FACTS } from '../assessment/facts.ts'
import type { SearchBudget, SearchCache } from './cache.ts'
import { SearchError, type SearchHit, type SearchProvider } from './types.ts'

export interface SearchTopic {
  id: 'memory' | 'storage' | 'battery' | 'software'
  /** Words appended to the model in the query. */
  query: string
  /** A model-specific passage matching this covers the topic, so no search runs (FR-001). */
  covers: RegExp
  /** Paths whose passage lists receive the topic's web passages. */
  paths: readonly Path[]
  topic: Passage['topic']
}

export const SEARCH_TOPICS: readonly SearchTopic[] = [
  { id: 'memory', query: 'RAM memory slots maximum memory', covers: /\b(memory|ram|so-?dimm|ddr\d)\b/i, paths: ['upgrade', 'salvage'], topic: 'repair-hardware' },
  { id: 'storage', query: 'SSD storage M.2 NVMe SATA slot', covers: /\b(ssd|solid[- ]state|m\.2|nvme|sata|storage)\b/i, paths: ['upgrade', 'salvage'], topic: 'repair-hardware' },
  { id: 'battery', query: 'battery replacement', covers: /\bbatter(y|ies)\b/i, paths: ['repair'], topic: 'repair-hardware' },
  { id: 'software', query: 'BIOS updates end of support operating system', covers: /\b(bios|firmware|end of support|operating system|windows 1[01])\b/i, paths: ['pass_on', 'upgrade'], topic: 'software-support' },
]

/** Web passages kept per topic, so a few long pages cannot crowd the fact prompt. */
export const MAX_PASSAGES_PER_TOPIC = 3
/** Characters of page text a web passage keeps. */
export const PASSAGE_CHARS = 3000

const COMPANY_SUFFIX = /[\s,]+(inc\.?|corp\.?|corporation|co\.?,? ?ltd\.?|ltd\.?|gmbh|company|computer)$/i

/** Manufacturer as people write it in a query: "Dell Inc." -> "Dell", "LENOVO" stays usable as is. */
export function queryManufacturer(manufacturer: string): string {
  let name = manufacturer.trim()
  while (COMPANY_SUFFIX.test(name)) name = name.replace(COMPANY_SUFFIX, '').trim()
  return name
}

/**
 * Model name without a leading manufacturer word ("HP EliteBook 840 G5" -> "EliteBook 840 G5"),
 * or null when it is unknown or has no digit: a name like "Latitude" alone would match pages
 * about many different models.
 */
export function distinctiveModel(model: ModelMatch): string | null {
  if (!model.model || model.model === 'unknown' || !model.manufacturer || model.manufacturer === 'unknown') return null
  const brand = queryManufacturer(model.manufacturer).toLowerCase()
  const words = model.model.trim().split(/\s+/)
  const rest = words[0]?.toLowerCase() === brand ? words.slice(1) : words
  const name = rest.join(' ')
  return /\d/.test(name) ? name : null
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * FR-003: whether text names the model as a whole token sequence. Spaces, hyphens and underscores
 * between words are interchangeable; nothing alphanumeric may follow, so "T480" never matches "T480s".
 */
export function modelMatcher(name: string): (text: string) => boolean {
  const words = name.normalize('NFKC').toLowerCase().split(/[\s\-_]+/).filter(Boolean).map(escape)
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${words.join('[\\s\\-_]*')}(?![\\p{L}\\p{N}])`, 'u')
  return (text) => pattern.test(text.normalize('NFKC').toLowerCase())
}

/** Topics without a model-specific passage in the corpus retrieval (FR-001). */
export function uncoveredTopics(retrieval: RetrievalResult): SearchTopic[] {
  const modelPassages = PATHS.flatMap((p) => retrieval.passages_by_path[p]).filter((p) => p.applicability.kind === 'model')
  return SEARCH_TOPICS.filter((t) => !modelPassages.some((p) => t.covers.test(p.text) || t.covers.test(p.section ?? '')))
}

/** FR-012: the query is the manufacturer, the model and the topic's words; nothing else from the scan. */
export function topicQuery(model: ModelMatch, name: string, topic: SearchTopic): string {
  return `${queryManufacturer(model.manufacturer)} ${name} ${topic.query}`
}

/** A window of page text, starting shortly before the first mention of the topic (spec pages often open with navigation). */
export function excerpt(text: string, topic: SearchTopic, chars = PASSAGE_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= chars) return clean
  const at = clean.search(topic.covers)
  const start = Math.max(0, Math.min(at - 300, clean.length - chars))
  return clean.slice(start, start + chars)
}

const urlHash = (url: string) => createHash('sha256').update(url).digest('hex').slice(0, 16)

export function webPassage(hit: SearchHit, topic: SearchTopic, model: ModelMatch, retrievedOn: string): Passage {
  const id = `web:${urlHash(hit.url)}`
  const title = hit.title.slice(0, 300)
  return {
    passage_id: `${id}:${topic.id}`,
    document_id: id,
    title,
    url: hit.url,
    publisher: new URL(hit.url).hostname.replace(/^www\./, ''),
    topic: topic.topic,
    // Web pages have no sections or page numbers; the page title stands in (Passage requires one).
    section: title,
    page: null,
    applicability: { kind: 'model', manufacturer: model.manufacturer, model: model.model },
    accessed_on: retrievedOn.slice(0, 10),
    text: excerpt(hit.text, topic),
    source: 'web',
  }
}

export interface WebEvidenceDeps {
  search: SearchProvider
  cache: SearchCache
  budget: SearchBudget
  timeoutMs: number
  resultsPerQuery: number
  maxChars: number
  warn?: (message: string, details?: Record<string, unknown>) => void
}

export interface AugmentOptions {
  /** Called once, before the first provider call (not for cache hits), for the "Searching the web…" line (FR-013). */
  onSearch?: () => void
}

export interface WebEvidence {
  /** The retrieval with web passages added for uncovered topics; unchanged when nothing was found. */
  augment(retrieval: RetrievalResult, model: ModelMatch, options?: AugmentOptions): Promise<RetrievalResult>
}

export function createWebEvidence(deps: WebEvidenceDeps): WebEvidence {
  // Concurrent assessments of the same model share one provider call per topic.
  const inFlight = new Map<string, Promise<{ hits: SearchHit[]; created_at: string } | null>>()

  async function topicHits(key: string, query: string, accept: (h: SearchHit) => boolean, signal: AbortSignal, onSearch: () => void) {
    const cached = deps.cache.get(key)
    if (cached) return cached
    const pending = inFlight.get(key)
    if (pending) return pending
    const run = (async () => {
      if (!deps.budget.reserve()) {
        deps.warn?.('daily web search limit reached; assessing without web evidence')
        return null
      }
      onSearch()
      try {
        const hits = await deps.search.search({ text: query, maxResults: deps.resultsPerQuery, maxChars: deps.maxChars, accept }, signal)
        // Only usable hits are cached, so a later filter change applies after the 30 days.
        return deps.cache.set(key, hits.filter(accept))
      } catch (error) {
        if (!(error instanceof SearchError)) throw error
        // Failures are not cached; the next assessment tries again.
        deps.warn?.('web search failed', { kind: error.kind })
        return null
      }
    })().finally(() => inFlight.delete(key))
    inFlight.set(key, run)
    return run
  }

  return {
    async augment(retrieval, model, options = {}) {
      const name = distinctiveModel(model)
      if (!name) return retrieval
      const topics = uncoveredTopics(retrieval)
      if (topics.length === 0) return retrieval
      const matchesModel = modelMatcher(name)
      const accept = (hit: SearchHit) => matchesModel(hit.title) || matchesModel(hit.text)

      let announced = false
      const onSearch = () => {
        if (!announced) options.onSearch?.()
        announced = true
      }
      // One deadline for the whole phase (FR-010): topics run in parallel and those still open are abandoned.
      const signal = AbortSignal.timeout(deps.timeoutMs)
      const deadline = new Promise<'timeout'>((resolve) => signal.addEventListener('abort', () => resolve('timeout'), { once: true }))
      const found = await Promise.all(
        topics.map(async (topic) => {
          const key = `${model.manufacturer}\u001f${model.model}\u001f${topic.id}`.toLowerCase()
          const result = await Promise.race([topicHits(key, topicQuery(model, name, topic), accept, signal, onSearch), deadline])
          if (result === 'timeout' || result === null) return []
          return result.hits.slice(0, MAX_PASSAGES_PER_TOPIC).map((hit) => webPassage(hit, topic, model, result.created_at))
        }),
      )
      const passages = found.flat()
      if (passages.length === 0) return retrieval

      const passages_by_path = Object.fromEntries(PATHS.map((p) => [p, [...retrieval.passages_by_path[p]]])) as RetrievalResult['passages_by_path']
      for (const passage of passages) {
        const topic = SEARCH_TOPICS.find((t) => passage.passage_id.endsWith(`:${t.id}`))!
        for (const path of topic.paths) passages_by_path[path].push(passage)
      }
      return { ...retrieval, passages_by_path }
    },
  }
}

/**
 * After fact extraction (FR-004, FR-005): keeps only the web passages a kept fact cites, and when
 * the corpus had no model evidence but a kept fact cites a web passage, makes the evidence `web`
 * and drops hardware facts that cite no web passage (they rest on generic passages only).
 */
export function finishWebEvidence(retrieval: RetrievalResult, facts: FactSet): { retrieval: RetrievalResult; facts: FactSet } {
  const all = PATHS.flatMap((p) => retrieval.passages_by_path[p])
  const webIds = new Set(all.filter((p) => p.source === 'web').map((p) => p.passage_id))
  if (webIds.size === 0) return { retrieval, facts }

  const cited = new Set(facts.facts.flatMap((f) => f.source_passage_ids).filter((id) => webIds.has(id)))
  const passages_by_path = Object.fromEntries(
    PATHS.map((p) => [p, retrieval.passages_by_path[p].filter((x) => x.source !== 'web' || cited.has(x.passage_id))]),
  ) as RetrievalResult['passages_by_path']

  if (retrieval.model_evidence !== 'none' || cited.size === 0) return { retrieval: { ...retrieval, passages_by_path }, facts }
  const kept = facts.facts.filter((f) => !HARDWARE_FACTS.has(f.key) || f.source_passage_ids.some((id) => cited.has(id)))
  return { retrieval: { ...retrieval, model_evidence: 'web', passages_by_path }, facts: { ...facts, facts: kept } }
}
