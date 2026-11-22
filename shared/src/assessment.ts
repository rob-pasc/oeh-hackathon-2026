// Assessment result: suitability, impact ranges, and criterion scores per path (feature 003).
// The total score and the order are NOT part of the payload; the web app derives them with
// ranking.ts so the mode toggle needs no request (feature 003 FR-013).
import { Type, type Static } from 'typebox'
import {
  ConfidenceLevel,
  DeviceId,
  ImpactRef,
  IntendedUse,
  IsoDateTime,
  Nullable,
  PassageId,
  Path,
  Range,
  Suitability,
} from './common.ts'
import { FACT_KEYS } from './facts.ts'
import { ModelEvidence } from './retrieval.ts'

const strict = { additionalProperties: false } as const

export const CRITERIA = ['environment', 'useful_life', 'economic', 'feasibility'] as const
export type Criterion = (typeof CRITERIA)[number]

/** Percent weights per criterion; must sum to 100 (checked in invariants.ts). */
export const Weights = Type.Object(
  {
    environment: Type.Integer({ minimum: 0, maximum: 100 }),
    useful_life: Type.Integer({ minimum: 0, maximum: 100 }),
    economic: Type.Integer({ minimum: 0, maximum: 100 }),
    feasibility: Type.Integer({ minimum: 0, maximum: 100 }),
  },
  strict,
)
export type Weights = Static<typeof Weights>

export const CriterionScores = Type.Object(
  {
    environment: Type.Number({ minimum: 0, maximum: 100 }),
    useful_life: Type.Number({ minimum: 0, maximum: 100 }),
    economic: Type.Number({ minimum: 0, maximum: 100 }),
    feasibility: Type.Number({ minimum: 0, maximum: 100 }),
  },
  strict,
)
export type CriterionScores = Static<typeof CriterionScores>

export const Reason = Type.Object(
  {
    code: Type.String({ minLength: 1, description: 'Stable machine code, e.g. ram_soldered, cannot_verify_storage' }),
    text: Type.String({ minLength: 1 }),
    fact_keys: Type.Array(Type.Enum(FACT_KEYS)),
    passage_ids: Type.Array(PassageId),
  },
  strict,
)

export const Assumption = Type.Object(
  { text: Type.String({ minLength: 1 }), impact_refs: Type.Array(ImpactRef) },
  strict,
)

export const Baseline = Type.Object(
  {
    description: Type.String({ description: 'e.g. "The owner buys a comparable new laptop now"' }),
    co2e_kg: Range,
    cost_eur: Range,
    impact_refs: Type.Array(ImpactRef, { minItems: 1 }),
  },
  strict,
)

export const Impact = Type.Object(
  {
    cost_eur: Range,
    useful_life_years: Range,
    co2e_kg: Type.Object(
      {
        path: Range,
        baseline: Range,
        avoided_vs_baseline: Range,
      },
      {
        ...strict,
        description:
          'path = emissions caused by this path (e.g. parts production). avoided_vs_baseline = credited baseline minus path; positive means less CO2e than buying new. How much of the baseline is credited depends on displacement.',
      },
    ),
    displacement: Type.Enum(['assumed', 'conditional', 'none'], {
      description:
        'How much avoided new-device production is credited: assumed = credited (owner keeps using the device instead of buying new); conditional = credited only in the high end of the range (pass_on: only if the recipient would otherwise buy new), so avoided_vs_baseline.low <= 0; none = not credited (e.g. recycle), so avoided_vs_baseline.high <= 0',
    }),
    assumptions: Type.Array(Assumption, { minItems: 1 }),
  },
  strict,
)
export type Impact = Static<typeof Impact>

export const PathAssessment = Type.Object(
  {
    path: Path,
    status: Suitability,
    reasons: Type.Array(Reason, { minItems: 1 }),
    scores: Nullable(CriterionScores),
    impact: Nullable(Impact),
    confidence: Type.Object(
      { level: ConfidenceLevel, reasons: Type.Array(Type.String({ minLength: 1 })) },
      strict,
    ),
  },
  {
    ...strict,
    description: 'not_suitable paths have scores = null and impact = null; others have both (invariants.ts)',
  },
)
export type PathAssessment = Static<typeof PathAssessment>

export const Assessment = Type.Object(
  {
    device_id: DeviceId,
    intended_use: IntendedUse,
    created_at: IsoDateTime,
    model_evidence: ModelEvidence,
    weights: Type.Object(
      { environment_first: Weights, money_first: Weights },
      { ...strict, description: 'Illustrative defaults from config; see feature 003 FR-011' },
    ),
    baseline: Baseline,
    paths: Type.Array(PathAssessment, {
      minItems: 5,
      maxItems: 5,
      description: 'Each of the five paths exactly once, in no particular order',
    }),
  },
  { ...strict },
)
export type Assessment = Static<typeof Assessment>
