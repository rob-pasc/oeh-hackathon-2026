// Live category call for the three demo models (feature 008 T-009, AC-016):
// `npm run categories:smoke -w server`. Needs server/.env with LLM_API_KEY and the retrieval index
// (`npm run corpus:ingest -w server`). Never prints the API key.
//
// No real scans of the demo models exist yet, so each scan is the fictional example laptop with the
// model's identity and typical hardware (RAM soldering, battery wear) filled in. Results print as a
// list per model, followed by the AC-016 checks: no owner battery work, and no fitting RAM option
// on the XPS 13 9360, whose memory is soldered.
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { CategoryResult, DeviceRecord, DeviceScan, IntendedUse } from '@leaaf/shared'
import { createAssessmentService, loadWeights } from '../src/assessment/index.ts'
import { createCategoryService } from '../src/categories/index.ts'
import { createFactExtractor, createMemoryFactCache } from '../src/facts/index.ts'
import { loadImpactTable } from '../src/impact/table.ts'
import { createOpenAiCompatibleClient, loadLlmConfig } from '../src/llm/index.ts'
import { DEFAULT_CORPUS_INDEX_PATH, openRetriever } from '../src/retrieval/index.ts'

const base = JSON.parse(
  readFileSync(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url), 'utf8'),
) as DeviceScan

function demoScan(identity: Partial<DeviceScan['identity']>, cpu: string, memory: Partial<DeviceScan['memory']>, battery: number): DeviceScan {
  return {
    ...base,
    identity: { ...base.identity, ...identity, system_family: null, system_sku: null },
    cpu: { ...base.cpu, name: cpu },
    memory: { ...base.memory, ...memory },
    storage: [{ media: 'ssd', bus: 'nvme', capacity_gb: 256, health: 'healthy' }],
    battery: { ...base.battery, health_percent: battery, full_charge_capacity_mwh: Math.round(base.battery.design_capacity_mwh! * battery / 100) },
  } as DeviceScan
}

const MODELS: { name: string; scan: DeviceScan }[] = [
  {
    name: 'ThinkPad T480',
    scan: demoScan({ manufacturer: 'LENOVO', model: '20L5CTO1WW', product_version: 'ThinkPad T480' }, 'Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz', { total_gb: 8, type: 'ddr4', slots_total: 2, slots_used: 1 }, 64),
  },
  {
    name: 'XPS 13 9360',
    scan: demoScan({ manufacturer: 'Dell Inc.', model: 'XPS 13 9360', product_version: null }, 'Intel(R) Core(TM) i5-7200U CPU @ 2.50GHz', { total_gb: 8, type: 'lpddr3', slots_total: 0, slots_used: 0 }, 58),
  },
  {
    name: 'EliteBook 840 G5',
    scan: demoScan({ manufacturer: 'HP', model: 'HP EliteBook 840 G5', product_version: null }, 'Intel(R) Core(TM) i5-8350U CPU @ 1.70GHz', { total_gb: 8, type: 'ddr4', slots_total: 2, slots_used: 1 }, 70),
  },
]

const use: IntendedUse = 'office'
const config = loadLlmConfig()
const llm = createOpenAiCompatibleClient(config)
const impactTable = loadImpactTable()
const assessments = createAssessmentService({
  retriever: openRetriever(DEFAULT_CORPUS_INDEX_PATH),
  extractor: createFactExtractor({ llm, cache: createMemoryFactCache() }),
  impactTable,
  weights: loadWeights(),
  warn: (message) => console.warn(`  warning: ${message}`),
})
const warnings: string[] = []
const categorize = createCategoryService(new DatabaseSync(':memory:'), llm, { impactTable, warn: (m) => warnings.push(m) })

const findings: string[] = []
for (const [index, { name, scan }] of MODELS.entries()) {
  // Each model needs its own device ID: results are cached per device and use.
  const record: DeviceRecord = { device_id: `demo${index}`.padEnd(22, 'A'), created_at: new Date().toISOString(), scan }
  const input = await assessments.assessDevice(record, use)
  const started = performance.now()
  const result: CategoryResult = await categorize(scan, input)
  console.log(`\n${name} (${use}): ${result.source}, ${Math.round(performance.now() - started)} ms, model evidence ${input.assessment.model_evidence}`)
  if (result.notice) console.log(`  notice: ${result.notice}`)
  for (const c of result.categories) {
    console.log(`  [${c.label}] ${c.summary}`)
    for (const o of c.options)
      console.log(`    - ${o.title} | ${o.status} | ${o.kind} | ${o.difficulty} | ${o.impact_source ?? 'no figures'}${o.scores ? ` | feas ${o.scores.feasibility}` : ''}\n      ${o.reason}`)
  }
  const options = result.categories.flatMap((c) => c.options)
  const ownerBattery = options.filter((o) => o.kind === 'battery' && o.status !== 'not_suitable' && o.difficulty !== 'professional')
  for (const o of ownerBattery) findings.push(`${name}: owner battery work offered: "${o.title}" (${o.status}, ${o.difficulty})`)
  if (name === 'XPS 13 9360')
    for (const o of options.filter((o) => o.kind === 'ram' && o.status !== 'not_suitable'))
      findings.push(`${name}: RAM option offered on soldered memory: "${o.title}" (${o.status})`)
}
for (const w of warnings) console.log(`warning: ${w}`)
console.log(`\nAC-016 checks: ${findings.length === 0 ? 'no findings' : `${findings.length} finding(s)`}`)
for (const f of findings) console.log(`  ${f}`)
if (findings.length > 0) process.exitCode = 1
