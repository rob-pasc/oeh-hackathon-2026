// Live API client for the routes in shared/src/api.ts, including the scan-session routes
// (POST /api/sessions, GET /api/sessions/:id/events; contract in shared/src/session.ts).
import type { Assessment } from '@leaaf/shared/assessment'
import { ADMIN_ROUTES, type AdminScanDetail, type AdminScanPage, type AdminSession } from '@leaaf/shared/admin'
import { API_ROUTES } from '@leaaf/shared/api'
import type { DeviceRecord } from '@leaaf/shared/device'
import type { ReportStatus } from '@leaaf/shared/report'
import type { CategoryResult } from '@leaaf/shared/categories'
import type { PlanStepList, StepPlan } from '@leaaf/shared/steps'
import { ApiClientError, type ApiClient, type ScanSession, type ScanSessionEvent } from './types'

async function readError(response: Response): Promise<ApiClientError> {
  const wait = Number(response.headers.get('retry-after'))
  const retryAfter = Number.isFinite(wait) && wait > 0 ? wait : undefined
  try {
    const body = (await response.json()) as { error?: string; message?: string }
    return new ApiClientError(body.error ?? 'internal', body.message ?? `Request failed (${response.status})`, retryAfter)
  } catch {
    return new ApiClientError('internal', `Request failed (${response.status})`, retryAfter)
  }
}

/** Admin calls send the session cookie, which the server scopes to /api/admin (feature 016). */
const adminPost = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

function parse<T>(event: Event): T | null {
  if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return null
  try {
    return JSON.parse(event.data) as T
  } catch {
    return null
  }
}

export const liveClient: ApiClient = {
  mode: 'live',

  async createScanSession(os): Promise<ScanSession> {
    const response = await fetch(API_ROUTES.createSession, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ os }),
    })
    if (!response.ok) throw await readError(response)
    return (await response.json()) as ScanSession
  },

  subscribeScanSession(sessionId, onEvent) {
    const source = new EventSource(API_ROUTES.sessionEvents(encodeURIComponent(sessionId)))
    const forward = (event: Event) => {
      const data = parse<ScanSessionEvent>(event)
      if (data) onEvent(data)
    }
    source.addEventListener('step', forward)
    // Proposed event (not agreed yet): { "type": "part", "part": DetectedPart }.
    source.addEventListener('part', forward)
    source.addEventListener('complete', (event) => {
      forward(event)
      source.close()
    })
    source.addEventListener('error', (event) => {
      const data = parse<ScanSessionEvent>(event)
      if (data) {
        onEvent(data)
        source.close()
      }
    })
    return () => source.close()
  },

  async getDevice(deviceId): Promise<DeviceRecord> {
    const response = await fetch(API_ROUTES.device(deviceId))
    if (!response.ok) throw await readError(response)
    return (await response.json()) as DeviceRecord
  },

  async getSteps(deviceId, use, optionId): Promise<StepPlan> {
    const response = await fetch(API_ROUTES.optionSteps(deviceId, optionId, use))
    if (!response.ok) throw await readError(response)
    return (await response.json()) as StepPlan
  },

  async getPlanSteps(deviceId, use): Promise<PlanStepList> {
    const response = await fetch(API_ROUTES.planSteps(deviceId, use))
    if (!response.ok) throw await readError(response)
    return (await response.json()) as PlanStepList
  },

  streamReport(deviceId, use, handlers) {
    const source = new EventSource(API_ROUTES.reportStream(deviceId, use))
    source.addEventListener('status', (event) => {
      const data = parse<ReportStatus>(event)
      if (data && data.phase === 'web_search') handlers.onStatus?.(data)
    })
    source.addEventListener('assessment', (event) => {
      const data = parse<Assessment>(event)
      if (data) handlers.onAssessment(data)
    })
    source.addEventListener('categories', (event) => {
      const data = parse<CategoryResult>(event)
      if (data && Array.isArray(data.categories)) handlers.onCategories(data)
    })
    source.addEventListener('end', (event) => {
      const data = parse<{ status: 'complete' | 'fallback' }>(event)
      handlers.onEnd(data?.status ?? 'complete')
      source.close()
    })
    // The server's `error` event carries an ApiError body; a native connection error has no data.
    source.addEventListener('error', (event) => {
      const data = parse<{ error?: string; message?: string }>(event)
      if (data) {
        handlers.onError(new ApiClientError(data.error ?? 'internal', data.message ?? 'The report could not be loaded.'))
      } else {
        handlers.onError(new ApiClientError('internal', 'The connection to the server was lost.'))
      }
      source.close()
    })
    return () => source.close()
  },

  async adminSession(): Promise<AdminSession | null> {
    const response = await fetch(ADMIN_ROUTES.session, { credentials: 'same-origin' })
    if (response.status === 401) return null
    if (!response.ok) throw await readError(response)
    return (await response.json()) as AdminSession
  },

  async adminLogin(username, password) {
    const response = await adminPost(ADMIN_ROUTES.login, { username, password })
    if (!response.ok) throw await readError(response)
  },

  async adminLogout() {
    const response = await adminPost(ADMIN_ROUTES.logout, {})
    if (!response.ok) throw await readError(response)
  },

  async adminScans(page): Promise<AdminScanPage> {
    const response = await fetch(ADMIN_ROUTES.scans(page), { credentials: 'same-origin' })
    if (!response.ok) throw await readError(response)
    return (await response.json()) as AdminScanPage
  },

  async adminScan(deviceId): Promise<AdminScanDetail> {
    const response = await fetch(ADMIN_ROUTES.scan(encodeURIComponent(deviceId)), { credentials: 'same-origin' })
    if (!response.ok) throw await readError(response)
    return (await response.json()) as AdminScanDetail
  },
}
