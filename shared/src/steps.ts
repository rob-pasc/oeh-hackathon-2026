// Step plans for one option (feature 009).
//
// GET /api/devices/:id/options/:optionId/steps?intended_use=<use>  -> 200 StepPlan (JSON)
//
// The browser requests a plan when an option card is opened for the first time. The server makes
// one step call per device, intended use and option and caches it (FR-001); failures and the
// five-path fallback get a template plan instead (FR-011, FR-012).
import { Type, type Static } from 'typebox'
import { DeviceId, IntendedUse, IsoDateTime, Nullable, PassageId, Range } from './common.ts'
import { Slug } from './categories.ts'
import { Passage } from './retrieval.ts'

const strict = { additionalProperties: false } as const

/** At most 12 steps per plan (FR-002). */
export const MAX_STEPS = 12
/** Step titles fit one line of the card (FR-002). */
export const STEP_TITLE_MAX = 80

export const STEP_SAFETY = ['none', 'caution', 'professional'] as const
export const StepSafety = Type.Enum(STEP_SAFETY, {
  description: 'caution = shows the warning sentence; professional = "Professional only", the detail says to have a service provider do it (FR-004)',
})
export type StepSafety = Static<typeof StepSafety>

export const STEP_KINDS = ['technical', 'general'] as const
export const StepKind = Type.Enum(STEP_KINDS, {
  description: 'technical = opening the device, handling internal parts, part specifications or compatibility; it needs a citation (FR-005)',
})
export type StepKind = Static<typeof StepKind>

export const Step = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: STEP_TITLE_MAX, description: 'Imperative, e.g. "Remove the bottom cover"' }),
    detail: Type.String({ minLength: 1, description: 'One to three sentences saying how to do it' }),
    tools: Type.Array(Type.String({ minLength: 1 }), { description: 'e.g. "Phillips #0 screwdriver"; empty when none' }),
    parts: Type.Array(Type.String({ minLength: 1 }), { description: 'With their specification, e.g. "8 GB DDR4-2400 SO-DIMM"' }),
    minutes: Nullable(Range),
    safety: StepSafety,
    warning: Nullable(Type.String({ minLength: 1, description: 'The warning sentence; set exactly when safety is caution' })),
    kind: StepKind,
    passage_ids: Type.Array(PassageId),
  },
  strict,
)
export type Step = Static<typeof Step>

export const StepPlan = Type.Object(
  {
    device_id: DeviceId,
    intended_use: IntendedUse,
    option_id: Slug,
    generated_at: IsoDateTime,
    source: Type.Enum(['llm', 'template'], { description: 'template = a template plan for the option kind (FR-011, FR-012)' }),
    notice: Nullable(Type.String({ description: 'Shown when source is template: "AI steps unavailable"' })),
    steps: Type.Array(Step, {
      maxItems: MAX_STEPS,
      description: 'Empty when the server removed every step; the card then says no verified steps exist yet (FR-006)',
    }),
    passages: Type.Array(Passage, { description: 'Every passage cited by any step' }),
  },
  strict,
)
export type StepPlan = Static<typeof StepPlan>
