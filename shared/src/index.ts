export * from './common.ts'
export * from './device.ts'
export * from './retrieval.ts'
export * from './facts.ts'
export * from './assessment.ts'
export * from './report.ts'
export * from './categories.ts'
export * from './steps.ts'
export * from './parts.ts'
export * from './api.ts'
export * from './session.ts'
export * from './ranking.ts'
export * from './invariants.ts'
export * from './validate.ts'
export * from './admin.ts'
export * from './prices.ts'

import { AdminLogin, AdminScanDetail, AdminScanPage, AdminSession } from './admin.ts'
import { Assessment } from './assessment.ts'
import { CategoryResult } from './categories.ts'
import { ApiError, DeviceRecord, DeviceScan, UploadResponse } from './device.ts'
import { Fact, FactSet } from './facts.ts'
import { Report, ReportStatus, StreamEnd } from './report.ts'
import { DeviceLocation, LocalOfferList, LocationRequest, WebPriceList } from './prices.ts'
import { Passage, RetrievalResult } from './retrieval.ts'
import { StepPlan, PlanStepList } from './steps.ts'
import { PartLookupResult } from './parts.ts'
import { ScanSession, ScanSessionEvent, ScanSessionRequest, ScannerEvent } from './session.ts'

/** Every top-level schema, exported to shared/schemas/<$id>.schema.json for non-TS consumers. */
export const TOP_LEVEL_SCHEMAS = {
  AdminLogin,
  AdminSession,
  AdminScanPage,
  AdminScanDetail,
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
  PlanStepList,
  PartLookupResult,
  StreamEnd,
  ReportStatus,
  ScanSession,
  ScanSessionRequest,
  ScannerEvent,
  ScanSessionEvent,
  WebPriceList,
  LocalOfferList,
  LocationRequest,
  DeviceLocation,
} as const
