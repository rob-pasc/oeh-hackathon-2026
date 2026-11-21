// Model-aware retrieval (feature 002 FR-004 to FR-008).
//
// For each path: filter by applicability and topic in SQL first (generic documents, plus
// documents for the exact matched model), then rank the remaining passages with BM25 over the
// path's keyword facets and interleave the facets' results. Model-specific passages can therefore only come from documents
// for that exact model. Ranking is keyword-only by decision (PLAN.md, T-002): the corpus is
// small and the metadata filter does most of the work.
import { DatabaseSync } from 'node:sqlite'
import { PATHS, usesWindowsRules, type DeviceScan, type ModelMatch, type Passage, type Path, type RetrievalResult } from '@leaaf/shared'
import { INDEX_SCHEMA_VERSION } from './ingest.ts'
import { createModelMatcher, type ModelMatcher } from './normalize.ts'

type Topic = Passage['topic']

/**
 * One aspect of a path, e.g. memory for upgrade. Facets are searched separately and their results
 * interleaved, so one aspect with many matching words cannot crowd out the others in the top k.
 */
interface Facet {
  name: string
  /**
   * Keywords and phrases; any one may match. A trailing `*` makes a prefix term, needed for
   * German compounds ("elektroaltger*" finds "Elektroaltgeräten"), which the English stemmer misses.
   */
  terms: readonly string[]
  /**
   * Device facet: a passage must match one of `terms` AND name the device, by its matched model
   * (vendor support lists, "T480") or its Intel CPU model number or generation (Microsoft's list,
   * "8th Generation"). Without the AND, short passages that merely repeat the model name win.
   * Skipped when the device offers no such terms.
   */
  device?: boolean
  /** Narrows the path's topics for this facet. */
  topics?: readonly Topic[]
}

interface PathQuery {
  /** Topics whose documents may serve this path (AC-007). */
  topics: readonly Topic[]
  facets: readonly Facet[]
}

const WINDOWS_11_TERMS = ['windows 11', 'supported processors', 'upgrade to windows 11', 'tpm 2.0', 'pc health check']

/** Whether Windows 11 supports this device: vendor lists and the processor list. */
const WINDOWS_11_DEVICE: Facet = { name: 'windows-11-device', terms: WINDOWS_11_TERMS, device: true, topics: ['software-support'] }
/** General Windows 11 requirements, for any device. */
const WINDOWS_11: Facet = { name: 'windows-11', terms: WINDOWS_11_TERMS, topics: ['software-support'] }
const WINDOWS_11_FACETS: ReadonlySet<Facet> = new Set([WINDOWS_11_DEVICE, WINDOWS_11])

/** Path-specific queries (FR-008). Changing them changes which passages each path cites. */
export const PATH_QUERIES: Record<Path, PathQuery> = {
  upgrade: {
    topics: ['repair-hardware', 'software-support'],
    facets: [
      { name: 'memory', terms: ['memory', 'ram', 'sodimm', 'so-dimm', 'dimm', 'memory slot', 'soldered', 'onboard memory', 'ddr4', 'lpddr3'] },
      { name: 'storage', terms: ['ssd', 'solid-state drive', 'storage', 'm.2', 'nvme', 'pcie', 'sata', 'hard drive', 'hard disk'] },
      WINDOWS_11_DEVICE,
      WINDOWS_11,
    ],
  },
  repair: {
    topics: ['repair-hardware', 'circular-economy'],
    facets: [
      { name: 'battery', terms: ['battery', 'batteries', 'replace the battery', 'removing the battery', 'built-in battery', 'removable battery'] },
      { name: 'parts', terms: ['cru', 'fru', 'customer replaceable', 'self-service', 'service provider', 'spare part', 'keyboard', 'display', 'lcd', 'fan'] },
      { name: 'support', terms: ['repair', 'reparatur*', 'geräte-retter*', 'förderung', 'bonus', 'right to repair'] },
    ],
  },
  pass_on: {
    topics: ['software-support', 'circular-economy'],
    facets: [
      WINDOWS_11_DEVICE,
      { name: 'updates', terms: ['end of support', 'security updates', 'extended security updates', 'esu', 'bios', 'firmware', 'sicherheitsupdates'] },
      { name: 'wipe', terms: ['reset this pc', 'remove everything', 'clean data', 'personal files', 'recovery'] },
      { name: 'reuse', terms: ['donate', 'donation', 'reuse', 'refurbish*', 'second-hand', 'spenden', 'gebraucht*'] },
    ],
  },
  salvage: {
    topics: ['repair-hardware', 'circular-economy', 'environmental'],
    facets: [
      { name: 'components', terms: ['removing the memory', 'memory module', 'removing the solid-state drive', 'solid-state drive', 'ssd', 'remove'] },
      { name: 'safety', terms: ['caution', 'warning', 'electrostatic', 'esd', 'disconnect the battery', 'swollen', 'lithium'] },
      { name: 'reuse', terms: ['spare part', 'reuse', 'components', 'parts', 'wiederverwend*', 'ersatzteil*'] },
    ],
  },
  recycle: {
    topics: ['environmental', 'circular-economy'],
    facets: [
      { name: 'collection', terms: ['collection point', 'take back', 'free of charge', 'weee', 'elektroaltger*', 'sammelstelle*', 'altstoffsammel*', 'rücknahme*', 'kostenlos*', 'abgabe*'] },
      { name: 'batteries', terms: ['lithium', 'batteries', 'household waste', 'fire', 'akku*', 'batterie*', 'brand*'] },
      { name: 'materials', terms: ['recycle', 'recycling', 'e-waste', 'raw materials', 'hazardous', 'recovered', 'verwertung'] },
    ],
  },
}

