// Retrieval result shapes (feature 002). Internal to the server, but shared so that
// fixtures, the report's evidence section (feature 004), and tests agree on one shape.
import { Type, type Static } from 'typebox'
import { IsoDate, Nullable, PassageId, PATHS } from './common.ts'

const strict = { additionalProperties: false } as const

export const Topic = Type.Enum(['repair-hardware', 'software-support', 'environmental', 'circular-economy'])

export const Applicability = Type.Union([
  Type.Object({ kind: Type.Literal('model'), manufacturer: Type.String(), model: Type.String() }, strict),
  Type.Object({ kind: Type.Literal('generic') }, strict),
])

/** A citable passage; every field required by feature 002 FR-007. */
export const Passage = Type.Object(
  {
    passage_id: PassageId,
    document_id: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    url: Type.String({ format: 'uri' }),
    publisher: Type.String({ minLength: 1 }),
    topic: Topic,
    section: Nullable(Type.String({ minLength: 1 })),
    page: Nullable(Type.Integer({ minimum: 1 })),
    applicability: Applicability,
    accessed_on: IsoDate,
    text: Type.String({ minLength: 1 }),
  },
  { ...strict, description: 'At least one of section or page is non-null (checked in invariants.ts)' },
)
export type Passage = Static<typeof Passage>

/** Normalized model a device was matched to, using the manifest's canonical names. */
export const ModelMatch = Type.Object({ manufacturer: Type.String(), model: Type.String() }, strict)

const byPath = Object.fromEntries(PATHS.map((p) => [p, Type.Array(Passage)])) as Record<
  (typeof PATHS)[number],
  ReturnType<typeof Type.Array<typeof Passage>>
>

export const RetrievalResult = Type.Object(
  {
    model_evidence: Type.Enum(['model_specific', 'none'], {
      description: 'none when no model-specific document matched (feature 002 FR-006)',
    }),
    matched_model: Nullable(ModelMatch),
    passages_by_path: Type.Object(byPath, strict),
  },
  { ...strict },
)
export type RetrievalResult = Static<typeof RetrievalResult>
