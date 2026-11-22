// Runs one assessment end to end (feature 003 T-007): retrieval, web evidence for topics the corpus
// does not cover (feature 017), cached fact extraction, then the pure assess(). Unlike the rest of
// this folder it has side effects (index reads, web and LLM calls), so the route stays thin and
// tests can swap each dependency.
import { usesWindowsRules, type Assessment, type DeviceRecord, type FactSet, type IntendedUse, type RetrievalResult } from '@leaaf/shared'
import { factModel, type FactExtractor } from '../facts/index.ts'
import type { ImpactTable } from '../impact/table.ts'
import { LlmError } from '../llm/index.ts'
import type { Retriever } from '../retrieval/index.ts'
import { finishWebEvidence, type WebEvidence } from '../search/evidence.ts'
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
  /** null or absent when web search is off (feature 017 FR-011); needs an extractor to matter. */
  webEvidence?: WebEvidence | null
  impactTable: ImpactTable
  weights: WeightConfig
  /** Receives non-fatal problems, such as a failed fact extraction; never device IDs. */
  warn?: (message: string, details?: Record<string, unknown>) => void
  now?: () => Date
}

export interface AssessOptions {
  /** Called when a fresh web search starts, for the report stream's status event (feature 017 FR-013). */
  onWebSearch?: () => void
}

export interface AssessmentService {
  assessDevice(record: DeviceRecord, use: IntendedUse, options?: AssessOptions): Promise<DeviceAssessment>
}

export function createAssessmentService(deps: AssessmentServiceDeps): AssessmentService {
  return {
    async assessDevice(record, use, options = {}) {
      const corpus = deps.retriever.retrieve(record.scan)
      // Without fact extraction, web passages could support nothing, so no search runs.
      const searched = deps.webEvidence && deps.extractor
        ? await deps.webEvidence.augment(corpus, factModel({ scan: record.scan, retrieval: corpus }), options.onWebSearch ? { onSearch: options.onWebSearch } : {})
        : corpus
      const finished = finishWebEvidence(searched, await extractFacts(record, searched))
      const retrieval = finished.retrieval
      const facts = withoutWindowsFacts(record.scan, finished.facts)
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
   * Generic passages can still mention Microsoft's CPU list, so a Mac or Linux device drops that
   * fact before the gates and the explanation see it (feature 007 FR-015).
   */
  function withoutWindowsFacts(scan: DeviceRecord['scan'], set: FactSet): FactSet {
    if (usesWindowsRules(scan)) return set
    return { ...set, facts: set.facts.filter((f) => f.key !== 'windows11_supported_cpu') }
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
