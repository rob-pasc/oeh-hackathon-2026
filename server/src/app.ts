// HTTP API: device upload, lookup, and the scanner download (feature 001), scan sessions
// (feature 006 FR-002 to FR-004), and the assessment and report stream (features 003 and 004).
// Routes and bodies follow shared/src/api.ts; every non-2xx JSON response is an ApiError.
//
// There is deliberately no route that lists devices (FR-011): the unguessable device ID is the
// only access control.
import { createReadStream, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import {
  API_ROUTES,
  checkDeviceScan,
  createValidator,
  INTENDED_USES,
  MAX_UPLOAD_BYTES,
  IntendedUse,
  OS_FAMILIES,
  SCANNER_DOWNLOADS,
  SCANNER_SESSION_MARKER,
  ScanSessionRequest,
  ScannerEvent,
  WEB_ROUTES,
  type ApiError,
  type OsFamily,
  type ScanSession,
  type ScanSessionEvent,
  type StreamEnd,
} from '@leaaf/shared'
import { hourlyLimit, loadLimits } from './limits.ts'
import type { AssessmentService } from './assessment/service.ts'
import type { DeviceStore } from './devices/store.ts'
import { checkScan } from './devices/validate.ts'
import { renameZipRoot, ZipError } from './downloads/zip.ts'
import type { createReportService } from './report/service.ts'
import type { SessionStore } from './sessions/store.ts'

export interface AppOptions {
  limits?: ReturnType<typeof loadLimits>
  devices: DeviceStore
  sessions: SessionStore
  /** Absent when the server cannot assess (no retrieval index); the report stream then fails. */
  assessments?: AssessmentService | undefined
  explain?: ReturnType<typeof createReportService> | undefined
  /** Origin of the web app, used to build device page URLs, e.g. https://leaaf.green */
  publicBaseUrl: string
  /** Path of the Windows scanner executable; the download is 404 while it is missing. */
  scannerExePath?: string
  /** Scanner builds per system (feature 007 FR-012); each download is 404 while its file is missing. Overrides scannerExePath for Windows. */
  scannerPaths?: Partial<Record<OsFamily, string>>
  logger?: FastifyServerOptions['logger']
}

const apiError = (error: ApiError['error'], message: string, fields?: ApiError['fields']): ApiError =>
  fields ? { error, message, fields } : { error, message }

const NOT_FOUND = apiError('not_found', 'device not found')
const SESSION_NOT_FOUND = apiError('not_found', 'scan session not found')
const isScannerEvent = createValidator(ScannerEvent)
const isSessionRequest = createValidator(ScanSessionRequest)

/** How each scanner build is sent. The bundle inside the macOS zip is named MAC_BUNDLE. */
const DOWNLOAD_TYPES: Record<OsFamily, { contentType: string; filename: string }> = {
  windows: { contentType: 'application/vnd.microsoft.portable-executable', filename: 'leaaf-scanner.exe' },
  linux: { contentType: 'application/octet-stream', filename: 'leaaf-scanner' },
  macos: { contentType: 'application/zip', filename: 'leaaf-scanner-macos.zip' },
}
const MAC_BUNDLE = 'leaaf-scanner.app'
const isIntendedUse = createValidator(IntendedUse)

const sseFrame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

/** Keeps idle event streams open through proxies. */
const HEARTBEAT_MS = 15_000

export function buildApp(options: AppOptions): FastifyInstance {
  const limits = options.limits ?? loadLimits()
  const app = Fastify({
    trustProxy: limits.trustedProxy,
    bodyLimit: MAX_UPLOAD_BYTES,
    logger: options.logger ?? false,
  })

  app.setErrorHandler((err: { statusCode?: number; code?: string }, _req, reply) => {
    if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE')
      return reply.code(413).send(apiError('payload_too_large', 'request body exceeds its size limit'))
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500)
      return reply.code(400).send(apiError('invalid_payload', 'request body is not valid JSON'))
    app.log.error({ code: err.code }, 'unhandled error')
    return reply.code(500).send(apiError('internal', 'internal error'))
  })

  app.setNotFoundHandler((_req, reply) => reply.code(404).send(apiError('not_found', 'not found')))

  app.post(API_ROUTES.uploadDevice, { bodyLimit: limits.uploadBytes, onRequest: hourlyLimit(limits.uploadsPerHour) }, async (req, reply) => {
    const checked = checkScan(req.body)
    if (!checked.ok)
      return reply
        .code(400)
        .send(apiError('invalid_payload', 'the device scan does not match the schema', checked.fields))
    const rules = checkDeviceScan(checked.scan)
    if (rules.length > 0)
      return reply.code(400).send(
        apiError(
          'invalid_payload',
          'the device scan is inconsistent',
          rules.map((message) => ({ path: '/', message })),
        ),
      )
    // The session ID only links this upload to the waiting browser tab; it is never stored with the
    // scan, so no device route can reveal it.
    const { session_id: sessionId, ...scan } = checked.scan
    const record = options.devices.create(scan)
    if (sessionId) options.sessions.publish(sessionId, { type: 'complete', device_id: record.device_id })
    const deviceUrl = new URL(WEB_ROUTES.device(record.device_id), options.publicBaseUrl).toString()
    return reply.code(201).send({ device_id: record.device_id, device_url: deviceUrl })
  })

  app.get<{ Params: { id: string } }>('/api/devices/:id', async (req, reply) => {
    const record = options.devices.get(req.params.id)
    return record ? reply.send(record) : reply.code(404).send(NOT_FOUND)
  })

  // Report stream (shared/src/report.ts): the assessment first, then the report, then `end`.
  app.get<{ Params: { id: string }; Querystring: { intended_use?: string } }>(
    '/api/devices/:id/report',
    { onRequest: hourlyLimit(limits.reportsPerHour) },
    async (req, reply) => {
      const use = req.query.intended_use
      if (!isIntendedUse(use).ok)
        return reply.code(400).send(
          apiError('invalid_payload', 'unknown intended use', [
            { path: '/intended_use', message: `must be one of ${INTENDED_USES.join(', ')}` },
          ]),
        )
      const record = options.devices.get(req.params.id)
      if (!record) return reply.code(404).send(NOT_FOUND)
      const assessments = options.assessments
      if (!assessments) return reply.code(500).send(apiError('internal', 'assessments are not available'))

      reply.hijack()
      const res = reply.raw
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      })
      res.write(': connected\n\n')
      // Fact extraction can take several seconds on a cold cache; keep proxies from timing out.
      // The page may leave while the assessment runs; writes after that are skipped.
      const write = (chunk: string) => {
        if (!res.destroyed) res.write(chunk)
      }
      const heartbeat = setInterval(() => write(': keep-alive\n\n'), HEARTBEAT_MS)
      const send = (event: string, data: unknown) => write(sseFrame(event, data))
      let stage = 'assessment'
      try {
        const input = await assessments.assessDevice(record, use as IntendedUse)
        send('assessment', input.assessment)
        stage = 'report'
        const report = await options.explain?.(record.scan, input)
        if (report) send('report', report)
        send('end', { status: report?.source === 'template' ? 'fallback' : 'complete' } satisfies StreamEnd)
      } catch (err) {
        app.log.error({ err: err instanceof Error ? err.message : String(err) }, `${stage} failed`)
        send('error', apiError('internal', `the ${stage} failed`))
      } finally {
        clearInterval(heartbeat)
        res.end()
      }
    },
  )

  const scannerPaths: Partial<Record<OsFamily, string | undefined>> = { windows: options.scannerExePath, ...options.scannerPaths }
  for (const os of OS_FAMILIES) {
    app.get<{ Querystring: { session?: string } }>(SCANNER_DOWNLOADS[os], async (req, reply) => {
      const path = scannerPaths[os]
      if (!path || !existsSync(path))
        return reply.code(404).send(apiError('not_found', 'the scanner download is not available yet'))
      const sessionId = req.query.session
      if (sessionId !== undefined && !options.sessions.get(sessionId)) return reply.code(404).send(SESSION_NOT_FOUND)
      const { contentType, filename } = DOWNLOAD_TYPES[os]
      reply
        .header('content-type', contentType)
        .header('content-disposition', `attachment; filename="${filename}"`)
        .header('cache-control', 'no-store')
      if (sessionId === undefined) return reply.send(createReadStream(path))
      if (os === 'macos') {
        // The app's signature covers everything inside the bundle but not the bundle folder's
        // name, so the session goes there (feature 007; read back by run.SessionFromBundle).
        try {
          return reply.send(renameZipRoot(await readFile(path), MAC_BUNDLE, `leaaf-scanner-${sessionId}.app`))
        } catch (err) {
          if (err instanceof ZipError) throw new Error(`invalid macOS scanner archive: ${err.message}`)
          throw err
        }
      }
      // Windows never loads bytes after the last PE section (an "overlay"), and the Linux loader
      // ignores bytes after the ELF segments, so the marker and ID can follow the executable
      // unchanged; the scanner reads them back from the end of its own file.
      const trailer = Buffer.from(SCANNER_SESSION_MARKER + sessionId, 'ascii')
      return reply.send(
        Readable.from(
          (async function* () {
            yield* createReadStream(path)
            yield trailer
          })(),
        ),
      )
    })
  }

  app.post(API_ROUTES.createSession, async (req, reply) => {
    // The body is optional; without it the session downloads the Windows scanner (feature 006).
    const checked = isSessionRequest(req.body ?? {})
    if (!checked.ok) return reply.code(400).send(apiError('invalid_payload', 'not a scan session request', checked.errors))
    const id = options.sessions.create()
    const os = checked.value.os ?? 'windows'
    const body: ScanSession = { session_id: id, download_url: `${SCANNER_DOWNLOADS[os]}?session=${id}` }
    return reply.code(201).send(body)
  })

  app.post<{ Params: { id: string } }>('/api/sessions/:id/events', async (req, reply) => {
    const checked = isScannerEvent(req.body)
    if (!checked.ok)
      return reply.code(400).send(apiError('invalid_payload', 'not a scanner event', checked.errors))
    if (!options.sessions.get(req.params.id)) return reply.code(404).send(SESSION_NOT_FOUND)
    // Events for a finished session are ignored rather than rejected: the scanner cannot act on it.
    options.sessions.publish(req.params.id, checked.value)
    return reply.code(204).send()
  })

  app.get<{ Params: { id: string } }>('/api/sessions/:id/events', async (req, reply) => {
    const id = req.params.id
    const state = options.sessions.get(id)
    if (!state) return reply.code(404).send(SESSION_NOT_FOUND)
    reply.hijack()
    const res = reply.raw
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    })
    // Sends the headers at once, so the page knows the stream is open before the first event.
    res.write(': connected\n\n')
    const send = (event: ScanSessionEvent) => res.write(sseFrame(event.type, event))
    // Replay the latest state so a reconnecting or late page does not miss progress.
    if (state.last_event) send(state.last_event)
    const unsubscribe = options.sessions.subscribe(id, (event) => {
      send(event)
      if (event.type !== 'step') close()
    })
    const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), HEARTBEAT_MS)
    let closed = false
    function close() {
      if (closed) return
      closed = true
      clearInterval(heartbeat)
      unsubscribe()
      res.end()
    }
    req.raw.on('close', close)
    if (state.last_event && state.last_event.type !== 'step') close()
  })

  return app
}
