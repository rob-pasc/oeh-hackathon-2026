// Explained report and its Server-Sent Events stream (feature 004).
//
// Stream: GET /api/devices/:id/report?intended_use=<use>  (Content-Type: text/event-stream)
//   event: status      -> ReportStatus   (optional, before the assessment: what the server is doing,
//                                         for example a web search for the model, feature 017)
//   event: assessment  -> Assessment     (sent immediately; ranking is visible at once)
//   event: categories  -> CategoryResult (feature 008; categories.ts) — the result screen's content
//   event: report      -> Report         (no longer sent by the report stream since feature 008;
//                                         the contract stays for the explanation service)
//   event: end         -> StreamEnd      (last event; the server then closes the stream)
//   event: error       -> ApiError       (instead of the remaining events)
// Cached results are sent the same way, just without delay (FR-010).
import { Type, type Static } from 'typebox'
import { DeviceId, IntendedUse, IsoDateTime, Nullable, PassageId, Path } from './common.ts'
import { Passage } from './retrieval.ts'

const strict = { additionalProperties: false } as const

export const Claim = Type.Object(
  { text: Type.String({ minLength: 1 }), passage_ids: Type.Array(PassageId, { minItems: 1 }) },
  { ...strict, description: 'A technical claim; uncited claims are removed by the server (FR-005)' },
)

export const PathExplanation = Type.Object(
  {
    path: Path,
    summary: Type.String({ minLength: 1, description: 'One-sentence reason shown on the collapsed card' }),
    next_steps: Type.Array(Type.String({ minLength: 1 })),
    why: Type.String({ description: 'Why it ranks here; must not contain CO2e or euro figures (FR-005)' }),
    assumptions: Type.Array(Type.String({ minLength: 1 })),
    safety: Type.Array(Type.String({ minLength: 1 })),
    unverified: Type.Array(Type.String({ minLength: 1 }), { description: 'What could not be verified (FR-007)' }),
    claims: Type.Array(Claim),
  },
  strict,
)
export type PathExplanation = Static<typeof PathExplanation>

export const Report = Type.Object(
  {
    device_id: DeviceId,
    intended_use: IntendedUse,
    generated_at: IsoDateTime,
    source: Type.Enum(['llm', 'template'], { description: 'template = fallback (FR-009)' }),
    notice: Nullable(Type.String({ description: 'Shown when source is template, e.g. "AI explanation unavailable"' })),
    paths: Type.Array(PathExplanation, { minItems: 5, maxItems: 5 }),
    passages: Type.Array(Passage, { description: 'Every passage cited by any claim, for the Evidence section' }),
  },
  { ...strict },
)
export type Report = Static<typeof Report>

export const StreamEnd = Type.Object(
  { status: Type.Enum(['complete', 'fallback']) },
  { ...strict },
)
export type StreamEnd = Static<typeof StreamEnd>

/** Progress before the assessment is ready (feature 017 FR-013). */
export const ReportStatus = Type.Object(
  { phase: Type.Enum(['web_search'], { description: 'web_search = searching the web for this model' }) },
  { ...strict },
)
export type ReportStatus = Static<typeof ReportStatus>

export const REPORT_EVENTS = ['status', 'assessment', 'categories', 'report', 'end', 'error'] as const
export type ReportEvent = (typeof REPORT_EVENTS)[number]
