import type { Assessment, Impact } from '@leaaf/shared/assessment'
import type { Path, Suitability } from '@leaaf/shared/common'
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
