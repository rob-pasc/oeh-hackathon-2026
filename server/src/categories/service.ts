// Category service (feature 008): cached category call, server checks, figures, and the fallback.
//
// The cache stores the AI's checked answer, not the finished result: figures and scores are
// recomputed from the current assessment on every read, so they always match the impact table and
// weights the assessment used (FR-003, FR-014).
import type { DatabaseSync } from 'node:sqlite'
import { createValidator, usesWindowsRules, type Category, type CategoryResult, type DeviceScan, type OptionKind } from '@leaaf/shared'
import type { Static } from 'typebox'
import { indexImpactTable } from '../assessment/calculator.ts'
import { runGates } from '../assessment/gates.ts'
import type { DeviceAssessment } from '../assessment/service.ts'
import { retrievedPassages } from '../facts/extract.ts'
import type { ImpactTable } from '../impact/table.ts'
import { LlmError, type LlmClient } from '../llm/types.ts'
import { calculatorClaim, hasNoFigure, windows11 } from '../report/text.ts'
import { fallbackCategories } from './fallback.ts'
import { finishOption, type OptionContext } from './options.ts'
import { buildCategoryRequest, CATEGORY_PROMPT_HASH, CategoryOutput } from './prompt.ts'

type Output = Static<typeof CategoryOutput>
const validateOutput = createValidator(CategoryOutput)

const NEUTRAL = 'See the status and figures of this option.'

/** Replacement label when the AI's label fails the text checks, named after the first option's kind. */
const KIND_LABEL: Record<OptionKind, string> = {
  ssd: 'Storage',
  ram: 'Memory',
  battery: 'Battery',
  hand_down: 'Hand it down',
  salvage: 'Salvage for parts',
  recycle: 'Recycle',
  other: 'More options',
}

/** Thrown when an answer is well-formed but unusable after the server checks; triggers the fallback. */
class UnusableAnswer extends Error {}

/** Makes IDs unique within a list by appending -2, -3, …; the AI is asked for unique IDs but not trusted. */
function uniqueIds<T>(items: readonly T[], get: (item: T) => string, set: (item: T, id: string) => T): T[] {
  const seen = new Set<string>()
  return items.map((item) => {
    const id = get(item)
    let unique = id
    for (let n = 2; seen.has(unique); n++) unique = `${id.slice(0, 36)}-${n}`
    seen.add(unique)
    return unique === id ? item : set(item, unique)
  })
}

/**
 * Applies FR-012's checks and FR-002 to FR-005's figures to a schema-valid answer:
 * unknown passage IDs and claims with figures are removed, text with a euro or CO₂e figure is
 * replaced by neutral text, and on a Mac or Linux device options about Windows 11 are dropped.
 */
export function buildResult(scan: DeviceScan, input: DeviceAssessment, output: Output, generated_at: string, impactTable: ImpactTable): CategoryResult {
  const { assessment, facts, retrieval } = input
  const sources = new Map(retrievedPassages(retrieval).map((p) => [p.passage_id, p]))
  const windows = usesWindowsRules(scan)
  const allowed = (text: string) => hasNoFigure(text) && (windows || !windows11.test(text))
  const ctx: OptionContext = {
    scan,
    use: assessment.intended_use,
    baseline: assessment.baseline,
    modelEvidence: assessment.model_evidence,
    gates: runGates({ scan, use: assessment.intended_use, modelEvidence: assessment.model_evidence, facts: facts.facts }),
    impactIndex: indexImpactTable(impactTable),
  }

  const cited = new Set<string>()
  const categories: Category[] = []
  for (const c of output.categories) {
    // An option whose very subject is Windows 11 cannot be reworded into something useful on a Mac.
    const kept = c.options.filter((o) => windows || !(windows11.test(o.title) || windows11.test(o.reason)))
    if (kept.length === 0) continue
    const options = uniqueIds(
      kept.map((o) => {
        const claims = o.claims.filter(
          (claim) => !calculatorClaim.test(claim.text) && allowed(claim.text) && claim.passage_ids.every((id) => sources.has(id)),
        )
        for (const claim of claims) for (const id of claim.passage_ids) cited.add(id)
        return finishOption(
          {
            ...o,
            title: hasNoFigure(o.title) ? o.title : 'Option',
            reason: allowed(o.reason) ? o.reason : NEUTRAL,
            why: allowed(o.why) ? o.why : NEUTRAL,
            claims,
          },
          ctx,
        )
      }),
      (o) => o.option_id,
      (o, option_id) => ({ ...o, option_id }),
    )
    categories.push({
      category_id: c.category_id,
      label: allowed(c.label) ? c.label : KIND_LABEL[options[0]!.kind],
      summary: allowed(c.summary) ? c.summary : NEUTRAL,
      options,
    })
  }
  if (categories.length < 3) throw new UnusableAnswer(`only ${categories.length} categories left after the server checks`)

  return {
    device_id: assessment.device_id,
    intended_use: assessment.intended_use,
    generated_at,
    source: 'llm',
    notice: null,
    categories: uniqueIds(categories, (c) => c.category_id, (c, category_id) => ({ ...c, category_id })),
    passages: [...sources.values()].filter((p) => cited.has(p.passage_id)),
  }
}

