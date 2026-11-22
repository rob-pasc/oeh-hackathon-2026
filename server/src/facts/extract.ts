// Fact extraction (feature 003 FR-002): asks the LLM for structured facts about a device's model,
// keeps only facts whose citations are all among the retrieved passages, and caches the result.
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { Type } from 'typebox'
import {
  checkFactSet,
  createValidator,
  Fact,
  FactSet,
  PATHS,
  type DeviceScan,
  type ModelMatch,
  type Passage,
  type RetrievalResult,
} from '@leaaf/shared'
import type { LlmClient, LlmUsage } from '../llm/index.ts'
import type { FactCache } from './cache.ts'
import { deviceContext, FACT_EXTRACTION_SYSTEM, factExtractionUserPrompt, passageContext, PROMPT_VERSION } from './prompt.ts'

/** What the LLM must return; `model` is set by the server, not the LLM. */
export const ExtractionAnswer = Type.Object({ facts: Type.Array(Fact) }, { additionalProperties: false })

/** With web passages (feature 017 FR-004): also the web passages that are not about this exact model. */
export const WebExtractionAnswer = Type.Object(
  { facts: Type.Array(Fact), rejected_passage_ids: Type.Array(Type.String()) },
  { additionalProperties: false },
)

export interface FilterOptions {
  /** IDs of passages found by web search. */
  webIds?: ReadonlySet<string>
  /** Web passages the LLM said are not about this exact model. */
  rejectedIds?: ReadonlySet<string>
}

export interface DroppedFact {
  fact: Fact
  reason: string
}

export interface ExtractionResult {
  facts: FactSet
  cached: boolean
  /** Facts the LLM returned but the server rejected; for logs and review (T-009). */
  dropped: DroppedFact[]
  /** Call metadata; null on a cache hit or when there were no passages to read. */
  llm: { model: string; attempts: number; latency_ms: number; usage: LlmUsage } | null
}

export interface ExtractionInput {
  scan: DeviceScan
  retrieval: RetrievalResult
}

/** Unique passages across all paths, in a stable order (the same passage often serves several paths). */
export function retrievedPassages(retrieval: RetrievalResult): Passage[] {
  const byId = new Map<string, Passage>()
  for (const path of PATHS) for (const p of retrieval.passages_by_path[path]) byId.set(p.passage_id, p)
  return [...byId.values()].sort((a, b) => a.passage_id.localeCompare(b.passage_id))
}

/** The matched model, or the scan's raw identity when retrieval found none (`model_evidence: "none"`). */
export function factModel(input: ExtractionInput): ModelMatch {
  if (input.retrieval.matched_model) return input.retrieval.matched_model
  const id = input.scan.identity
  return { manufacturer: id.manufacturer ?? 'unknown', model: id.product_version ?? id.model ?? 'unknown' }
}

/**
 * Cache key: the normalized model plus a hash of the prompt version and everything sent to the LLM.
 * Devices of the same model share facts as long as they receive the same passages and CPU.
 */
export function cacheKey(model: ModelMatch, prompt: string): string {
  const hash = createHash('sha256').update(PROMPT_VERSION).update('\0').update(prompt).digest('hex')
  return `${model.manufacturer}\u001f${model.model}\u001f${hash}`
}

/**
 * Applies the citation rule and the one-fact-per-key rule:
 * - a fact citing any passage ID that was not retrieved is dropped (the citation is unverifiable);
 * - repeated keys with equal values are merged; repeated keys with different values are all dropped.
 */
