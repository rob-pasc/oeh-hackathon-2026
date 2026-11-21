// Mock API for the web app. It serves the fictional fixtures from shared/fixtures/ with short delays so the
// skeleton, the live status, and the streamed report can be seen without a backend. Never shown as real data:
// the UI marks mock mode with a "Sample data" badge.
import { ADMIN_PAGE_SIZE, type AdminScanRow } from '@leaaf/shared/admin'
import type { Assessment } from '@leaaf/shared/assessment'
import type { CategoryResult } from '@leaaf/shared/categories'
import type { DeviceRecord, DeviceScan } from '@leaaf/shared/device'
import desktopAssessmentJson from '@leaaf/fixtures/assessment.example-desktop-unknown.development.json'
import laptopAssessmentJson from '@leaaf/fixtures/assessment.example-laptop-14.office.json'
import desktopScanJson from '@leaaf/fixtures/device-scan.desktop-partial.json'
import laptopScanJson from '@leaaf/fixtures/device-scan.laptop-complete.json'
import { fallbackCategories, LAPTOP_CATEGORIES } from './mockCategories'
import { laptopPlan, templatePlan } from './mockSteps'
import { MOCK_LOOKUPS } from './mockParts'
import { partsFromScan, STEP_KINDS } from '../lib/parts'
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
  /** Delay between the assessment and the categories event (ms). */
  reportMs?: number
  /** Delay until a step plan arrives (ms). */
  stepsMs?: number
}

/** 22-character base64url ID from 128 random bits, the same shape as a device ID (feature 001 FR-008). */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** A session ID in the contract's format: 26 Crockford base32 characters (shared/src/session.ts). */
export function randomSessionId(): string {
  const bytes = new Uint8Array(26)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => CROCKFORD[b % 32]).join('')
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
  assessment.intended_use = use
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

/** Sample categories for the laptop; the five-path fallback, with its notice, for the desktop. */
function categoriesFor(deviceId: string, assessment: Assessment): CategoryResult {
  if (deviceId !== MOCK_DEVICE_IDS.laptop) return fallbackCategories(assessment)
  return { ...clone(LAPTOP_CATEGORIES), device_id: deviceId, intended_use: assessment.intended_use }
}

