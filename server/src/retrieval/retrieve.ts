// Model-aware retrieval (feature 002 FR-004 to FR-008).
//
// For each path: filter by applicability and topic in SQL first (generic documents, plus
// documents for the exact matched model), then rank the remaining passages with BM25 over a
// path-specific keyword query. Model-specific passages can therefore only come from documents
// for that exact model. Ranking is keyword-only by decision (PLAN.md, T-002): the corpus is
// small and the metadata filter does most of the work.
import { DatabaseSync } from 'node:sqlite'
import { PATHS, type DeviceScan, type ModelMatch, type Passage, type Path, type RetrievalResult } from '@leaaf/shared'
import { INDEX_SCHEMA_VERSION } from './ingest.ts'
import { createModelMatcher, type ModelMatcher } from './normalize.ts'

type Topic = Passage['topic']

interface PathQuery {
  /** Topics whose documents may serve this path (AC-007). */
  topics: readonly Topic[]
  /** Keywords and phrases; any one may match. English and German, since some sources are Austrian. */
  terms: readonly string[]
  /** Whether the device's CPU model number is added, so OS-support lists return its row. */
  cpu: boolean
}

/** Path-specific queries (FR-008). Changing them changes which passages each path cites. */
export const PATH_QUERIES: Record<Path, PathQuery> = {
  upgrade: {
    topics: ['repair-hardware', 'software-support'],
    terms: ['memory', 'ram', 'sodimm', 'so-dimm', 'dimm', 'slot', 'soldered', 'onboard', 'maximum', 'ddr4', 'lpddr3',
      'ssd', 'solid-state drive', 'storage', 'm.2', 'nvme', 'pcie', 'sata', 'hard drive', 'upgrade', 'windows 11'],
    cpu: true,
  },
  repair: {
    topics: ['repair-hardware', 'circular-economy'],
    terms: ['battery', 'replace', 'replacement', 'remove', 'removal', 'keyboard', 'display', 'screen', 'fan', 'repair',
      'spare part', 'part number', 'fru', 'cru', 'customer replaceable', 'service provider', 'reparatur', 'reparaturbonus'],
    cpu: false,
  },
  pass_on: {
    topics: ['software-support', 'circular-economy'],
    terms: ['windows 11', 'supported', 'processor', 'tpm', 'secure boot', 'end of support', 'security updates',
      'extended security updates', 'reset', 'remove everything', 'personal files', 'donate', 'reuse', 'second-hand', 'refurbish'],
    cpu: true,
  },
  salvage: {
    topics: ['repair-hardware', 'circular-economy', 'environmental'],
    terms: ['remove', 'removal', 'disconnect', 'memory', 'ssd', 'solid-state drive', 'battery', 'display', 'spare part',
      'reuse', 'components', 'disassembly', 'electrostatic', 'caution', 'warning'],
    cpu: false,
  },
  recycle: {
    topics: ['environmental', 'circular-economy'],
    terms: ['recycle', 'recycling', 'e-waste', 'weee', 'collection', 'collected', 'take back', 'lithium', 'batteries',
      'disposal', 'household waste', 'hazardous', 'raw materials', 'elektroaltgeräte', 'sammelstelle', 'altstoffsammelzentrum',
      'rückgabe', 'entsorgung'],
    cpu: false,
  },
}

/** Default passages per path (open question in the plan, proposed default 4). */
export const DEFAULT_K = 4

/**
 * Model-specific passages rank above equally relevant generic ones: BM25 scores are negative
 * (lower is better), so they are multiplied by this factor.
 */
export const MODEL_SPECIFIC_BOOST = 1.5

/** Intel model numbers as written in OS-support lists, e.g. "Core(TM) i5-8250U CPU" -> "i5-8250U". */
export function cpuModelNumbers(cpuName: string | null): string[] {
  if (!cpuName) return []
  return [...new Set([...cpuName.matchAll(/\b(i[3579]|m[357]|pentium|celeron)[\s-]+(\d{4,5}[a-z]{0,2})\b/gi)].map((m) => `${m[1]}-${m[2]}`))]
}

/** FTS5 query: every term as a quoted phrase, joined with OR. Quotes inside terms are escaped. */
export function ftsQuery(terms: readonly string[]): string {
  return terms.map((t) => `"${t.replaceAll('"', '""')}"`).join(' OR ')
}

interface Row {
  passage_id: string
  document_id: string
  section: string | null
  page: number | null
  text: string
  title: string
  url: string
  publisher: string
  topic: Topic
  accessed_on: string
  generic: number
  score: number
}