export function filterFacts(
  facts: readonly Fact[],
  retrievedIds: ReadonlySet<string>,
  { webIds = new Set(), rejectedIds = new Set() }: FilterOptions = {},
): { kept: Fact[]; dropped: DroppedFact[] } {
  const dropped: DroppedFact[] = []
  const cited: Fact[] = []
  for (const fact of facts) {
    const unknown = fact.source_passage_ids.filter((id) => !retrievedIds.has(id))
    if (unknown.length > 0) {
      dropped.push({ fact, reason: `cites passages that were not retrieved: ${unknown.join(', ')}` })
      continue
    }
    // A rejected web passage supports nothing; the fact stays only with another citation (feature 017 FR-004).
    const ids = [...new Set(fact.source_passage_ids)].filter((id) => !(webIds.has(id) && rejectedIds.has(id)))
    if (ids.length === 0) {
      dropped.push({ fact, reason: 'cites only web passages that are not about this model' })
      continue
    }
    // Web pages may make the battery path more cautious, never unlock self-replacement (feature 017 FR-006).
    if (fact.key === 'battery_user_replaceable' && fact.value && ids.every((id) => webIds.has(id))) {
      dropped.push({ fact, reason: 'a user-replaceable battery is not accepted from web pages alone' })
      continue
    }
    cited.push({ ...fact, source_passage_ids: ids } as Fact)
  }

  const byKey = new Map<string, Fact[]>()
  for (const fact of cited) byKey.set(fact.key, [...(byKey.get(fact.key) ?? []), fact])
  const kept: Fact[] = []
  for (const [key, group] of byKey) {
    const first = group[0]!
    if (group.every((f) => isDeepStrictEqual(f.value, first.value))) {
      kept.push({ ...first, source_passage_ids: [...new Set(group.flatMap((f) => f.source_passage_ids))] } as Fact)
    } else {
      for (const fact of group) dropped.push({ fact, reason: `conflicting values for ${key}` })
    }
  }
  return { kept, dropped }
}

const isFactSet = createValidator(FactSet)

export function createFactExtractor(deps: { llm: LlmClient; cache: FactCache }) {
  // Concurrent requests for the same key share one LLM call.
  const inFlight = new Map<string, Promise<ExtractionResult>>()

  async function run(key: string, model: ModelMatch, passages: Passage[], user: string): Promise<ExtractionResult> {
    const webIds = new Set(passages.filter((p) => p.source === 'web').map((p) => p.passage_id))
    const request = { task: 'fact_extraction' as const, system: FACT_EXTRACTION_SYSTEM, user }
    // Corpus-only requests keep their original schema, so their prompts and cache keys are unchanged.
    let rejectedIds = new Set<string>()
    let response
    if (webIds.size > 0) {
      const web = await deps.llm.completeJson({ ...request, schema: WebExtractionAnswer })
      rejectedIds = new Set(web.value.rejected_passage_ids)
      response = web
    } else {
      response = await deps.llm.completeJson({ ...request, schema: ExtractionAnswer })
    }
    const { kept, dropped } = filterFacts(response.value.facts, new Set(passages.map((p) => p.passage_id)), { webIds, rejectedIds })
    const facts: FactSet = { model, facts: kept }
    // Guards the contract: filterFacts must always produce a valid FactSet.
    const problems = [...(isFactSet(facts).ok ? [] : ['FactSet schema']), ...checkFactSet(facts)]
    if (problems.length > 0) throw new Error(`fact extraction produced an invalid FactSet: ${problems.join('; ')}`)
    deps.cache.set(key, facts)
    const { model: llmModel, attempts, latency_ms, usage } = response
    return { facts, cached: false, dropped, llm: { model: llmModel, attempts, latency_ms, usage } }
  }

  return {
    /**
     * Returns the device model's facts. Throws `LlmError` when the LLM fails; nothing is cached then,
     * so the next assessment retries. Callers may continue with no facts, which makes every
     * compatibility-dependent path "cannot verify" (FR-004).
     */
    async extract(input: ExtractionInput): Promise<ExtractionResult> {
      const model = factModel(input)
      const passages = retrievedPassages(input.retrieval)
      if (passages.length === 0) return { facts: { model, facts: [] }, cached: false, dropped: [], llm: null }

      const user = factExtractionUserPrompt(deviceContext(input.scan, model), passageContext(passages))
      const key = cacheKey(model, user)
      const hit = deps.cache.get(key)
      if (hit) return { facts: hit, cached: true, dropped: [], llm: null }

      const pending = inFlight.get(key)
      if (pending) return pending
      const promise = run(key, model, passages, user).finally(() => inFlight.delete(key))
      inFlight.set(key, promise)
      return promise
    },
  }
}

export type FactExtractor = ReturnType<typeof createFactExtractor>
