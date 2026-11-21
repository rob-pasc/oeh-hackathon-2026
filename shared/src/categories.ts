// AI categories and their options (feature 008).
//
// Stream: GET /api/devices/:id/report?intended_use=<use>  (see report.ts for the event order)
//   event: assessment  -> Assessment       (sent immediately; the five-path ranking)
//   event: categories  -> CategoryResult   (when the category call answers, or the five-path fallback)
//   event: end         -> StreamEnd
// As with the assessment, totals and order are not part of the payload: the browser ranks
// options and categories with ranking.ts, so the mode toggle needs no request (FR-008).
import { Type, type Static } from 'typebox'
import { ConfidenceLevel, DeviceId, IntendedUse, IsoDateTime, Nullable, Path, Suitability } from './common.ts'
import { CriterionScores, Impact } from './assessment.ts'
import { Claim } from './report.ts'
import { Passage } from './retrieval.ts'

const strict = { additionalProperties: false } as const

/**
 * What an option does, as far as the impact table can price it (FR-003). `other` options get
 * AI-estimated figures (FR-004). Appending a priced kind needs matching impact table entries.
 */
export const OPTION_KINDS = ['ssd', 'ram', 'battery', 'hand_down', 'salvage', 'recycle', 'other'] as const
export const OptionKind = Type.Enum(OPTION_KINDS)
export type OptionKind = Static<typeof OptionKind>

/** Kinds the calculator prices; every other kind is `other`. */
export const PRICED_KINDS = ['ssd', 'ram', 'battery', 'hand_down', 'salvage', 'recycle'] as const satisfies readonly OptionKind[]

export const DIFFICULTIES = ['diy_easy', 'diy_moderate', 'professional'] as const
export const Difficulty = Type.Enum(DIFFICULTIES, {
  description: 'diy_easy = no tools or opening the device; diy_moderate = owner opens the device with common tools; professional = a service provider does it',
})
export type Difficulty = Static<typeof Difficulty>

/** Stable lowercase identifier for categories and options, unique within its list. */
export const Slug = Type.String({ pattern: '^[a-z0-9][a-z0-9_-]{0,39}$' })

/** Category labels fit a toolbar tab (FR-001). */
export const CATEGORY_LABEL_MAX = 24

export const CategoryOption = Type.Object(
  {
    option_id: Slug,
    title: Type.String({ minLength: 1, maxLength: 80 }),
    status: Suitability,
    reason: Type.String({ minLength: 1, description: 'One sentence shown on the card' }),
    kind: OptionKind,
    difficulty: Difficulty,
    why: Type.String({ description: 'Shown when the card is opened; no euro or CO2e figures' }),
    claims: Type.Array(Claim, { maxItems: 2, description: 'Cited technical claims; at most two sources are shown (FR-010)' }),
    impact: Nullable(Impact),
    impact_source: Nullable(
      Type.Enum(['calculator', 'ai_estimate'], {
        description: 'calculator = impact table entries (FR-003); ai_estimate = ranges supplied by the AI and checked by the server (FR-004)',
      }),
    ),
    scores: Nullable(CriterionScores),
    confidence: Type.Object(
      { level: ConfidenceLevel, reasons: Type.Array(Type.String({ minLength: 1 })) },
      strict,
    ),
    // Set only in the five-path fallback (FR-013), where each option is a whole assessed path.
    path: Nullable(Path),
  },
  {
    ...strict,
    description:
      'not_suitable options have impact, impact_source and scores all null. Others have all three, or all null when an AI estimate was rejected (invariants.ts)',
  },
)
export type CategoryOption = Static<typeof CategoryOption>

export const Category = Type.Object(
  {
    category_id: Slug,
    label: Type.String({ minLength: 1, maxLength: CATEGORY_LABEL_MAX, description: 'Device-specific tab label, e.g. "Faster storage"' }),
    summary: Type.String({ minLength: 1, description: 'One sentence' }),
    options: Type.Array(CategoryOption, { minItems: 1 }),
  },
  strict,
)
export type Category = Static<typeof Category>

/** Plan steps are options; salvage and recycle are never part of a plan (feature 013 FR-003). */
export const PLAN_STEP_KINDS = ['ssd', 'ram', 'battery', 'other', 'hand_down'] as const satisfies readonly OptionKind[]
export const PLAN_MAX_STEPS = 6

export const PlanStep = Type.Object(
  {
    category_id: Slug,
    option_id: Slug,
    title: Type.String({ minLength: 1, maxLength: 80 }),
    kind: Type.Enum(PLAN_STEP_KINDS),
  },
  {
    ...strict,
    description:
      'Refers to an option of the result. In the five-path fallback, the upgrade option is split into its ssd and ram steps, so one option can appear once per kind',
  },
)
export type PlanStep = Static<typeof PlanStep>

/**
 * The combined top recommendation (feature 013): Good fit options in order, at most one hand_down
 * step and only last, priced as one plan with the baseline credited once (FR-004). Not scored.
 */
export const Plan = Type.Object(
  {
    summary: Type.String({ minLength: 1, description: 'One sentence' }),
    steps: Type.Array(PlanStep, { minItems: 2, maxItems: PLAN_MAX_STEPS }),
    impact: Impact,
    impact_source: Type.Enum(['calculator', 'ai_estimate'], { description: 'ai_estimate when any step has AI-estimated figures (FR-006)' }),
  },
  strict,
)
export type Plan = Static<typeof Plan>

export const CategoryResult = Type.Object(
  {
    device_id: DeviceId,
    intended_use: IntendedUse,
    generated_at: IsoDateTime,
    source: Type.Enum(['llm', 'template'], { description: 'template = the five-path fallback (FR-013)' }),
    notice: Nullable(Type.String({ description: 'Shown when source is template: "AI explanation unavailable"' })),
    categories: Type.Array(Category, { minItems: 3, maxItems: 6 }),
    passages: Type.Array(Passage, { description: 'Every passage cited by any option claim' }),
    // Optional rather than nullable, so results without a plan (older servers, cached payloads) stay valid.
    plan: Type.Optional(Plan),
  },
  strict,
)
export type CategoryResult = Static<typeof CategoryResult>
