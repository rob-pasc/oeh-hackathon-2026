import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import { checkPassage, createValidator, PATHS, RetrievalResult, type DeviceScan } from '@leaaf/shared'
import {
  checkManifest,
  chunkMarkdown,
  coverageProblems,
  cpuGenerationTerms,
  cpuModelNumbers,
  createModelMatcher,
  createRetriever,
  ftsQuery,
  ingestCorpus,
  ManifestError,
  normalizeName,
  openRetriever,
  PATH_QUERIES,
  readCorpus,
  writeIndex,
  type Retriever,
} from '../src/retrieval/index.ts'

const FIXTURE_CORPUS = fileURLToPath(new URL('./fixtures/corpus/', import.meta.url))
const baseScan = JSON.parse(readFileSync(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url), 'utf8')) as DeviceScan

const scanFor = (identity: Partial<DeviceScan['identity']>, cpu = 'Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz'): DeviceScan => ({
  ...baseScan,
  identity: { ...baseScan.identity, product_version: null, system_family: null, ...identity },
  cpu: { ...baseScan.cpu, name: cpu },
})
const modelA = scanFor({ manufacturer: 'Acme', model: 'Book 14' })
const unknown = scanFor({ manufacturer: 'Acme', model: 'Book 99' })

function fixtureRetriever(): Retriever {
  const db = new DatabaseSync(':memory:')
  writeIndex(db, readCorpus(FIXTURE_CORPUS))
  return createRetriever(db)
}

/** A copy of the fixture corpus whose manifest documents are rewritten by `edit`. */
function corpusWith(edit: (docs: Record<string, unknown>[]) => void): string {
  const dir = mkdtempSync(join(tmpdir(), 'leaaf-corpus-'))
  cpSync(FIXTURE_CORPUS, dir, { recursive: true })
  const manifest = readCorpus(FIXTURE_CORPUS).manifest as unknown as { documents: Record<string, unknown>[] }
  edit(manifest.documents)
  writeFileSync(join(dir, 'manifest.yaml'), stringify(manifest))
  return dir
}

