// HTTP API (feature 001): device upload, device lookup, and the scanner download.
// Routes and bodies follow shared/src/api.ts; every non-2xx JSON response is an ApiError.
//
// There is deliberately no route that lists devices (FR-011): the unguessable device ID is the
// only access control.
import { createReadStream, existsSync } from 'node:fs'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import { API_ROUTES, checkDeviceScan, MAX_UPLOAD_BYTES, WEB_ROUTES, type ApiError } from '@leaaf/shared'
import type { DeviceStore } from './devices/store.ts'
import { checkScan } from './devices/validate.ts'

export interface AppOptions {
  devices: DeviceStore
  /** Origin of the web app, used to build device page URLs, e.g. https://leaaf.green */
  publicBaseUrl: string
  /** Path of the scanner executable to serve; the download is 404 while it is missing. */
  scannerExePath?: string
  logger?: FastifyServerOptions['logger']
}

const apiError = (error: ApiError['error'], message: string, fields?: ApiError['fields']): ApiError =>
  fields ? { error, message, fields } : { error, message }

const NOT_FOUND = apiError('not_found', 'device not found')

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
    const record = options.devices.create(checked.scan)
    const deviceUrl = new URL(WEB_ROUTES.device(record.device_id), options.publicBaseUrl).toString()
    return reply.code(201).send({ device_id: record.device_id, device_url: deviceUrl })
  })

  app.get<{ Params: { id: string } }>('/api/devices/:id', async (req, reply) => {
    const record = options.devices.get(req.params.id)
    return record ? reply.send(record) : reply.code(404).send(NOT_FOUND)
  })

  app.get(API_ROUTES.scannerDownload, async (_req, reply) => {
    const path = options.scannerExePath
    if (!path || !existsSync(path))
      return reply.code(404).send(apiError('not_found', 'the scanner download is not available yet'))
    return reply
      .header('content-type', 'application/vnd.microsoft.portable-executable')
      .header('content-disposition', 'attachment; filename="leaaf-scanner.exe"')
      .send(createReadStream(path))
  })

  return app
}
