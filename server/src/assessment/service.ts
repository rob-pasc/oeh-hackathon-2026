// Runs one assessment end to end (feature 003 T-007): retrieval, cached fact extraction, then the
// pure assess(). Unlike the rest of this folder it has side effects (index reads, LLM calls), so the
// route stays thin and tests can swap each dependency.
import type { Assessment, DeviceRecord, FactSet, IntendedUse, RetrievalResult } from '@leaaf/shared'
import { factModel, type FactExtractor } from '../facts/index.ts'
import type { ImpactTable } from '../impact/table.ts'
import { LlmError } from '../llm/index.ts'
import type { Retriever } from '../retrieval/index.ts'
import { assess } from './assess.ts'
import type { WeightConfig } from './weights.ts'

/** Everything the report (feature 004) needs besides the assessment itself. */
export interface DeviceAssessment {
  assessment: Assessment
  retrieval: RetrievalResult
  facts: FactSet
}

export interface AssessmentServiceDeps {
  retriever: Retriever
  /** null when no LLM is configured: every path is then assessed without facts. */
  extractor: FactExtractor | null
  impactTable: ImpactTable
  weights: WeightConfig
  /** Receives non-fatal problems, such as a failed fact extraction; never device IDs. */
  warn?: (message: string, details?: Record<string, unknown>) => void
  now?: () => Date
}

export interface AssessmentService {
  assessDevice(record: DeviceRecord, use: IntendedUse): Promise<DeviceAssessment>
}

export function createAssessmentService(deps: AssessmentServiceDeps): AssessmentService {
  return {
    async assessDevice(record, use) {
      const retrieval = deps.retriever.retrieve(record.scan)
      const facts = await extractFacts(record, retrieval)
      const assessment = assess({
        deviceId: record.device_id,
        scan: record.scan,
        use,
        modelEvidence: retrieval.model_evidence,
        facts: facts.facts,
        impactTable: deps.impactTable,
        weights: deps.weights,
        ...(deps.now ? { now: deps.now() } : {}),
      })
      return { assessment, retrieval, facts }
    },
  }

  /**
   * An LLM failure degrades rather than fails: with no facts, compatibility-dependent paths become
   * "cannot verify" (FR-004) and the owner still gets a ranking. Nothing is cached then, so the
   * next request retries.
   */
  async function extractFacts(record: DeviceRecord, retrieval: RetrievalResult): Promise<FactSet> {
    const none: FactSet = { model: factModel({ scan: record.scan, retrieval }), facts: [] }
    if (!deps.extractor) return none
    try {
      return (await deps.extractor.extract({ scan: record.scan, retrieval })).facts
    } catch (error) {
      if (!(error instanceof LlmError)) throw error
      deps.warn?.('fact extraction failed; assessing without facts', { kind: error.kind })
      return none
    }
  }
}