export interface CategoryServiceDeps {
  impactTable: ImpactTable
  /** Receives the reason a fallback was used; never device IDs or prompt content. */
  warn?: (message: string, details?: Record<string, unknown>) => void
}

export function createCategoryService(db: DatabaseSync, llm: LlmClient | null, deps: CategoryServiceDeps) {
  // Additive table; dropping it only forces new category calls.
  db.exec(`CREATE TABLE IF NOT EXISTS category_cache (
    device_id TEXT NOT NULL, intended_use TEXT NOT NULL, prompt_hash TEXT NOT NULL,
    output TEXT NOT NULL, generated_at TEXT NOT NULL, PRIMARY KEY (device_id, intended_use))`)
  const read = db.prepare(
    'SELECT output, generated_at FROM category_cache WHERE device_id = ? AND intended_use = ? AND prompt_hash = ? AND json_valid(output)',
  )
  const write = db.prepare(
    'INSERT OR REPLACE INTO category_cache (device_id, intended_use, prompt_hash, output, generated_at) VALUES (?, ?, ?, ?, ?)',
  )
  const pending = new Map<string, Promise<{ output: Output; generated_at: string }>>()

  /** The categories built from a cached, still usable answer, or null. */
  function cached(scan: DeviceScan, input: DeviceAssessment): CategoryResult | null {
    const { device_id, intended_use } = input.assessment
    const row = read.get(device_id, intended_use, CATEGORY_PROMPT_HASH)
    if (!row) return null
    const checked = validateOutput(JSON.parse(String(row.output)))
    if (!checked.ok) return null
    try {
      return buildResult(scan, input, checked.value, String(row.generated_at), deps.impactTable)
    } catch (error) {
      if (!(error instanceof UnusableAnswer)) throw error
      // A cached answer can become unusable, for example after a corpus change; ask again.
      return null
    }
  }

  async function categorize(scan: DeviceScan, input: DeviceAssessment): Promise<CategoryResult> {
    const { device_id, intended_use } = input.assessment
    const fallback = (reason: string, details: Record<string, unknown> = {}) => {
      deps.warn?.(`category call unavailable, showing the five paths: ${reason}`, details)
      return fallbackCategories(input)
    }

    const hit = cached(scan, input)
    if (hit) return hit

    if (!llm) return fallback('no LLM configured')
    const key = JSON.stringify([device_id, intended_use])
    let generation = pending.get(key)
    if (!generation) {
      generation = llm
        .completeJson(buildCategoryRequest(scan, input))
        .then(({ value }) => {
          const generated_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
          // Check before caching, so an unusable answer is never stored and the next open retries.
          buildResult(scan, input, value, generated_at, deps.impactTable)
          write.run(device_id, intended_use, CATEGORY_PROMPT_HASH, JSON.stringify(value), generated_at)
          return { output: value, generated_at }
        })
        .finally(() => pending.delete(key))
      pending.set(key, generation)
    }
    try {
      const { output, generated_at } = await generation
      return buildResult(scan, input, output, generated_at, deps.impactTable)
    } catch (error) {
      if (error instanceof LlmError) return fallback(error.message, { kind: error.kind })
      if (error instanceof UnusableAnswer) return fallback(error.message)
      throw error
    }
  }

  /**
   * The categories the result screen shows, without a category call: the cached answer, or else
   * the five-path fallback the screen got when there was none. The step route (feature 009) uses
   * this to find an opened option, so opening a card never starts a category call.
   */
  function shown(scan: DeviceScan, input: DeviceAssessment): CategoryResult {
    return cached(scan, input) ?? fallbackCategories(input)
  }

  return Object.assign(categorize, { shown })
}

export type CategoryService = ReturnType<typeof createCategoryService>
/** What the report stream needs: the category service without its cache-only lookup. */
export type Categorize = (scan: DeviceScan, input: DeviceAssessment) => Promise<CategoryResult>
