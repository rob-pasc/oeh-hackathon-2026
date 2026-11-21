export * from './common.ts'
export * from './device.ts'
export * from './retrieval.ts'
export * from './facts.ts'
export * from './assessment.ts'
export * from './report.ts'
export * from './categories.ts'
export * from './steps.ts'
export * from './api.ts'
export * from './session.ts'
export * from './ranking.ts'
export * from './invariants.ts'
export * from './validate.ts'

import { Assessment } from './assessment.ts'
import { CategoryResult } from './categories.ts'
import { ApiError, DeviceRecord, DeviceScan, UploadResponse } from './device.ts'
import { Fact, FactSet } from './facts.ts'
import { Report, StreamEnd } from './report.ts'
import { Passage, RetrievalResult } from './retrieval.ts'
import { StepPlan } from './steps.ts'
import { ScanSession, ScanSessionEvent, ScanSessionRequest, ScannerEvent } from './session.ts'

/** Every top-level schema, exported to shared/schemas/<$id>.schema.json for non-TS consumers. */
export const TOP_LEVEL_SCHEMAS = {
  DeviceScan,
  UploadResponse,
  DeviceRecord,
  ApiError,
  Passage,
  RetrievalResult,
  Fact,
  FactSet,
  Assessment,
  Report,
  CategoryResult,
  StepPlan,
  StreamEnd,
  ScanSession,
  ScanSessionRequest,
  ScannerEvent,
  ScanSessionEvent,
} as const
