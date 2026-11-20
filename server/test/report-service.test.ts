import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { checkReport, createValidator, rankPaths, Report, type Assessment, type DeviceScan, type FactSet, type RetrievalResult } from '@leaaf/shared'
import { afterEach, expect, it, vi } from 'vitest'
import type { LlmClient } from '../src/llm/index.ts'
import { createReportService } from '../src/report/service.ts'

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`../../shared/fixtures/${name}.json`, import.meta.url), 'utf8'))

const scan = fixture<DeviceScan>('device-scan.laptop-complete')
const assessment = fixture<Assessment>('assessment.example-laptop-14.office')
const facts = fixture<FactSet>('facts.example-laptop-14')
const retrieval = fixture<RetrievalResult>('retrieval.example-laptop-14')
const input = { assessment, facts, retrieval }
const sample = fixture<Report>('report.example-laptop-14.office')
const databases: DatabaseSync[] = []
afterEach(() => { for (const db of databases.splice(0)) db.close() })

function setup() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  const paths = Object.fromEntries(structuredClone(sample.paths).map(({ path, ...fields }) => [path, fields]))
  const completeJson = vi.fn(async () => ({ paths }))
  const llm: LlmClient = {
    async completeJson(request) {
      expect(request.task).toBe('explanation')
      const checked = createValidator(request.schema)(await completeJson())
      if (!checked.ok) throw new Error('Invalid mocked output')
      return { value: checked.value, attempts: 1, model: 'fake', latency_ms: 0, usage: { prompt_tokens: 0, completion_tokens: 0 } }
    },
  }
  return { db, paths, llm, completeJson, explain: createReportService(db, llm) }
}

it('drops unknown and mixed citations and filters figures from every generated section', async () => {
  const { explain, paths } = setup()
  const passage = retrieval.passages_by_path.upgrade[0]!
  const supported = { text: 'Supports up to 32 GB. See the calculator for CO₂e.', passage_ids: [passage.passage_id] }
  Object.assign(paths.upgrade!, {
    summary: 'Saves 250 kg CO₂e.', why: 'Costs EUR50.', next_steps: ['Pay €40.'],
    safety: ['Budget 45 euros.'], assumptions: ['CO2e savings of 250 kg.'], unverified: ['Under €100.'],
    claims: [supported, { text: 'Unverified', passage_ids: [passage.passage_id, 'unknown'] },
      { text: 'Costs 5 EUR', passage_ids: [passage.passage_id] }],
  })
  const report = await explain(scan, input)
  expect(createValidator(Report)(report).ok).toBe(true)
  expect(checkReport(report)).toEqual([])
  const path = report.paths.find(p => p.path === 'upgrade')!
  expect(path).toMatchObject({ claims: [supported], next_steps: [], safety: [], assumptions: [], unverified: [] })
  expect(path.summary).not.toContain('250')
  expect(path.why).not.toContain('50')
  expect(report.passages).toContainEqual(passage)
})

it('shares concurrent requests, reopens from SQLite across modes, and isolates devices and uses', async () => {
  const { db, llm, completeJson, explain } = setup()
  const [first, concurrent] = await Promise.all([explain(scan, input), explain(scan, input)])
  expect(concurrent).toEqual(first)
  for (const weights of Object.values(assessment.weights)) {
    rankPaths(assessment.paths, weights)
    expect(await createReportService(db, llm)(scan, input)).toEqual(first)
  }
  expect(completeJson).toHaveBeenCalledTimes(1)
  await explain(scan, { ...input, assessment: { ...assessment, intended_use: 'gaming' } })
  await explain(scan, { ...input, assessment: { ...assessment, device_id: 'AAAAAAAAAAAAAAAAAAAAAA' } })
  expect(completeJson).toHaveBeenCalledTimes(3)
})

it('retries a failed generation on the next request', async () => {
  const { explain, completeJson } = setup()
  completeJson.mockRejectedValueOnce(new Error('unavailable'))
  await expect(explain(scan, input)).rejects.toThrow('unavailable')
  expect((await explain(scan, input)).source).toBe('llm')
  expect(completeJson).toHaveBeenCalledTimes(2)
})
