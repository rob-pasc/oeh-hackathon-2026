// Fact lookup and citation helpers for the gates (feature 003 FR-002 to FR-006).
import type { Fact, FactKey, PathAssessment } from '@leaaf/shared'

export type Reason = PathAssessment['reasons'][number]

/**
 * Hardware facts describe one exact model. Without model-specific evidence they cannot apply to this
 * device, even if a generic passage seemed to support them, so they are ignored (FR-004). Software
 * support facts (for example the Windows 11 CPU list) come from generic sources and stay usable.
 */
const HARDWARE_FACTS: ReadonlySet<FactKey> = new Set([
  'ram_soldered',
  'ram_slots_total',
  'ram_max_gb',
  'ram_type',
  'storage_slots',
  'battery_user_replaceable',
  'battery_replacement_part_available',
])

export type FactOf<K extends FactKey> = Extract<Fact, { key: K }>

export interface FactLookup {
  get<K extends FactKey>(key: K): FactOf<K> | undefined
}

export function lookupFacts(facts: readonly Fact[], modelEvidence: 'model_specific' | 'none'): FactLookup {
  const byKey = new Map<FactKey, Fact>()
  for (const f of facts) {
    if (modelEvidence === 'none' && HARDWARE_FACTS.has(f.key)) continue
    byKey.set(f.key, f)
  }
  return { get: <K extends FactKey>(key: K) => byKey.get(key) as FactOf<K> | undefined }
}

/** A reason citing the facts it relies on; their passages become its citations. */
export function reason(code: string, text: string, cited: readonly (Fact | undefined)[] = []): Reason {
  const facts = cited.filter((f): f is Fact => f !== undefined)
  return {
    code,
    text,
    fact_keys: [...new Set(facts.map((f) => f.key))],
    passage_ids: [...new Set(facts.flatMap((f) => f.source_passage_ids))],
  }
}
