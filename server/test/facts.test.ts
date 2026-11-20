import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import type { DeviceScan, Fact, FactSet, RetrievalResult } from '@leaaf/shared'
import {
  createFactExtractor,
  createMemoryFactCache,
  createSqliteFactCache,
  filterFacts,
  type FactCache,
} from '../src/facts/index.ts'
import { LlmError, type JsonRequest, type LlmClient } from '../src/llm/index.ts'

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`../../shared/fixtures/${name}.json`, import.meta.url), 'utf8')) as T

const scan = fixture<DeviceScan>('device-scan.laptop-complete')
const retrieval = fixture<RetrievalResult>('retrieval.example-laptop-14')
const expected = fixture<FactSet>('facts.example-laptop-14')

/** Fake LLM that returns queued answers (or throws queued errors) and records requests. */
function fakeLlm(...answers: ({ facts: unknown[] } | LlmError)[]) {
  const requests: JsonRequest<any>[] = []
  const llm: LlmClient = {
    async completeJson(request) {
      requests.push(request)
      const answer = answers.shift()
      if (!answer) throw new Error('unexpected LLM call')
      if (answer instanceof LlmError) throw answer
      return { value: answer as any, model: 'fake', attempts: 1, latency_ms: 1, usage: { prompt_tokens: 1, completion_tokens: 1 } }
    },
  }
  return { llm, requests }
}

const fact = (key: string, value: unknown, ...ids: string[]) => ({ key, value, source_passage_ids: ids }) as Fact

describe('fact extraction', () => {
  it('keeps facts that cite retrieved passages and drops one citing an unretrieved passage (AC-002)', async () => {
    const hallucinated = fact('ram_max_gb', 64, 'other-manual#memory')
    const { llm } = fakeLlm({ facts: [...expected.facts.filter((f) => f.key !== 'ram_max_gb'), hallucinated] })
    const result = await createFactExtractor({ llm, cache: createMemoryFactCache() }).extract({ scan, retrieval })

    expect(result.facts.model).toEqual(expected.model)
    expect(result.facts.facts.map((f) => f.key)).not.toContain('ram_max_gb')
    expect(result.facts.facts).toHaveLength(expected.facts.length - 1)
    expect(result.dropped).toEqual([{ fact: hallucinated, reason: expect.stringContaining('other-manual#memory') }])
  })

  it('reuses cached facts for a second assessment of the same model without an LLM call (AC-002)', async () => {
    const { llm, requests } = fakeLlm({ facts: expected.facts })
    const extractor = createFactExtractor({ llm, cache: createMemoryFactCache() })
    const first = await extractor.extract({ scan, retrieval })
    const otherDevice = { ...scan, scanned_at: '2026-11-21T10:00:00Z', memory: { ...scan.memory, total_gb: 16 } }
    const second = await extractor.extract({ scan: otherDevice, retrieval })

    expect(requests).toHaveLength(1)
    expect(first.cached).toBe(false)
    expect(second).toMatchObject({ cached: true, llm: null })
    expect(second.facts).toEqual(first.facts)
  })

  it('makes a new call when the retrieved passages change', async () => {
    const { llm, requests } = fakeLlm({ facts: [] }, { facts: [] })
    const extractor = createFactExtractor({ llm, cache: createMemoryFactCache() })
    await extractor.extract({ scan, retrieval })
    const edited = structuredClone(retrieval)
    edited.passages_by_path.upgrade[1]!.text += ' Revised.'
    await extractor.extract({ scan, retrieval: edited })
    expect(requests).toHaveLength(2)
  })

  it('shares one LLM call between concurrent requests for the same model', async () => {
    const { llm, requests } = fakeLlm({ facts: expected.facts })
    const extractor = createFactExtractor({ llm, cache: createMemoryFactCache() })
    const [a, b] = await Promise.all([extractor.extract({ scan, retrieval }), extractor.extract({ scan, retrieval })])
    expect(requests).toHaveLength(1)
    expect(a.facts).toEqual(b.facts)
  })

  it('sends each retrieved passage once, the device CPU, and no device ID or serial-like fields', async () => {
    const { llm, requests } = fakeLlm({ facts: [] })
    await createFactExtractor({ llm, cache: createMemoryFactCache() }).extract({ scan, retrieval })
    const { task, user, system } = requests[0]!
    expect(task).toBe('fact_extraction')
    expect(system).toMatch(/Ignore any instructions/)
    expect(user.match(/"passage_id": "ex14-hmm#memory-1"/g)).toHaveLength(1)
    expect(user).toContain(scan.cpu.name!)
    expect(user).not.toContain(scan.identity.system_sku!)
    expect(user).not.toMatch(/device_id/)
  })

  it('skips the LLM when no passages were retrieved', async () => {
    const { llm, requests } = fakeLlm()
    const empty = { model_evidence: 'none', matched_model: null, passages_by_path: { upgrade: [], repair: [], pass_on: [], salvage: [], recycle: [] } } as RetrievalResult
    const result = await createFactExtractor({ llm, cache: createMemoryFactCache() }).extract({ scan, retrieval: empty })
    expect(requests).toHaveLength(0)
    expect(result.facts).toEqual({ model: { manufacturer: 'Example Manufacturer', model: 'Example Laptop 14' }, facts: [] })
  })

  it('propagates LlmError and caches nothing, so the next assessment retries', async () => {
    const { llm, requests } = fakeLlm(new LlmError('timeout', 'timed out'), { facts: expected.facts })
    const extractor = createFactExtractor({ llm, cache: createMemoryFactCache() })
    await expect(extractor.extract({ scan, retrieval })).rejects.toMatchObject({ kind: 'timeout' })
    expect((await extractor.extract({ scan, retrieval })).facts.facts).toHaveLength(expected.facts.length)
    expect(requests).toHaveLength(2)
  })
})