/** Default passages per path. 5 rather than the proposed 4, so a path with four facets still gets a second Windows 11 passage (see PLAN.md). */
export const DEFAULT_K = 5

/**
 * Model-specific passages rank above equally relevant generic ones: BM25 scores are negative
 * (lower is better), so they are multiplied by this factor.
 */
export const MODEL_SPECIFIC_BOOST = 1.5

/** Intel model numbers as written in OS-support lists, e.g. "Core(TM) i5-8250U CPU" -> "i5-8250U". */
export function cpuModelNumbers(cpuName: string | null): string[] {
  if (!cpuName) return []
  return [...new Set([...cpuName.matchAll(/\b(i[3579]|m[357]|pentium|celeron)[\s-]+(\d{4,5}[a-z]{0,2}\d?)\b/gi)].map((m) => `${m[1]}-${m[2]}`))]
}

const ordinal = (n: number) => {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

/**
 * Intel Core generation phrases, e.g. "i5-8250U" -> "8th generation", "i7-1165G7" -> "11th generation".
 * Microsoft's Windows 11 processor list names generations, not model numbers, so this is what
 * finds the device's row there.
 */
export function cpuGenerationTerms(cpuName: string | null): string[] {
  if (!cpuName) return []
  const generations = [...cpuName.matchAll(/\bi[3579][\s-]+(\d{4,5})[a-z]{0,2}\d?\b/gi)].map((m) => {
    const digits = m[1]!
    // 2nd to 9th generation numbers start with the generation digit; 10th and later start with "1x".
    return Number(digits.startsWith('1') ? digits.slice(0, 2) : digits.slice(0, 1))
  })
  return [...new Set(generations)].map((g) => `${ordinal(g)} generation`)
}

/**
 * FTS5 query: every term as a quoted phrase, joined with OR, so FTS5 operators inside terms are
 * inert. A trailing `*` becomes a prefix query on the last token.
 */
export function ftsQuery(terms: readonly string[]): string {
  return terms
    .map((t) => {
      const prefix = t.endsWith('*')
      const phrase = `"${(prefix ? t.slice(0, -1) : t).replaceAll('"', '""')}"`
      return prefix ? `${phrase}*` : phrase
    })
    .join(' OR ')
}

/** The matched model's name and, without its brand word, the short form vendor lists use ("T480"). */
export function modelTerms(model: ModelMatch | null): string[] {
  if (!model) return []
  const short = model.model.split(' ').slice(1).join(' ')
  return [...new Set([model.model, ...(short ? [short] : [])])]
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
           bm25(passages_fts, 0.5, 2.0, 1.0) AS score
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

  function facetRows(facet: Facet, topics: readonly Topic[], scan: DeviceScan, model: ModelMatch | null): Row[] {
    let query = ftsQuery(facet.terms)
    if (facet.device) {
      const deviceTerms = [...cpuModelNumbers(scan.cpu.name), ...cpuGenerationTerms(scan.cpu.name), ...modelTerms(model)]
      if (deviceTerms.length === 0) return []
      query = `(${query}) AND (${ftsQuery(deviceTerms)})`
    }
    const rows = search.all({
      query,
      topics: JSON.stringify(topics),
      manufacturer: model?.manufacturer ?? null,
      model: model?.model ?? null,
    }) as unknown as Row[]
    const adjusted = (r: Row) => (r.generic === 1 ? r.score : r.score * MODEL_SPECIFIC_BOOST)
    return rows.sort((a, b) => adjusted(a) - adjusted(b) || a.passage_id.localeCompare(b.passage_id))
  }

  /** Takes the best unused passage of each facet in turn until k passages are chosen. */
  function forPath(path: Path, scan: DeviceScan, model: ModelMatch | null, k: number): Passage[] {
    const { topics } = PATH_QUERIES[path]
    // Macs and Linux machines do not depend on Windows 11 support (feature 007 FR-015).
    const facets = PATH_QUERIES[path].facets.filter((f) => usesWindowsRules(scan) || !WINDOWS_11_FACETS.has(f))
    const ranked = facets.map((f) => facetRows(f, f.topics?.filter((t) => topics.includes(t)) ?? topics, scan, model))
    const chosen = new Map<string, Row>()
    for (let depth = 0; chosen.size < k && ranked.some((rows) => rows.length > depth); depth++)
      for (const rows of ranked) {
        const row = rows.slice(depth).find((r) => !chosen.has(r.passage_id))
        if (row && chosen.size < k) chosen.set(row.passage_id, row)
      }
    return [...chosen.values()].map((r) => toPassage(r, model))
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
