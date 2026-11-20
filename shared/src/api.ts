// HTTP routes between the scanner, server, and web app. JSON bodies use the schemas in
// device.ts and report.ts; every non-2xx JSON response uses ApiError.
//
// POST /api/devices                        body DeviceScan     -> 201 UploadResponse | 400/413/429 ApiError
// GET  /api/devices/:id                                        -> 200 DeviceRecord   | 404 ApiError
// GET  /api/devices/:id/report?intended_use=<IntendedUse>      -> text/event-stream (see report.ts) | 400/404 ApiError
// GET  /downloads/second-life-scanner.exe                      -> the scanner executable
//
// Web routes: "/" (landing and download) and "/d/:id" (device page and report).
import type { DeviceId, IntendedUse } from './common.ts'

export const API_ROUTES = {
  uploadDevice: '/api/devices',
  device: (id: DeviceId) => `/api/devices/${id}`,
  reportStream: (id: DeviceId, use: IntendedUse) =>
    `/api/devices/${id}/report?intended_use=${encodeURIComponent(use)}`,
  scannerDownload: '/downloads/second-life-scanner.exe',
} as const

export const WEB_ROUTES = {
  landing: '/',
  device: (id: DeviceId) => `/d/${id}`,
} as const

/** Upper bound for an upload body (feature 001 NFR; enforced by the server). */
export const MAX_UPLOAD_BYTES = 32 * 1024