export function createMockClient(options: MockOptions = {}): ApiClient {
  const { stepMs = 900, assessmentMs = 1400, reportMs = 1600, stepsMs = 1500 } = options
  const known = new Set<string>(Object.values(MOCK_DEVICE_IDS))
  let adminLoggedIn = false

  return {
    mode: 'mock',

    async createScanSession(): Promise<ScanSession> {
      return { session_id: randomSessionId(), download_url: null }
    },

    subscribeScanSession(_sessionId, onEvent: (event: ScanSessionEvent) => void) {
      const timers: ReturnType<typeof setTimeout>[] = []
      const parts = partsFromScan(laptopScan)
      let t = 0
      for (const step of SCAN_STEPS) {
        timers.push(setTimeout(() => onEvent({ type: 'step', step: step.id, state: 'running' }), t))
        // Parts of this step appear one after another, then their lookups finish (sample results).
        const stepParts = parts.filter((p) => STEP_KINDS[step.id].includes(p.kind))
        stepParts.forEach((part, i) => {
          const found = t + stepMs * (0.15 + i * 0.15)
          timers.push(setTimeout(() => onEvent({ type: 'part', part: { ...part } }), found))
          const lookup = MOCK_LOOKUPS[part.part_id] ?? { lookup: 'not_found' as const, detail: null, source: null }
          timers.push(setTimeout(() => onEvent({ type: 'part', part: { ...part, ...lookup } }), found + stepMs * 0.4))
        })
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
      const categories = categoriesFor(deviceId, assessment)
      timers.push(setTimeout(() => handlers.onAssessment(assessment), assessmentMs))
      timers.push(
        setTimeout(() => {
          handlers.onCategories(categories)
          handlers.onEnd(categories.source === 'llm' ? 'complete' : 'fallback')
        }, assessmentMs + reportMs),
      )
      return () => timers.forEach((timer) => clearTimeout(timer))
    },

    async getSteps(deviceId, use, optionId) {
      if (!known.has(deviceId)) throw new ApiClientError('not_found', 'Device not found')
      const plan =
        deviceId === MOCK_DEVICE_IDS.laptop
          ? laptopPlan(deviceId, use, optionId)
          : templatePlan(categoriesFor(deviceId, assessmentFor(deviceId, use)), optionId)
      await new Promise((resolve) => setTimeout(resolve, stepsMs))
      if (!plan) throw new ApiClientError('not_found', 'Option not found')
      return plan
    },

    // Admin area (feature 016): a fixed sample login and a generated list, so the page can be
    // built without a server. The first two rows link to the sample devices above.
    async adminSession() {
      return adminLoggedIn ? { username: MOCK_ADMIN.username } : null
    },
    async adminLogin(username, password) {
      if (username !== MOCK_ADMIN.username || password !== MOCK_ADMIN.password)
        throw new ApiClientError('unauthorized', 'Wrong username or password')
      adminLoggedIn = true
    },
    async adminLogout() {
      adminLoggedIn = false
    },
    async adminScans(page) {
      if (!adminLoggedIn) throw new ApiClientError('unauthorized', 'Log in to see the admin area')
      const start = (page - 1) * ADMIN_PAGE_SIZE
      return {
        total: MOCK_ADMIN_SCANS.length,
        ai_usage: { day: '2026-11-21', used: 37, cap: 200 },
        page,
        page_size: ADMIN_PAGE_SIZE,
        scans: MOCK_ADMIN_SCANS.slice(start, start + ADMIN_PAGE_SIZE),
      }
    },
    async adminScan(deviceId) {
      if (!adminLoggedIn) throw new ApiClientError('unauthorized', 'Log in to see the admin area')
      const row = MOCK_ADMIN_SCANS.find((s) => s.device_id === deviceId)
      if (!row) throw new ApiClientError('not_found', 'device not found')
      const base = deviceId === MOCK_DEVICE_IDS.desktop ? desktopScan : laptopScan
      const scan = { ...clone(base), identity: { ...base.identity, manufacturer: row.manufacturer, product_version: row.model } }
      const first = deviceId === MOCK_DEVICE_IDS.laptop
      return {
        device: { device_id: deviceId, created_at: row.created_at, scan },
        ai: first
          ? {
              categories: [{ intended_use: 'general', generated_at: row.created_at }],
              steps: [{ intended_use: 'general', plans: 2 }],
              fallbacks: [{ created_at: row.created_at, call: 'steps', intended_use: 'general', option_id: 'battery-swap', reason: 'timeout' }],
            }
          : { categories: [], steps: [], fallbacks: [] },
      }
    },
  }
}

/** Sample admin login for mock mode only; the live server takes ADMIN_USERNAME and ADMIN_PASSWORD. */
export const MOCK_ADMIN = { username: 'admin', password: 'sample-admin-password' } as const

const MOCK_ADMIN_SCANS: AdminScanRow[] = Array.from({ length: 73 }, (_, i) => {
  const models = [
    ['LENOVO', 'ThinkPad T480', 'windows'],
    ['Dell Inc.', 'XPS 13 9360', 'windows'],
    ['Apple Inc.', 'MacBook Air', 'macos'],
    ['HP', 'HP EliteBook 840 G5', 'linux'],
    [null, null, null],
  ] as const
  const [manufacturer, model, os] = models[i % models.length]!
  const id = i === 0 ? MOCK_DEVICE_IDS.laptop : i === 1 ? MOCK_DEVICE_IDS.desktop : `mockScan${String(i).padStart(14, '0')}`
  return {
    device_id: id,
    created_at: new Date(Date.UTC(2026, 10, 21, 18) - i * 47 * 60_000).toISOString(),
    os_family: os,
    manufacturer,
    model,
    scan_status: i % 3 === 0 ? 'complete' : 'partial',
  }
})

export const mockClient = createMockClient()