describe('manifest validation (AC-001)', () => {
  it('rejects the corpus, naming both documents and their missing fields', () => {
    const dir = corpusWith((docs) => {
      delete docs[0]!.terms
      delete docs[2]!.url
    })
    try {
      expect(() => readCorpus(dir)).toThrow(ManifestError)
      let problems: string[] = []
      try {
        readCorpus(dir)
      } catch (e) {
        problems = (e as ManifestError).problems
      }
      expect(problems).toEqual(['document acme-book14-manual: missing terms', 'document os-cpu-list: missing url'])
      // The ingestion command fails as well and leaves no index behind.
      const index = join(dir, 'index.sqlite')
      expect(() => ingestCorpus(dir, index)).toThrow(/acme-book14-manual: missing terms[\s\S]*os-cpu-list: missing url/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('treats an empty terms note as missing', () => {
    const dir = corpusWith((docs) => {
      docs[1]!.terms = ''
    })
    try {
      expect(() => readCorpus(dir)).toThrow('document acme-book15-manual: missing terms')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  const valid = readCorpus(FIXTURE_CORPUS).manifest
  const clone = () => structuredClone(valid) as unknown as Record<string, any>
  it.each([
    ['an unknown topic', (m: any) => (m.documents[0].topic = 'gossip'), 'document acme-book14-manual: /topic'],
    ['an undeclared model', (m: any) => (m.documents[0].applies_to = [{ manufacturer: 'Acme', model: 'Book 16' }]), 'undeclared model Acme Book 16'],
    ['a duplicate id', (m: any) => m.documents.push({ ...m.documents[0] }), 'duplicate id'],
    ['a model without documents', (m: any) => m.models.push({ manufacturer: 'Acme', model: 'Book 16', aliases: [] }), 'Acme Book 16: no document applies to it'],
    ['an alias shared by two models', (m: any) => m.models[1].aliases.push('ab14-2019'), 'model alias "ab14-2019" is used by both'],
    ['a file name not matching the id', (m: any) => (m.documents[0].file = 'docs/other.md'), 'file must be docs/acme-book14-manual.md'],
    ['an invalid access date', (m: any) => (m.documents[0].accessed_on = 'yesterday'), '/accessed_on'],
  ])('rejects %s', (_name, mutate, message) => {
    const m = clone()
    mutate(m)
    expect(checkManifest(m).join('\n')).toContain(message)
  })

  it('accepts the fixture manifest and checks that extract files exist', () => {
    expect(checkManifest(clone(), FIXTURE_CORPUS)).toEqual([])
    const m = clone()
    m.documents[0].id = 'missing-doc'
    m.documents[0].file = 'docs/missing-doc.md'
    expect(checkManifest(m, FIXTURE_CORPUS)).toContain('document missing-doc: file docs/missing-doc.md does not exist')
  })
})

describe('chunking and ingestion (AC-002)', () => {
  it('keeps the section heading and page of each passage', () => {
    const chunks = chunkMarkdown('doc', '# Title\n\n<!-- page: 3 -->\n## Memory\n\nTwo slots.\n\n<!-- page: 4 -->\nUp to 32 GB.\n\n## Battery\n\nGlued.', {
      fallbackSection: 'Doc',
    })
    expect(chunks).toEqual([
      { passage_id: 'doc#memory-1', ord: 0, section: 'Memory', page: 3, text: 'Two slots.' },
      { passage_id: 'doc#memory-2', ord: 1, section: 'Memory', page: 4, text: 'Up to 32 GB.' },
      { passage_id: 'doc#battery-1', ord: 2, section: 'Battery', page: 4, text: 'Glued.' },
    ])
  })

  it('splits long sections at paragraph and sentence boundaries without losing text', () => {
    const sentence = 'The memory module is held by two clips. '
    const paragraph = sentence.repeat(20).trim()
    const chunks = chunkMarkdown('doc', `## Memory\n\n${paragraph}\n\n${paragraph}`, { fallbackSection: 'Doc', maxChars: 300 })
    expect(chunks.length).toBeGreaterThan(2)
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(300)
    expect(chunks.map((c) => c.text).join(' ').replace(/\s+/g, ' ')).toBe(`${paragraph} ${paragraph}`.replace(/\s+/g, ' '))
    expect(new Set(chunks.map((c) => c.passage_id)).size).toBe(chunks.length)
  })

  it('uses the document title as the section for text before any heading or page', () => {
    expect(chunkMarkdown('doc', 'Intro text.', { fallbackSection: 'Doc title' })[0]).toMatchObject({ section: 'Doc title', page: null })
  })

  it('produces identical passages without duplicates when run twice on an unchanged corpus', () => {
    const dir = mkdtempSync(join(tmpdir(), 'leaaf-index-'))
    try {
      const index = join(dir, 'corpus.sqlite')
      const read = () => {
        const db = new DatabaseSync(index, { readOnly: true })
        const rows = db.prepare('SELECT passage_id, section, page, text FROM passages ORDER BY passage_id').all()
        db.close()
        return rows
      }
      const first = ingestCorpus(FIXTURE_CORPUS, index)
      const rowsFirst = read()
      const second = ingestCorpus(FIXTURE_CORPUS, index)
      const rowsSecond = read()
      expect(second).toEqual(first)
      expect(rowsSecond).toEqual(rowsFirst)
      expect(rowsFirst.length).toBe(first.passages)
      expect(new Set(rowsFirst.map((r) => r.passage_id)).size).toBe(rowsFirst.length)
      for (const r of rowsFirst) expect(r.section !== null || r.page !== null).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('model normalization and aliases (AC-003)', () => {
  const match = createModelMatcher(readCorpus(FIXTURE_CORPUS).manifest)
  const id = (manufacturer: string | null, model: string | null, product_version: string | null = null) =>
    scanFor({ manufacturer, model, product_version }).identity

  it('normalizes case, whitespace and Unicode compatibility forms', () => {
    expect(normalizeName('  ThinkPad  T480 ')).toBe('thinkpad t480')
  })

  it.each([
    ['exact names', id('Acme', 'Book 14')],
    ['case and whitespace differences', id('  ACME ', 'book   14')],
    ['a manufacturer alias', id('ACME Corp.', 'Book 14')],
    ['a model alias (machine-type code)', id('Acme', 'ab14-2019')],
    ['a readable name in product_version', id('Acme', 'XYZ123CTO', 'Book 14')],
  ])('matches %s', (_name, identity) => {
    expect(match(identity)).toEqual({ manufacturer: 'Acme', model: 'Book 14' })
  })

  it.each([
    ['a near-miss variant', id('Acme', 'Book 14s')],
    ['a prefix of an alias', id('Acme', 'AB14')],
    ['the right model from another manufacturer', id('Other', 'Book 14')],
    ['a missing manufacturer', id(null, 'Book 14')],
    ['a missing model', id('Acme', null)],
  ])('does not match %s', (_name, identity) => {
    expect(match(identity)).toBeNull()
  })
})

describe('retrieval on the fixture corpus', () => {
  let retriever: Retriever
  beforeAll(() => {
    retriever = fixtureRetriever()
  })
  afterAll(() => retriever.close())
  const isResult = createValidator(RetrievalResult)
  const scans = { modelA, modelB: scanFor({ manufacturer: 'Acme', model: 'AB15-2020' }), unknown }

  it('returns valid results for every fixture device (contract)', () => {
    for (const scan of Object.values(scans)) {
      const result = retriever.retrieve(scan)
      expect(isResult(result)).toMatchObject({ ok: true })
    }
  })

  it('never returns model-B-only passages for model A, and labels generic passages (AC-004)', () => {
    const result = retriever.retrieve(modelA)
    expect(result).toMatchObject({ model_evidence: 'model_specific', matched_model: { manufacturer: 'Acme', model: 'Book 14' } })
    const all = PATHS.flatMap((p) => result.passages_by_path[p])
    expect(all.length).toBeGreaterThan(0)
    expect(all.filter((p) => p.document_id === 'acme-book15-manual')).toEqual([])
    for (const p of all) {
      if (p.document_id === 'acme-book14-manual') expect(p.applicability).toEqual({ kind: 'model', manufacturer: 'Acme', model: 'Book 14' })
      else expect(p.applicability).toEqual({ kind: 'generic' })
    }
    // And the reverse: model B only sees its own manual.
    const b = PATHS.flatMap((p) => retriever.retrieve(scans.modelB).passages_by_path[p])
    expect(b.some((p) => p.document_id === 'acme-book15-manual')).toBe(true)
    expect(b.filter((p) => p.document_id === 'acme-book14-manual')).toEqual([])
  })

  it('marks an unknown model with model_evidence "none" and returns only generic passages (AC-005)', () => {
    for (const scan of [unknown, scanFor({ manufacturer: 'Acme', model: 'Book 14s' }), scanFor({ manufacturer: null, model: null })]) {
      const result = retriever.retrieve(scan)
      expect(result.model_evidence).toBe('none')
      expect(result.matched_model).toBeNull()
      const all = PATHS.flatMap((p) => result.passages_by_path[p])
      expect(all.length).toBeGreaterThan(0)
      for (const p of all) expect(p.applicability).toEqual({ kind: 'generic' })
    }
  })

  it('gives every passage complete citation metadata (AC-006)', () => {
    for (const scan of Object.values(scans)) {
      const result = retriever.retrieve(scan)
      for (const path of PATHS)
        for (const p of result.passages_by_path[path]) {
          for (const field of ['passage_id', 'document_id', 'title', 'url', 'publisher', 'accessed_on', 'text'] as const)
            expect(p[field], `${path} ${p.passage_id} ${field}`).not.toBe('')
          expect(checkPassage(p)).toEqual([])
          expect(p.applicability.kind).toMatch(/^(model|generic)$/)
        }
    }
  })

  it('uses path-specific queries: upgrade and recycle get different passages from suitable topics (AC-007)', () => {
    const { passages_by_path: byPath } = retriever.retrieve(modelA)
    const upgrade = byPath.upgrade
    const recycle = byPath.recycle
    expect(upgrade[0]!.passage_id).not.toBe(recycle[0]!.passage_id)
    expect(upgrade.map((p) => p.passage_id).filter((id) => recycle.some((r) => r.passage_id === id))).toEqual([])
    for (const path of PATHS) for (const p of byPath[path]) expect(PATH_QUERIES[path].topics).toContain(p.topic)
    expect(upgrade[0]!.document_id).toBe('acme-book14-manual')
    expect(upgrade.map((p) => p.section)).toEqual(expect.arrayContaining(['Memory modules', 'Storage drive']))
    expect(recycle.every((p) => p.document_id === 'ewaste-guide' || p.document_id === 'reset-guide')).toBe(true)
    expect(byPath.repair.map((p) => p.section)).toContain('Battery pack')
  })

  it('finds the CPU row of an OS-support list for pass_on', () => {
    const passOn = retriever.retrieve(modelA).passages_by_path.pass_on
    expect(passOn.map((p) => p.passage_id)).toContain('os-cpu-list#intel-8th-generation-1')
  })

  it('leaves out the Windows 11 queries for Macs and Linux machines (feature 007 FR-015)', () => {
    for (const family of ['macos', 'linux'] as const) {
      const scan = { ...modelA, os: { ...modelA.os, family } }
      const ids = Object.values(retriever.retrieve(scan).passages_by_path).flat().map((p) => p.passage_id)
      expect(ids.filter((id) => id.startsWith('os-cpu-list'))).toEqual([])
    }
    const windows = { ...modelA, os: { ...modelA.os, family: 'windows' as const } }
    expect(retriever.retrieve(windows)).toEqual(retriever.retrieve(modelA))
  })

  it('returns at most k passages per path', () => {
    const result = retriever.retrieve(modelA, { k: 1 })
    for (const path of PATHS) expect(result.passages_by_path[path].length).toBeLessThanOrEqual(1)
  })

  it('is deterministic', () => {
    expect(retriever.retrieve(modelA)).toEqual(retriever.retrieve(modelA))
  })
})

describe('index handling', () => {
  it('refuses a missing or empty index with an instruction to ingest', () => {
    expect(() => createRetriever(new DatabaseSync(':memory:'))).toThrow(/corpus:ingest/)
    expect(() => openRetriever(join(tmpdir(), 'leaaf-no-such-dir', 'corpus.sqlite'))).toThrow(/corpus:ingest/)
  })
})

describe('query helpers', () => {
  it.each([
    ['Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz', ['i5-8250U']],
    ['Intel(R) Core(TM) i7-7500U CPU @ 2.70GHz', ['i7-7500U']],
    ['Intel(R) Core(TM) i7 8650U', ['i7-8650U']],
    ['11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz', ['i7-1165G7']],
    ['AMD Ryzen 5 3500U', []],
    [null, []],
  ])('extracts Intel model numbers from %s', (name, expected) => {
    expect(cpuModelNumbers(name)).toEqual(expected)
  })

  it.each([
    ['Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz', ['8th generation']],
    ['Intel(R) Core(TM) i7-7500U CPU @ 2.70GHz', ['7th generation']],
    ['11th Gen Intel(R) Core(TM) i7-1165G7 @ 2.80GHz', ['11th generation']],
    ['Intel(R) Core(TM) i3-2310M', ['2nd generation']],
    ['AMD Ryzen 5 3500U', []],
  ])('derives the Intel Core generation of %s', (name, expected) => {
    expect(cpuGenerationTerms(name)).toEqual(expected)
  })

  it('turns a trailing * into an FTS5 prefix query', () => {
    expect(ftsQuery(['elektroaltger*', 'akku'])).toBe('"elektroaltger"* OR "akku"')
  })

  it('quotes every term so FTS5 operators in terms are inert', () => {
    expect(ftsQuery(['m.2', 'say "hi"', 'NOT'])).toBe('"m.2" OR "say ""hi""" OR "NOT"')
  })
})

describe('coverage check (AC-008 logic)', () => {
  it('passes on the fixture corpus and reports missing sources', () => {
    const corpus = readCorpus(FIXTURE_CORPUS)
    expect(coverageProblems(corpus.manifest, corpus.documents)).toEqual([])
    const manifest = structuredClone(corpus.manifest)
    manifest.models[0]!.cpus = ['i5-8250U', 'i7-7500U']
    manifest.models[1]!.demo = true
    expect(coverageProblems(manifest, corpus.documents)).toEqual([
      'Acme Book 14: no software-support document covers CPU i7-7500U',
      'Acme Book 15: no model-specific software-support document and no cpus listed to check a generic one',
    ])
  })
})
