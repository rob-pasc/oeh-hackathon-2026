// HTTP routes between the scanner, server, and web app. JSON bodies use the schemas in
// device.ts and report.ts; every non-2xx JSON response uses ApiError.
//
// POST /api/devices                        body DeviceScan     -> 201 UploadResponse | 400/413/429 ApiError
// GET  /api/devices/:id                                        -> 200 DeviceRecord   | 404 ApiError
// GET  /api/devices/:id/report?intended_use=<IntendedUse>      -> text/event-stream (see report.ts) | 400/404/429 ApiError
// GET  /downloads/leaaf-scanner.exe[?session=<SessionId>]       -> the Windows scanner, with the session appended
// GET  /downloads/leaaf-scanner-linux[?session=<SessionId>]     -> the Linux scanner, with the session appended
// GET  /downloads/leaaf-scanner-macos.zip[?session=<SessionId>] -> the zipped macOS app, bundle renamed for the session
// POST /api/sessions                       body ScanSessionRequest (optional) -> 201 ScanSession (session.ts)
// POST /api/sessions/:id/events            body ScannerEvent   -> 204 | 400/404 ApiError
// GET  /api/sessions/:id/events                                -> text/event-stream of ScanSessionEvent (latest replayed) | 404
//
// Web routes: "/" (landing and download) and "/d/:id" (device page and report).
import type { DeviceId, IntendedUse, OsFamily } from './common.ts'

/** Scanner download per system (feature 007 FR-012). The Windows path predates the others. */
export const SCANNER_DOWNLOADS: Record<OsFamily, string> = {
  windows: '/downloads/leaaf-scanner.exe',
  macos: '/downloads/leaaf-scanner-macos.zip',
  linux: '/downloads/leaaf-scanner-linux',
}

export const API_ROUTES = {
  uploadDevice: '/api/devices',
  device: (id: DeviceId) => `/api/devices/${id}`,
  reportStream: (id: DeviceId, use: IntendedUse) =>
    `/api/devices/${id}/report?intended_use=${encodeURIComponent(use)}`,
  /** The Windows download; see SCANNER_DOWNLOADS for the others. */
  scannerDownload: SCANNER_DOWNLOADS.windows,
  createSession: '/api/sessions',
  sessionEvents: (id: string) => `/api/sessions/${id}/events`,
} as const

export const WEB_ROUTES = {
  landing: '/',
  device: (id: DeviceId) => `/d/${id}`,
  session: (id: string) => `/s/${id}`,
} as const

/** Upper bound for an upload body (feature 001 NFR; enforced by the server). */
export const MAX_UPLOAD_BYTES = 32 * 1024
