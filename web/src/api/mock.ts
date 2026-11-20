// Mock API for the web app. It serves the fictional fixtures from shared/fixtures/ with short delays so the
// skeleton, the live status, and the streamed report can be seen without a backend. Never shown as real data:
// the UI marks mock mode with a "Sample data" badge.
import type { Assessment } from '@leaaf/shared/assessment'
import type { DeviceRecord, DeviceScan } from '@leaaf/shared/device'
import type { Report } from '@leaaf/shared/report'
import desktopAssessmentJson from '@leaaf/fixtures/assessment.example-desktop-unknown.development.json'
import laptopAssessmentJson from '@leaaf/fixtures/assessment.example-laptop-14.office.json'
import desktopScanJson from '@leaaf/fixtures/device-scan.desktop-partial.json'
import laptopScanJson from '@leaaf/fixtures/device-scan.laptop-complete.json'
import laptopReportJson from '@leaaf/fixtures/report.example-laptop-14.office.json'
import { LAPTOP_OPTIONS } from './mockOptions'
import { ApiClientError, SCAN_STEPS, type ApiClient, type ScanSession, type ScanSessionEvent } from './types'
import type { UseTag } from '../lib/labels'

/** Device IDs of the two fixture devices (the IDs used inside the fixtures). */
export const MOCK_DEVICE_IDS = {
  laptop: 'q3Xk9vT2mB7pLw0cZr1sEa',
  desktop: 'Zp4Wc8nR1tYv6Lm2Qa9xKe',
} as const

export interface MockOptions {
  /** Time each scan step takes (ms). */
  stepMs?: number
  /** Delay until the assessment event (ms). */
  assessmentMs?: number
  /** Delay between the assessment and the report event (ms). */
  reportMs?: number
}

/** 22-character base64url ID from 128 random bits, the same shape as a device ID (feature 001 FR-008). */
export function randomId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const laptopScan = laptopScanJson as unknown as DeviceScan
const desktopScan = desktopScanJson as unknown as DeviceScan

const clone = <T>(value: T): T => structuredClone(value)
const clamp = (n: number) => Math.min(100, Math.max(0, n))

// Mock only: the real server computes these. Small score shifts so that changing the tag visibly changes the
// ranking in demos. They are not part of any contract.
const USE_ADJUSTMENTS: Partial<Record<UseTag, Partial<Record<string, Partial<Record<string, number>>>>>> = {
  study: {},
  development: { upgrade: { useful_life: -5 }, pass_on: { feasibility: -10 } },
  pass_on: { pass_on: { environment: 25, useful_life: 15, economic: 10, feasibility: 10 }, upgrade: { useful_life: -20 } },
  gaming: { upgrade: { useful_life: -15, feasibility: -10 }, pass_on: { feasibility: -10 } },
}

function assessmentFor(deviceId: string, use: UseTag): Assessment {
  const isDesktop = deviceId === MOCK_DEVICE_IDS.desktop
  const assessment = clone((isDesktop ? desktopAssessmentJson : laptopAssessmentJson) as unknown as Assessment)
  // The contract has no `gaming` tag yet; the mock simply echoes the chosen tag.
  assessment.intended_use = use as Assessment['intended_use']
  if (!isDesktop) {
    const adjustments = USE_ADJUSTMENTS[use] ?? {}
    for (const path of assessment.paths) {
      const delta = adjustments[path.path]
      if (!delta || !path.scores) continue
      for (const key of Object.keys(delta)) {
        const k = key as keyof typeof path.scores
        path.scores[k] = clamp(path.scores[k] + (delta[key] ?? 0))
      }
    }
  }
  return assessment
}

/** Template text built from the assessment reasons, like the server's fallback (feature 004 FR-009). */
function templateReport(assessment: Assessment): Report {
  return {
    device_id: assessment.device_id,
    intended_use: assessment.intended_use,
    generated_at: new Date().toISOString(),
    source: 'template',
    notice: 'AI explanation unavailable. Showing standard text.',
    paths: assessment.paths.map((p) => ({
      path: p.path,
      summary: p.reasons[0]?.text ?? 'No details available.',
      next_steps: [],
      why: p.reasons.map((r) => r.text).join(' '),
      assumptions: [],
      safety: [],
      unverified: p.status === 'viable' ? [] : p.reasons.map((r) => r.text),
      claims: [],
    })),
    passages: [],
  }
}

function reportFor(deviceId: string, assessment: Assessment): Report {
  if (deviceId === MOCK_DEVICE_IDS.laptop) {
    const report = clone(laptopReportJson as unknown as Report)
    report.intended_use = assessment.intended_use
    return report
  }
  return templateReport(assessment)
}

export function createMockClient(options: MockOptions = {}): ApiClient {
  const { stepMs = 650, assessmentMs = 1400, reportMs = 1600 } = options
  const known = new Set<string>(Object.values(MOCK_DEVICE_IDS))

  return {
    mode: 'mock',

    async createScanSession(): Promise<ScanSession> {
      return { session_id: randomId(), download_url: null }
    },

    subscribeScanSession(_sessionId, onEvent: (event: ScanSessionEvent) => void) {
      const timers: ReturnType<typeof setTimeout>[] = []
      let t = 0
      for (const step of SCAN_STEPS) {
        timers.push(setTimeout(() => onEvent({ type: 'step', step: step.id, state: 'running' }), t))
        t += stepMs
        timers.push(setTimeout(() => onEvent({ type: 'step', step: step.id, state: 'done' }), t))
      }
      timers.push(setTimeout(() => onEvent({ type: 'complete', device_id: MOCK_DEVICE_IDS.laptop }), t + 300))
      return () => timers.forEach((timer) => clearTimeout(timer))
    },

    async getDevice(deviceId): Promise<DeviceRecord> {
      if (!known.has(deviceId)) throw new ApiClientError('not_found', 'Device not found')
      const scan = deviceId === MOCK_DEVICE_IDS.desktop ? desktopScan : laptopScan
      return { device_id: deviceId, created_at: scan.scanned_at, scan: clone(scan) }
    },

    streamReport(deviceId, use, handlers) {
      const timers: ReturnType<typeof setTimeout>[] = []
      if (!known.has(deviceId)) {
        timers.push(setTimeout(() => handlers.onError(new ApiClientError('not_found', 'Device not found')), 200))
        return () => timers.forEach((timer) => clearTimeout(timer))
      }
      const assessment = assessmentFor(deviceId, use)
      const report = reportFor(deviceId, assessment)
      timers.push(setTimeout(() => handlers.onAssessment(assessment), assessmentMs))
      timers.push(
        setTimeout(() => {
          handlers.onReport(report)
          // Options exist for the laptop fixture only; the desktop fixture shows the path-level steps instead.
          if (deviceId === MOCK_DEVICE_IDS.laptop) handlers.onOptions?.(clone(LAPTOP_OPTIONS))
          handlers.onEnd(report.source === 'llm' ? 'complete' : 'fallback')
        }, assessmentMs + reportMs),
      )
      return () => timers.forEach((timer) => clearTimeout(timer))
    },
  }
}

export const mockClient = createMockClient()