export interface RetrieveOptions {
  k?: number
}

export interface Retriever {
  /** The canonical model the device matches, or null (FR-004). */
  matchModel: ModelMatcher
  retrieve(scan: DeviceScan, options?: RetrieveOptions): RetrievalResult
  close(): void
}

export class IndexError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IndexError'
  }
}

export function createRetriever(db: DatabaseSync): Retriever {
  let version: { value: string } | undefined
  try {
    version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string } | undefined
  } catch {
    throw new IndexError('the corpus index is missing or empty; run `npm run corpus:ingest -w server`')
  }
  if (version?.value !== INDEX_SCHEMA_VERSION)
    throw new IndexError(`corpus index schema ${version?.value ?? 'unknown'} is not ${INDEX_SCHEMA_VERSION}; re-run ingestion`)

  const manufacturers = db.prepare('SELECT spelling, name FROM manufacturer_names').all() as { spelling: string; name: string }[]
  const models = db.prepare('SELECT manufacturer, spelling, model FROM model_names').all() as { manufacturer: string; spelling: string; model: string }[]
  // Spellings are stored normalized, so they can be fed back in as aliases of their canonical name.
  const matchModel = createModelMatcher({
    manufacturers: [...new Set(manufacturers.map((m) => m.name))].map((name) => ({
      name,
      aliases: manufacturers.filter((m) => m.name === name).map((m) => m.spelling),
    })),
    models: models.map((m) => ({ manufacturer: m.manufacturer, model: m.model, aliases: [m.spelling] })),
  })

  const search = db.prepare(`
    SELECT p.passage_id, p.document_id, p.section, p.page, p.text,
           d.title, d.url, d.publisher, d.topic, d.accessed_on, d.generic,
           bm25(passages_fts, 2.0, 1.0) AS score
    FROM passages_fts
    JOIN passages p ON p.rowid = passages_fts.rowid
    JOIN documents d ON d.id = p.document_id
    WHERE passages_fts MATCH :query
      AND d.topic IN (SELECT value FROM json_each(:topics))
      AND (d.generic = 1 OR EXISTS (
        SELECT 1 FROM document_models m
        WHERE m.document_id = d.id AND m.manufacturer = :manufacturer AND m.model = :model))
  `)

  const toPassage = (row: Row, model: ModelMatch | null): Passage => ({
    passage_id: row.passage_id,
    document_id: row.document_id,
    title: row.title,
    url: row.url,
    publisher: row.publisher,
    topic: row.topic,
    section: row.section,
    page: row.page,
    // A non-generic row can only have passed the filter for the matched model.
    applicability: row.generic === 1 || !model ? { kind: 'generic' } : { kind: 'model', manufacturer: model.manufacturer, model: model.model },
    accessed_on: row.accessed_on,
    text: row.text,
  })

  function forPath(path: Path, scan: DeviceScan, model: ModelMatch | null, k: number): Passage[] {
    const q = PATH_QUERIES[path]
    const terms = q.cpu ? [...q.terms, ...cpuModelNumbers(scan.cpu.name)] : q.terms
    const rows = search.all({
      query: ftsQuery(terms),
      topics: JSON.stringify(q.topics),
      manufacturer: model?.manufacturer ?? null,
      model: model?.model ?? null,
    }) as unknown as Row[]
    const adjusted = (r: Row) => (r.generic === 1 ? r.score : r.score * MODEL_SPECIFIC_BOOST)
    rows.sort((a, b) => adjusted(a) - adjusted(b) || a.passage_id.localeCompare(b.passage_id))
    return rows.slice(0, k).map((r) => toPassage(r, model))
  }

  return {
    matchModel,
    retrieve(scan, options = {}) {
      const k = options.k ?? DEFAULT_K
      const model = matchModel(scan.identity)
      const passages_by_path = Object.fromEntries(PATHS.map((path) => [path, forPath(path, scan, model, k)])) as RetrievalResult['passages_by_path']
      // Every declared model has at least one document (manifest check), so a match means model evidence exists.
      return { model_evidence: model ? 'model_specific' : 'none', matched_model: model, passages_by_path }
    },
    close: () => db.close(),
  }
}

export function openRetriever(indexPath: string): Retriever {
  let db: DatabaseSync
  try {
    db = new DatabaseSync(indexPath, { readOnly: true })
  } catch {
    throw new IndexError(`cannot open the corpus index at ${indexPath}; run \`npm run corpus:ingest -w server\``)
  }
  return createRetriever(db)
}
