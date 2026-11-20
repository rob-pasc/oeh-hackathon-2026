import type { Assessment, Impact } from '@leaaf/shared/assessment'
import type { Path, Suitability } from '@leaaf/shared/common'
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

/**
 * One concrete action inside a path, for example the SSD upgrade or the RAM upgrade inside "upgrade".
 * PROPOSED contract: shared/ delivers only one combined result per path today, so the web app shows options
 * only when the server sends them (feature-006 DESIGN.md). `impact` has the same shape and meaning as the path's
 * impact, and is null for options that are not suitable.
 */
export interface PathOption {
  option_id: string
  path: Path
  title: string
  status: Suitability
  summary: string
  impact: Impact | null
  steps: string[]
  why: string | null
  unverified: string[]
}

export interface ReportStreamHandlers {
  onAssessment: (assessment: Assessment) => void
  onReport: (report: Report) => void
  /** Proposed `options` event; optional because the contract does not define it yet. */
  onOptions?: (options: PathOption[]) => void
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
