import type { DatabaseSync } from 'node:sqlite'
import { createValidator, PATHS, type DeviceScan, type Report } from '@leaaf/shared'
import type { Static } from 'typebox'
import type { DeviceAssessment } from '../assessment/service.ts'
import { templateReport } from './template.ts'
import { LlmError, type LlmClient } from '../llm/types.ts'
import { buildExplanationRequest, ExplanationOutput } from './prompt.ts'

// Older entries used a prompt that inferred owner-serviceability from removal instructions.
const PROMPT_VERSION = 2
const validateOutput = createValidator(ExplanationOutput)
type Output = Static<typeof ExplanationOutput>

// Normalize subscript ₂ and nonbreaking spaces before matching either unit order.
const currencyFigure = /(?:€|\beur(?:os?)?(?![a-z]))\s*[:=]?\s*[-+]?\s*\d|\d\s*(?:€|eur(?:os?)?\b)/iu
const hardwareQuantity = /\b\d+(?:[.,]\d+)?\s*(?:[kmgt]i?b|[kmg]hz|cores?|threads?|slots?)\b/giu
const carbonUnit = /co2(?:eq|e)?|carbon dioxide(?: equivalent)?/giu
function hasNoFigure(text: string): boolean {
  const normalized = text.normalize('NFKC')
  // Remove the unit first so the 2 in CO2e alone never counts as a figure.
  const withoutCarbonUnit = normalized.replace(carbonUnit, '')
  return !currencyFigure.test(normalized) &&
    (withoutCarbonUnit === normalized || !/\d/u.test(withoutCarbonUnit.replace(hardwareQuantity, '')))
}

// Displacement and calculated impact estimates belong to the assessment. A retrieval
// citation cannot establish which baseline the calculator credited for this device.
const calculatorClaim = /\b(?:displacement|credited baseline|avoided purchase|(?:avoid|displace)s? (?:a |the )?new purchase|calculat(?:or|ed) (?:output|impact|estimate)|(?:emissions|impact) estimate (?:in|from) (?:this|the|our) (?:data|table|calculator))\b/i

function makeReport({ assessment, retrieval }: DeviceAssessment, output: Output, generated_at: string): Report {
  const sources = new Map(Object.values(retrieval.passages_by_path).flat().map(p => [p.passage_id, p]))
  const cited = new Set<string>()
  const paths = PATHS.map(path => {
    const p = output.paths[path]
    const claims = p.claims.filter(c => !calculatorClaim.test(c.text) && hasNoFigure(c.text) && c.passage_ids.every(id => sources.has(id)))
    for (const claim of claims) for (const id of claim.passage_ids) cited.add(id)
    const neutral = 'See the assessed status and impact ranges for this path.'
    return {
      path, claims,
      summary: hasNoFigure(p.summary) ? p.summary : neutral,
      why: hasNoFigure(p.why) ? p.why : neutral,
      next_steps: p.next_steps.filter(hasNoFigure), safety: p.safety.filter(hasNoFigure),
      assumptions: p.assumptions.filter(hasNoFigure), unverified: p.unverified.filter(hasNoFigure),
    }
  })
  return {
    device_id: assessment.device_id, intended_use: assessment.intended_use, generated_at,
    source: 'llm', notice: null, paths, passages: [...sources.values()].filter(p => cited.has(p.passage_id)),
  }
}

export function createReportService(db: DatabaseSync, llm: LlmClient | null) {
  db.exec(`CREATE TABLE IF NOT EXISTS explanation_cache (
    device_id TEXT NOT NULL, intended_use TEXT NOT NULL, output TEXT NOT NULL,
    generated_at TEXT NOT NULL, PRIMARY KEY (device_id, intended_use))`)
  const read = db.prepare('SELECT output, generated_at FROM explanation_cache WHERE device_id = ? AND intended_use = ? AND json_valid(output)')
  const write = db.prepare('INSERT OR REPLACE INTO explanation_cache (device_id, intended_use, output, generated_at) VALUES (?, ?, ?, ?)')
  const pending = new Map<string, Promise<{ output: Output; generated_at: string }>>()

  return async function explain(scan: DeviceScan, input: DeviceAssessment): Promise<Report> {
    const { device_id, intended_use } = input.assessment
    const row = read.get(device_id, intended_use)
    if (row) {
      const cached = JSON.parse(String(row.output))
      const checked = validateOutput(cached?.version === PROMPT_VERSION ? cached.explanation : null)
      if (checked.ok) return makeReport(input, checked.value, String(row.generated_at))
    }

    if (!llm) return templateReport(input)
    const key = JSON.stringify([device_id, intended_use])
    let generation = pending.get(key)
    if (!generation) {
      generation = llm.completeJson(buildExplanationRequest(scan, input)).then(({ value }) => {
        const generated_at = new Date().toISOString()
        write.run(device_id, intended_use, JSON.stringify({ version: PROMPT_VERSION, explanation: value }), generated_at)
        return { output: value, generated_at }
      }).finally(() => pending.delete(key))
      pending.set(key, generation)
    }
    try {
      const { output, generated_at } = await generation
      return makeReport(input, output, generated_at)
    } catch (error) {
      if (error instanceof LlmError) return templateReport(input)
      throw error
    }
  }
}
