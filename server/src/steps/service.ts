// Step service (feature 009): the cached step call for one option, the server checks on its answer,
// and the template plans.
//
// Like the category cache, the step cache stores the AI's answer, not the finished plan: citations
// are checked against the passages retrieved now on every read, so a corpus change can only remove
// steps, never keep a citation to a passage that no longer exists.
import { createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import {
  createValidator,
  usesWindowsRules,
  type CategoryOption,
  type CategoryResult,
  type DeviceRecord,
  type DeviceScan,
  type IntendedUse,
  type OptionKind,
  type Passage,
  type Path,
  type Step,
  type StepPlan,
} from '@leaaf/shared'
import type { Static } from 'typebox'
import type { AssessmentService, DeviceAssessment } from '../assessment/service.ts'
import { KIND_PATH } from '../categories/options.ts'
import { LlmError, type LlmClient } from '../llm/types.ts'
import { hasNoFigure, windows11 } from '../report/text.ts'
import type { OptionQuery, Retriever } from '../retrieval/retrieve.ts'
import { buildStepRequest, optionContext, STEP_PROMPT_HASH, StepsOutput } from './prompt.ts'
import { PROFESSIONAL_SENTENCE, STEPS_UNAVAILABLE, templateSteps } from './templates.ts'

type Output = Static<typeof StepsOutput>
const validateOutput = createValidator(StepsOutput)

/** Shown instead of a warning the AI left out on a caution step (FR-004). */
export const DEFAULT_WARNING = 'Take care: a mistake in this step can damage the computer or hurt you.'

/** Thrown when an answer is well-formed but rejected by the server checks (FR-008); triggers the template. */
export class UnusableSteps extends Error {}

/** Procedure words per kind, searched before the closest path's own facets (FR-009). */
const KIND_TERMS: Record<OptionKind, readonly string[]> = {
  ssd: ['solid-state drive', 'ssd', 'm.2', 'hard drive', 'storage drive', 'base cover', 'bottom cover'],
  ram: ['memory module', 'memory', 'sodimm', 'so-dimm', 'base cover', 'bottom cover'],
  battery: ['battery', 'built-in battery', 'replace the battery', 'removing the battery', 'repair café', 'reparatur*'],
  hand_down: ['back up', 'backup', 'file history', 'reset this pc', 'remove everything', 'donate', 'spenden', 'reuse'],
  salvage: ['removing the memory', 'removing the solid-state drive', 'electrostatic', 'disconnect the battery', 'spare part'],
  recycle: ['collection point', 'take back', 'elektroaltger*', 'sammelstelle*', 'batterie*', 'reset this pc'],
  other: ['back up', 'reset', 'remove everything', 'installation media', 'reinstall', 'bios'],
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'your', 'this', 'that', 'from', 'into', 'give', 'someone', 'who', 'needs', 'bring', 'add'])

/** Words of the option title, so retrieval also finds what is specific to this option. */
export function titleTerms(title: string): string[] {
  const words = title.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}][\p{L}\p{N}.-]*/gu) ?? []
  return [...new Set(words.filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w)))]
}

/** The assessed path closest to the option: its own in the fallback, else the kind's, else none. */
export function closestPath(option: CategoryOption): Path | null {
  return option.path ?? (option.kind === 'other' ? null : KIND_PATH[option.kind])
}

export function optionQuery(option: CategoryOption): OptionQuery {
  return {
    path: closestPath(option),
    facets: [
      { name: 'kind', terms: KIND_TERMS[option.kind] },
      { name: 'title', terms: titleTerms(option.title) },
    ],
  }
}

/** Passages the step call may cite: retrieved for the option, plus those its category claims cite. */
function stepPassages(retriever: Retriever, scan: DeviceScan, option: CategoryOption, categories: CategoryResult): Passage[] {
  const byId = new Map(retriever.retrieveOption(scan, optionQuery(option)).map((p) => [p.passage_id, p]))
  const claimed = new Set(option.claims.flatMap((c) => c.passage_ids))
  for (const p of categories.passages) if (claimed.has(p.passage_id) && !byId.has(p.passage_id)) byId.set(p.passage_id, p)
  return [...byId.values()]
}

function cleanRange(minutes: Step['minutes']): Step['minutes'] {
  if (!minutes || minutes.low < 0 || minutes.low > minutes.high) return null
  return minutes
}

/**
 * The server checks on a schema-valid answer (FR-004, FR-005, FR-008). Text with a euro or CO₂e
 * figure rejects the whole answer. Unknown citations are removed, then every technical step left
 * without one. On a Mac or Linux device, steps about Windows 11 are removed (feature 007 FR-015).
 */
