// Builds the Assessment for one device and intended use (feature 003). Deterministic: the same
// inputs and clock give the same output. The total score and order are left to the client
// (shared/src/ranking.ts), so the mode toggle needs no request (FR-013).
import type { Assessment, DeviceId, DeviceScan, Fact, IntendedUse, ModelEvidence } from '@leaaf/shared'
import type { ImpactTable } from '../impact/table.ts'
import { baselineFor, calculateImpact, indexImpactTable } from './calculator.ts'
import { runGates } from './gates.ts'
import { confidence, scorePath } from './scoring.ts'
import type { WeightConfig } from './weights.ts'

export interface AssessInput {
  deviceId: DeviceId
  scan: DeviceScan
  use: IntendedUse
  /** From retrieval (feature 002); `none` when no document matches the exact model. */
  modelEvidence: ModelEvidence
  /** Facts extracted from the retrieved passages (server/src/facts/). */
  facts: readonly Fact[]
  impactTable: ImpactTable
  weights: WeightConfig
  now?: Date
}

export function assess(input: AssessInput): Assessment {
  const { scan, use, modelEvidence } = input
  const impactIndex = indexImpactTable(input.impactTable)
  const baseline = baselineFor(scan, impactIndex)
  const paths = runGates({ scan, use, modelEvidence, facts: input.facts }).map((gate) => {
    const impact = gate.plan && gate.status !== 'not_suitable' ? calculateImpact({ plan: gate.plan, use, scan, baseline, impact: impactIndex }) : null
    return {
      path: gate.path,
      status: gate.status,
      reasons: gate.reasons,
      scores: impact ? scorePath({ gate, impact, use, baselineCost: baseline.cost_eur }) : null,
      impact,
      confidence: confidence({ gate, impact, scan, modelEvidence, impactIndex }),
    }
  })
  return {
    device_id: input.deviceId,
    intended_use: use,
    created_at: (input.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    model_evidence: modelEvidence,
    weights: input.weights,
    baseline,
    paths,
  }
}
