// Live API client for the routes in shared/src/api.ts, including the scan-session routes
// (POST /api/sessions, GET /api/sessions/:id/events; contract in shared/src/session.ts).
import type { Assessment } from '@leaaf/shared/assessment'
import { API_ROUTES } from '@leaaf/shared/api'
import type { DeviceRecord } from '@leaaf/shared/device'
import type { Report } from '@leaaf/shared/report'
import { ApiClientError, type ApiClient, type PathOption, type ScanSession, type ScanSessionEvent } from './types'

async function readError(response: Response): Promise<ApiClientError> {
  try {
    const body = (await response.json()) as { error?: string; message?: string }
    return new ApiClientError(body.error ?? 'internal', body.message ?? `Request failed (${response.status})`)
  } catch {
    return new ApiClientError('internal', `Request failed (${response.status})`)
  }
}

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

  streamReport(deviceId, use, handlers) {
    const source = new EventSource(API_ROUTES.reportStream(deviceId, use))
    source.addEventListener('assessment', (event) => {
      const data = parse<Assessment>(event)
      if (data) handlers.onAssessment(data)
    })
    source.addEventListener('report', (event) => {
      const data = parse<Report>(event)
      if (data) handlers.onReport(data)
    })
    // Proposed event (not in shared/ yet): { "options": PathOption[] }.
    source.addEventListener('options', (event) => {
      const data = parse<{ options: PathOption[] }>(event)
      if (data && Array.isArray(data.options)) handlers.onOptions?.(data.options)
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
}
