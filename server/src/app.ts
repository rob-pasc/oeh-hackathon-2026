// HTTP API: device upload, lookup, and the scanner download (feature 001), and scan sessions
// (feature 006 FR-002 to FR-004).
// Routes and bodies follow shared/src/api.ts; every non-2xx JSON response is an ApiError.
//
// There is deliberately no route that lists devices (FR-011): the unguessable device ID is the
// only access control.
import { createReadStream, existsSync } from 'node:fs'
import { Readable } from 'node:stream'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import {
  API_ROUTES,
  checkDeviceScan,
  createValidator,
  MAX_UPLOAD_BYTES,
  SCANNER_SESSION_MARKER,
  ScannerEvent,
  WEB_ROUTES,
  type ApiError,
  type ScanSession,
  type ScanSessionEvent,
} from '@leaaf/shared'
import type { DeviceStore } from './devices/store.ts'
import { checkScan } from './devices/validate.ts'
import type { SessionStore } from './sessions/store.ts'

export interface AppOptions {
  devices: DeviceStore
  sessions: SessionStore
  /** Origin of the web app, used to build device page URLs, e.g. https://leaaf.green */
  publicBaseUrl: string
  /** Path of the scanner executable to serve; the download is 404 while it is missing. */
  scannerExePath?: string
  logger?: FastifyServerOptions['logger']
}

const apiError = (error: ApiError['error'], message: string, fields?: ApiError['fields']): ApiError =>
  fields ? { error, message, fields } : { error, message }

const NOT_FOUND = apiError('not_found', 'device not found')
const SESSION_NOT_FOUND = apiError('not_found', 'scan session not found')
const isScannerEvent = createValidator(ScannerEvent)

/** Keeps idle event streams open through proxies. */
const HEARTBEAT_MS = 15_000

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({
    bodyLimit: MAX_UPLOAD_BYTES,
    logger: options.logger ?? false,
  })

  app.setErrorHandler((err: { statusCode?: number; code?: string }, _req, reply) => {
    if (err.code === 'FST_ERR_CTP_BODY_TOO_LARGE')
      return reply.code(413).send(apiError('payload_too_large', `upload must not exceed ${MAX_UPLOAD_BYTES} bytes`))
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500)
      return reply.code(400).send(apiError('invalid_payload', 'request body is not valid JSON'))
    app.log.error({ code: err.code }, 'unhandled error')
    return reply.code(500).send(apiError('internal', 'internal error'))
  })

  app.setNotFoundHandler((_req, reply) => reply.code(404).send(apiError('not_found', 'not found')))

  app.post(API_ROUTES.uploadDevice, async (req, reply) => {
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

  app.get<{ Querystring: { session?: string } }>(API_ROUTES.scannerDownload, async (req, reply) => {
    const path = options.scannerExePath
    if (!path || !existsSync(path))
      return reply.code(404).send(apiError('not_found', 'the scanner download is not available yet'))
    const sessionId = req.query.session
    if (sessionId !== undefined && !options.sessions.get(sessionId)) return reply.code(404).send(SESSION_NOT_FOUND)
    reply
      .header('content-type', 'application/vnd.microsoft.portable-executable')
      .header('content-disposition', 'attachment; filename="leaaf-scanner.exe"')
      .header('cache-control', 'no-store')
    if (sessionId === undefined) return reply.send(createReadStream(path))
    // Windows never loads bytes after the last PE section (an "overlay"), so the marker and ID can
    // follow the executable unchanged; the scanner reads them back from the end of its own file.
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

  app.post(API_ROUTES.createSession, async (_req, reply) => {
    const id = options.sessions.create()
    const body: ScanSession = { session_id: id, download_url: `${API_ROUTES.scannerDownload}?session=${id}` }
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
    const send = (event: ScanSessionEvent) => res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
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
