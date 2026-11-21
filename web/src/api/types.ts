import type { Assessment, Impact } from '@leaaf/shared/assessment'
import type { OsFamily, Path, Suitability } from '@leaaf/shared/common'
import type { DeviceRecord } from '@leaaf/shared/device'
import type { Report } from '@leaaf/shared/report'
import type { UseTag } from '../lib/labels'

import type { ScanSessionEvent as SharedScanSessionEvent, ScanStepId } from '@leaaf/shared/session'

// The session events are part of the shared contract (shared/src/session.ts, adopted 2026-11-20).
export type { ScanStepId } from '@leaaf/shared/session'

/** Status line text for each scanner step, in the order the scanner reports them. */
export const SCAN_STEPS: readonly { id: ScanStepId; running: string }[] = [
  { id: 'started', running: 'Starting the scanner…' },
  { id: 'cpu_memory', running: 'Reading CPU & memory…' },
  { id: 'storage', running: 'Checking storage health…' },
  { id: 'battery', running: 'Reading battery…' },
  { id: 'upload', running: 'Uploading & analysing…' },
]

/** Kind of a hardware part the scanner reports; decides the icon and the zone in the laptop view. */
export type PartKind = 'cpu' | 'memory' | 'gpu' | 'storage' | 'battery'

/**
 * How far the server got in looking the part up: `pending` while it searches, `catalog` when the part was found
 * in the team's parts list, `ai` when an AI web search found it (less certain, shown as "check"), `not_found`
 * when neither found it.
 */
export type PartLookup = 'pending' | 'catalog' | 'ai' | 'not_found'

/**
 * One part found by the scanner, plus what the server learned about it. PROPOSED contract (feature-006
 * DESIGN.md, "Proposed part event"): the server sends the same `part_id` again when the lookup finishes, and the
 * page replaces the earlier entry.
 */
export interface DetectedPart {
  part_id: string
  kind: PartKind
  /** Short name of the part, e.g. "Processor". */
  label: string
  /** What the scanner read, e.g. "Intel Core i5-8250U · 4 cores". */
  value: string
  lookup: PartLookup
  /** One short sentence from the parts list or the AI search, e.g. "Soldered to the board." */
  detail: string | null
  /** Where an AI finding comes from; null for the parts list and while pending. */
  source: { label: string; url: string } | null
}

/** The shared session events plus the proposed `part` event, which is not in shared/ yet. */
export type ScanSessionEvent = SharedScanSessionEvent | { type: 'part'; part: DetectedPart }

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
/** One spec line an option changes, e.g. Memory "8 GB" → "16 GB". Proposed, like the option itself. */
export interface SpecChange {
  label: string
  before: string
  after: string
}

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
  /** Optional proposed field: what the option changes on the device, for the before/after view. */
  changes?: SpecChange[]
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
  /** Starts a scan session whose download is the scanner for `os` (feature 007 FR-012). */
  createScanSession(os: OsFamily): Promise<ScanSession>
  /** Subscribes to the scanner's progress; returns an unsubscribe function. */
  subscribeScanSession(sessionId: string, onEvent: (event: ScanSessionEvent) => void): () => void
  getDevice(deviceId: string): Promise<DeviceRecord>
  /** Streams assessment, then report, then end (shared/src/report.ts); returns a cancel function. */
  streamReport(deviceId: string, use: UseTag, handlers: ReportStreamHandlers): () => void
}
