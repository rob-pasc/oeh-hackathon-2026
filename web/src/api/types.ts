import type { Assessment } from '@leaaf/shared/assessment'
import type { DeviceRecord } from '@leaaf/shared/device'
import type { Report } from '@leaaf/shared/report'
import type { UseTag } from '../lib/labels'

/**
 * Steps the scanner reports while it runs, in order. PROPOSED contract: the scan-session events are
 * not part of shared/ yet and have to be agreed with the backend team (feature-006 DESIGN.md).
 */
export type ScanStepId = 'started' | 'cpu_memory' | 'storage' | 'battery' | 'upload'

export const SCAN_STEPS: readonly { id: ScanStepId; running: string }[] = [
  { id: 'started', running: 'Starting the scanner…' },
  { id: 'cpu_memory', running: 'Reading CPU & memory…' },
  { id: 'storage', running: 'Checking storage health…' },
  { id: 'battery', running: 'Reading battery…' },
  { id: 'upload', running: 'Uploading & analysing…' },
]

export type ScanSessionEvent =
  | { type: 'step'; step: ScanStepId; state: 'running' | 'done' | 'skipped' }
  | { type: 'complete'; device_id: string }
  | { type: 'error'; code: 'scanner_failed' | 'upload_failed' | 'timeout' | 'unknown'; message: string }

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
