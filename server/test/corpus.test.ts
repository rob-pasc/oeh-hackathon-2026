// The real curated corpus (corpus/, feature 002 AC-008) and retrieval over it.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PATHS, type DeviceScan } from '@leaaf/shared'
import { coverageProblems, createRetriever, DEFAULT_CORPUS_DIR, readCorpus, writeIndex, type Retriever } from '../src/retrieval/index.ts'

const corpus = readCorpus(DEFAULT_CORPUS_DIR)
const base = JSON.parse(readFileSync(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url), 'utf8')) as DeviceScan
const scan = (identity: Partial<DeviceScan['identity']>, cpu: string): DeviceScan => ({
  ...base,
  identity: { ...base.identity, product_version: null, system_family: null, ...identity },
  cpu: { ...base.cpu, name: cpu },
})

// Identity strings as Windows usually reports them; confirm against real scans (T-006).
const demo = {
  t480: scan({ manufacturer: 'LENOVO', model: '20L5CTO1WW', product_version: 'ThinkPad T480' }, 'Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz'),
  xps: scan({ manufacturer: 'Dell Inc.', model: 'XPS 13 9360' }, 'Intel(R) Core(TM) i7-7500U CPU @ 2.70GHz'),
  hp: scan({ manufacturer: 'HP', model: 'HP EliteBook 840 G5' }, 'Intel(R) Core(TM) i5-8350U CPU @ 1.70GHz'),
}
const owner = (documentId: string) => corpus.manifest.documents.find((d) => d.id === documentId)!.applies_to

describe('corpus/manifest.yaml', () => {
  it('is valid, with a terms note on every document (AC-008)', () => {
    // readCorpus throws on any manifest problem, including an empty terms note.
    expect(corpus.documents.length).toBe(corpus.manifest.documents.length)
    for (const d of corpus.manifest.documents) expect(d.terms.trim().length, d.id).toBeGreaterThan(20)
  })

  it('declares the three demo models', () => {
    expect(corpus.manifest.models.filter((m) => m.demo).map((m) => `${m.manufacturer} ${m.model}`)).toEqual([
      'Lenovo ThinkPad T480',
      'Dell XPS 13 9360',
      'HP EliteBook 840 G5',
    ])
  })

  it('covers each demo model, except the known gap for the 7th-gen 840 G5 (AC-008)', () => {
    // No fetched source states Windows 11 support for 7th-gen Intel CPUs either way (HP's own
    // Windows 11 list could not be fetched). Remove this line once a source is added.
    expect(coverageProblems(corpus.manifest, corpus.documents)).toEqual([
      'HP EliteBook 840 G5: no software-support document covers CPU i5-7200U, i5-7300U',
    ])
  })
})

describe('retrieval over the real corpus', () => {
  let retriever: Retriever
  beforeAll(() => {
    const db = new DatabaseSync(':memory:')
    writeIndex(db, corpus)
    retriever = createRetriever(db)
  })
  afterAll(() => retriever.close())

  it.each(Object.entries(demo))('matches %s and returns only its own or generic documents', (_name, device) => {
    const result = retriever.retrieve(device)
    expect(result.model_evidence).toBe('model_specific')
    const model = result.matched_model!
    for (const path of PATHS) {
      expect(result.passages_by_path[path].length, path).toBeGreaterThan(0)
      for (const p of result.passages_by_path[path]) {
        const applies = owner(p.document_id)
        if (applies !== 'generic') expect(applies).toContainEqual(model)
      }
    }
    // The upgrade path starts with the model's own memory and storage documentation.
    expect(result.passages_by_path.upgrade.slice(0, 2).every((p) => p.applicability.kind === 'model')).toBe(true)
  })

  it('returns the vendor Windows 11 list for a demo model and the processor list for an unknown 8th-gen laptop', () => {
    expect(retriever.retrieve(demo.t480).passages_by_path.pass_on.map((p) => p.passage_id)).toContain('lenovo-windows11-upgrade-devices#thinkpad-1')
    expect(retriever.retrieve(demo.xps).passages_by_path.pass_on[0]!.document_id).toBe('dell-windows11-tested-computers')
    const unknown8th = scan({ manufacturer: 'ASUSTeK COMPUTER INC.', model: 'X556UQK' }, 'Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz')
    const result = retriever.retrieve(unknown8th)
    expect(result.model_evidence).toBe('none')
    expect(result.passages_by_path.pass_on[0]!.passage_id).toBe('ms-win11-supported-intel-processors#intel-coretm-8th-generation-1')
  })

  it('does not treat a near-miss variant (T480s) as the T480', () => {
    const t480s = scan({ manufacturer: 'LENOVO', model: '20L7CTO1WW', product_version: 'ThinkPad T480s' }, 'Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz')
    expect(retriever.retrieve(t480s)).toMatchObject({ model_evidence: 'none', matched_model: null })
  })

  it('retrieves all five paths for one device well under 3 seconds', () => {
    const start = performance.now()
    for (const device of Object.values(demo)) retriever.retrieve(device)
    expect((performance.now() - start) / 3).toBeLessThan(3000)
  })
})
