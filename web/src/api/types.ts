import type { Assessment } from '@leaaf/shared/assessment'
import type { DeviceRecord } from '@leaaf/shared/device'
import type { Report } from '@leaaf/shared/report'
import type { UseTag } from '../lib/labels'

import type { ScanSessionEvent, ScanStepId } from '@leaaf/shared/session'

// The session events are part of the shared contract (shared/src/session.ts, adopted 2026-11-20).
export type { ScanSessionEvent, ScanStepId } from '@leaaf/shared/session'

/** Status line text for each scanner step, in the order the scanner reports them. */
export const SCAN_STEPS: readonly { id: ScanStepId; running: string }[] = [
  { id: 'started', running: 'Starting the scanner…' },
  { id: 'cpu_memory', running: 'Reading CPU & memory…' },
  { id: 'storage', running: 'Checking storage health…' },
  { id: 'battery', running: 'Reading battery…' },
  { id: 'upload', running: 'Uploading & analysing…' },
]

/** Result of creating a scan session; the session ID is baked into the downloaded scanner. */
export interface ScanSession {
  session_id: string
  /** null in mock mode, where there is no executable to download. */
  download_url: string | null
}

export class ApiClientError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
  }
}

export interface ReportStreamHandlers {
  onAssessment: (assessment: Assessment) => void
  onReport: (report: Report) => void
  onEnd: (status: 'complete' | 'fallback') => void
  onError: (error: ApiClientError) => void
}

export interface ApiClient {
  mode: 'mock' | 'live'
  createScanSession(): Promise<ScanSession>
  /** Subscribes to the scanner's progress; returns an unsubscribe function. */
  subscribeScanSession(sessionId: string, onEvent: (event: ScanSessionEvent) => void): () => void
  getDevice(deviceId: string): Promise<DeviceRecord>
  /** Streams assessment, then report, then end (shared/src/report.ts); returns a cancel function. */
  streamReport(deviceId: string, use: UseTag, handlers: ReportStreamHandlers): () => void
}