export function checkSteps(output: Output, passages: readonly Passage[], scan: DeviceScan): { steps: Step[]; cited: Passage[] } {
  for (const s of output.steps) {
    const texts = [s.title, s.detail, s.warning ?? '', ...s.tools, ...s.parts]
    if (!texts.every(hasNoFigure)) throw new UnusableSteps('a step contains a euro or CO2e figure')
  }
  const sources = new Map(passages.map((p) => [p.passage_id, p]))
  const windows = usesWindowsRules(scan)
  const steps: Step[] = []
  for (const s of output.steps) {
    const passage_ids = [...new Set(s.passage_ids.filter((id) => sources.has(id)))]
    if (s.kind === 'technical' && passage_ids.length === 0) continue
    if (!windows && [s.title, s.detail].some((t) => windows11.test(t))) continue
    const professional = s.safety === 'professional'
    steps.push({
      ...s,
      passage_ids,
      minutes: cleanRange(s.minutes),
      warning: s.safety === 'caution' ? (s.warning ?? DEFAULT_WARNING) : null,
      detail: professional && !/service provider/i.test(s.detail) ? `${s.detail} ${PROFESSIONAL_SENTENCE}` : s.detail,
    })
  }
  const cited = new Set(steps.flatMap((s) => s.passage_ids))
  return { steps, cited: passages.filter((p) => cited.has(p.passage_id)) }
}

const now = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

export interface StepServiceDeps {
  retriever: Retriever
  assessments: AssessmentService
  /** The categories the result screen shows, without a category call (categories/service.ts). */
  shownCategories: (scan: DeviceScan, input: DeviceAssessment) => CategoryResult
  /** Receives the reason a template was used; never device IDs or prompt content. */
  warn?: (message: string, details?: Record<string, unknown>) => void
}

export function createStepService(db: DatabaseSync, llm: LlmClient | null, deps: StepServiceDeps) {
  // Additive table; dropping it only forces new step calls.
  db.exec(`CREATE TABLE IF NOT EXISTS step_cache (
    device_id TEXT NOT NULL, intended_use TEXT NOT NULL, option_id TEXT NOT NULL, prompt_hash TEXT NOT NULL,
    output TEXT NOT NULL, generated_at TEXT NOT NULL, PRIMARY KEY (device_id, intended_use, option_id))`)
  const read = db.prepare(
    'SELECT output, generated_at FROM step_cache WHERE device_id = ? AND intended_use = ? AND option_id = ? AND prompt_hash = ? AND json_valid(output)',
  )
  const write = db.prepare(
    'INSERT OR REPLACE INTO step_cache (device_id, intended_use, option_id, prompt_hash, output, generated_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const pending = new Map<string, Promise<{ output: Output; generated_at: string }>>()

  /**
   * The step plan for one option, or null when the device's shown categories have no such option.
   * Makes at most one step call per device, intended use and option (FR-001).
   */
  return async function steps(record: DeviceRecord, use: IntendedUse, optionId: string): Promise<StepPlan | null> {
    const { scan } = record
    const input = await deps.assessments.assessDevice(record, use)
    const categories = deps.shownCategories(scan, input)
    const option = categories.categories.flatMap((c) => c.options).find((o) => o.option_id === optionId)
    if (!option) return null
    const passages = stepPassages(deps.retriever, scan, option, categories)
    const base = { device_id: record.device_id, intended_use: use, option_id: optionId }

    const template = (reason: string | null, details: Record<string, unknown> = {}): StepPlan => {
      if (reason) deps.warn?.(`step call unavailable, showing the template plan: ${reason}`, details)
      const planSteps = templateSteps(option.kind, passages)
      const cited = new Set(planSteps.flatMap((s) => s.passage_ids))
      return {
        ...base,
        generated_at: now(),
        source: 'template',
        notice: STEPS_UNAVAILABLE,
        steps: planSteps,
        passages: passages.filter((p) => cited.has(p.passage_id)),
      }
    }
    const fromOutput = (output: Output, generated_at: string): StepPlan => {
      const { steps: checked, cited } = checkSteps(output, passages, scan)
      return { ...base, generated_at, source: 'llm', notice: null, steps: checked, passages: cited }
    }

    // The five-path fallback has no AI options to plan for (FR-012).
    if (categories.source === 'template') return template(null)

    // The option's own fields are part of the key: a new category answer may reuse an ID for another option.
    const key = createHash('sha256').update(STEP_PROMPT_HASH).update('\0').update(JSON.stringify(optionContext(option))).digest('hex').slice(0, 16)
    const row = read.get(record.device_id, use, optionId, key)
    if (row) {
      const checked = validateOutput(JSON.parse(String(row.output)))
      if (checked.ok) {
        try {
          return fromOutput(checked.value, String(row.generated_at))
        } catch (error) {
          if (!(error instanceof UnusableSteps)) throw error
        }
      }
    }

    if (!llm) return template('no LLM configured')
    const pendingKey = JSON.stringify([record.device_id, use, optionId, key])
    let generation = pending.get(pendingKey)
    if (!generation) {
      generation = llm
        .completeJson(buildStepRequest(scan, input, option, passages))
        .then(({ value }) => {
          const generated_at = now()
          // Check before caching, so a rejected answer is never stored and the next open retries.
          checkSteps(value, passages, scan)
          write.run(record.device_id, use, optionId, key, JSON.stringify(value), generated_at)
          return { output: value, generated_at }
        })
        .finally(() => pending.delete(pendingKey))
      pending.set(pendingKey, generation)
    }
    try {
      const { output, generated_at } = await generation
      return fromOutput(output, generated_at)
    } catch (error) {
      if (error instanceof LlmError) return template(error.message, { kind: error.kind })
      if (error instanceof UnusableSteps) return template(error.message)
      throw error
    }
  }
}

export type StepService = ReturnType<typeof createStepService>
