// Part lookup on the result screen (feature 018).
//
// GET /api/devices/:id/parts -> 200 PartLookupResult | 404/429 ApiError
//
// Each part the scan contains is looked up in the curated corpus first and on the web when the
// corpus names nothing about it; one sentence per part cites one of the passages found. The
// lookup never changes assessments, gates or ranking. Without an LLM the list is empty.
import { Type, type Static } from 'typebox'
import { DeviceId, Nullable } from './common.ts'
import { Passage } from './retrieval.ts'

const strict = { additionalProperties: false } as const

export const PART_KINDS = ['cpu', 'memory', 'gpu', 'storage', 'battery'] as const
export const PartKind = Type.Enum(PART_KINDS, { description: 'Kind of a scanned part; decides the scan specs row it belongs to' })
export type PartKind = Static<typeof PartKind>

export const PART_LOOKUP_STATUSES = ['knowledge_base', 'web', 'no_match'] as const
export const PartLookupStatus = Type.Enum(PART_LOOKUP_STATUSES, {
  description: 'knowledge_base = cites a corpus passage; web = cites a web page (shown as "check"); no_match = nothing usable',
})
export type PartLookupStatus = Static<typeof PartLookupStatus>

/** Longest sentence the server accepts; longer answers count as no match. */
export const PART_SENTENCE_MAX = 240

export const PartLookup = Type.Object(
  {
    part_id: Type.String({ minLength: 1, description: 'Unique within one result, e.g. "cpu", "gpu-0", "storage-1"' }),
    kind: PartKind,
    identifier: Type.String({
      minLength: 1,
      description:
        'Normalized name that was looked up, e.g. "Intel Core i5-8250U". Drives and the battery have no model name in the scan, so they are looked up by type ("NVMe SSD", "laptop battery")',
    }),
    status: PartLookupStatus,
    sentence: Nullable(Type.String({ minLength: 1, maxLength: PART_SENTENCE_MAX })),
    source: Nullable(Passage),
  },
  { ...strict, description: 'sentence and source are set exactly when status is not no_match' },
)
export type PartLookup = Static<typeof PartLookup>

export const PartLookupResult = Type.Object(
  { device_id: DeviceId, parts: Type.Array(PartLookup, { description: 'Empty when the lookup is off (no LLM configured)' }) },
  strict,
)
export type PartLookupResult = Static<typeof PartLookupResult>
