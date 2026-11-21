// Live step calls for the three demo models (feature 009 T-009, AC-015):
// `npm run steps:smoke -w server`. Needs server/.env with LLM_API_KEY and the retrieval index
// (`npm run corpus:ingest -w server`). Never prints the API key.
//
// For each model on synthetic scans (scripts/demo-scans.ts), it makes the category call, then the
// step call for every option, and prints each plan. The review itself is manual: the plans must be
// concrete and ordered, and internal battery work must be `professional`. The script lists
// candidates to look at: battery plans without a professional step, and general steps that name
// tools, parts or internal components, which may be technical steps marked general to avoid removal.
//
// With `-- --plan` (feature 014 AC-008) it skips the option plans and makes only the plan step call for
// each model whose categories carry a plan, printing the one list for the whole plan.
import { DatabaseSync } from 'node:sqlite'
import type { DeviceRecord, IntendedUse, StepPlan } from '@leaaf/shared'
import { createAssessmentService, loadWeights } from '../src/assessment/index.ts'
import { createCategoryService } from '../src/categories/index.ts'
import { createFactExtractor, createMemoryFactCache } from '../src/facts/index.ts'
import { loadImpactTable } from '../src/impact/table.ts'
import { createOpenAiCompatibleClient, loadLlmConfig } from '../src/llm/index.ts'
import { DEFAULT_CORPUS_INDEX_PATH, openRetriever } from '../src/retrieval/index.ts'
import { createStepService } from '../src/steps/index.ts'
import { MODELS } from './demo-scans.ts'

const INTERNAL = /screwdriver|bottom cover|base cover|back cover|motherboard|system board|so-?dimm|m\.2|ribbon|connector|unscrew|pry/i

const use: IntendedUse = 'office'
const planOnly = process.argv.includes('--plan')
const config = loadLlmConfig()
const llm = createOpenAiCompatibleClient(config)
const impactTable = loadImpactTable()
const retriever = openRetriever(DEFAULT_CORPUS_INDEX_PATH)
const assessments = createAssessmentService({
  retriever,
  extractor: createFactExtractor({ llm, cache: createMemoryFactCache() }),
  impactTable,
  weights: loadWeights(),
  warn: (message) => console.warn(`  warning: ${message}`),
})
const warnings: string[] = []
const warn = (message: string) => warnings.push(message)
const db = new DatabaseSync(':memory:')
const categorize = createCategoryService(db, llm, { impactTable, warn })
const steps = createStepService(db, llm, { retriever, assessments, shownCategories: categorize.shown, warn })

function print(plan: StepPlan, ms: number) {
  console.log(`      ${plan.source}, ${ms} ms, ${plan.steps.length} step(s)${plan.notice ? ` | ${plan.notice}` : ''}`)
  for (const [i, s] of plan.steps.entries()) {
    const needs = [s.tools.length ? `tools: ${s.tools.join(', ')}` : '', s.parts.length ? `parts: ${s.parts.join(', ')}` : '', s.minutes ? `${s.minutes.low}-${s.minutes.high} min` : '']
      .filter(Boolean)
      .join(' | ')
    console.log(`      ${i + 1}. ${s.title} [${s.kind}, ${s.safety}${s.passage_ids.length ? `, cites ${s.passage_ids.join(' ')}` : ''}]`)
    console.log(`         ${s.detail}${s.warning ? `\n         warning: ${s.warning}` : ''}${needs ? `\n         ${needs}` : ''}`)
  }
}

const candidates: string[] = []
for (const [index, { name, scan }] of MODELS.entries()) {
  // Each model needs its own device ID: results are cached per device and use.
  const record: DeviceRecord = { device_id: `demo${index}`.padEnd(22, 'A'), created_at: new Date().toISOString(), scan }
  const input = await assessments.assessDevice(record, use)
  const categories = await categorize(scan, input)
  console.log(`\n${name} (${use}): categories ${categories.source}, model evidence ${input.assessment.model_evidence}`)
  if (categories.plan) {
    console.log(`  PLAN: ${categories.plan.steps.map((s) => `${s.title} (${s.kind})`).join(' -> ')}`)
    const started = performance.now()
    const list = await steps.planSteps(record, use)
    if (list) {
      print(list, Math.round(performance.now() - started))
      if (categories.plan.steps.some((s) => s.kind === 'battery') && !list.steps.some((s) => s.safety === 'professional'))
        candidates.push(`${name}: plan list with a battery step but no professional step`)
      for (const s of list.steps.filter((s) => s.kind === 'general'))
        if (INTERNAL.test([s.title, s.detail, ...s.tools, ...s.parts].join(' '))) candidates.push(`${name}: general step naming internal work in the plan list: "${s.title}"`)
    }
  } else console.log('  PLAN: none')
  if (planOnly) continue
  for (const c of categories.categories) {
    for (const o of c.options) {
      console.log(`  [${c.label}] ${o.title} | ${o.kind} | ${o.status} | ${o.difficulty}`)
      const started = performance.now()
      const plan = await steps(record, use, o.option_id)
      if (!plan) {
        candidates.push(`${name}: no plan for "${o.title}"`)
        continue
      }
      print(plan, Math.round(performance.now() - started))
      if (o.kind === 'battery' && o.status !== 'not_suitable' && !plan.steps.some((s) => s.safety === 'professional'))
        candidates.push(`${name}: battery plan without a professional step: "${o.title}"`)
      for (const s of plan.steps.filter((s) => s.kind === 'general'))
        if (INTERNAL.test([s.title, s.detail, ...s.tools, ...s.parts].join(' ')))
          candidates.push(`${name}: general step naming internal work in "${o.title}": "${s.title}"`)
    }
  }
}
for (const w of warnings) console.log(`warning: ${w}`)
console.log(`\nAC-015 candidates to review: ${candidates.length === 0 ? 'none' : candidates.length}`)
for (const c of candidates) console.log(`  ${c}`)