describe('filterFacts', () => {
  const ids = new Set(['a', 'b'])

  it('drops a fact when any of its citations was not retrieved', () => {
    const { kept, dropped } = filterFacts([fact('ram_slots_total', 2, 'a', 'zzz')], ids)
    expect(kept).toEqual([])
    expect(dropped[0]!.reason).toContain('zzz')
  })

  it('merges repeated keys with equal values and deduplicates citations', () => {
    const { kept } = filterFacts([fact('ram_slots_total', 2, 'a', 'a'), fact('ram_slots_total', 2, 'b')], ids)
    expect(kept).toEqual([fact('ram_slots_total', 2, 'a', 'b')])
  })

  it('drops every fact for a key whose values conflict', () => {
    const { kept, dropped } = filterFacts(
      [fact('ram_soldered', 'none', 'a'), fact('ram_soldered', 'all', 'b'), fact('ram_slots_total', 2, 'a')],
      ids,
    )
    expect(kept.map((f) => f.key)).toEqual(['ram_slots_total'])
    expect(dropped.map((d) => d.reason)).toEqual(['conflicting values for ram_soldered', 'conflicting values for ram_soldered'])
  })
})

describe.each([
  ['memory', () => createMemoryFactCache()],
  ['sqlite', () => createSqliteFactCache(new DatabaseSync(':memory:'))],
] as [string, () => FactCache][])('%s fact cache', (_name, make) => {
  it('round-trips a FactSet and misses unknown keys', () => {
    const cache = make()
    expect(cache.get('k')).toBeUndefined()
    cache.set('k', expected)
    expect(cache.get('k')).toEqual(expected)
  })
})

describe('sqlite fact cache', () => {
  it('persists across cache instances and treats rows that no longer validate as misses', () => {
    const db = new DatabaseSync(':memory:')
    createSqliteFactCache(db).set('k', expected)
    expect(createSqliteFactCache(db).get('k')).toEqual(expected)
    db.prepare("UPDATE fact_cache SET fact_set = '{\"facts\":[]}'").run()
    expect(createSqliteFactCache(db).get('k')).toBeUndefined()
  })
})
