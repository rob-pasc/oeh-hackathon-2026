// Admin routes (feature 013). Registered only when the admin area is configured, so without it
// every /api/admin/* request falls through to the 404 handler (FR-001).
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ADMIN_PAGE_SIZE, ADMIN_ROUTES, AdminLogin, createValidator, type AdminScanDetail, type AdminScanPage, type ApiError } from '@leaaf/shared'
import type { DeviceStore } from '../devices/store.ts'
import { createAdminSessions, createLoginLimiter, credentialsMatch, SESSION_TTL_MS } from './auth.ts'
import type { AdminConfig } from './config.ts'
import type { AdminInsights } from './insights.ts'

const COOKIE = 'leaaf_admin'
// The cookie only ever goes to the admin API: visitors and other routes never see it (FR-005, FR-012).
const COOKIE_ATTRIBUTES = 'Path=/api/admin; HttpOnly; Secure; SameSite=Strict'

const isLogin = createValidator(AdminLogin)
const error = (code: ApiError['error'], message: string): ApiError => ({ error: code, message })
const WRONG = error('unauthorized', 'Wrong username or password')
const LOGGED_OUT = error('unauthorized', 'Log in to see the admin area')

function sessionToken(req: FastifyRequest): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === COOKIE) return value.join('=')
  }
  return undefined
}

/** Login and logout change state, so only JSON bodies count: an HTML form on another site cannot send JSON (FR-010). */
const isJson = (req: FastifyRequest) => /^application\/json\s*(;|$)/i.test(req.headers['content-type'] ?? '')

export interface AdminRouteOptions {
  config: AdminConfig
  devices: DeviceStore
  insights: AdminInsights
  now: () => number
}

export function registerAdminRoutes(app: FastifyInstance, { config, devices, insights, now }: AdminRouteOptions) {
  const sessions = createAdminSessions(now)
  const limiter = createLoginLimiter(now)

  app.register(async (admin) => {
    // Nothing from the admin area may be cached or indexed (FR-009).
    admin.addHook('onSend', async (_req, reply, payload) => {
      reply.header('Cache-Control', 'no-store').header('X-Robots-Tag', 'noindex, nofollow')
      return payload
    })
    const requireSession = async (req: FastifyRequest, reply: FastifyReply) => {
      if (!sessions.valid(sessionToken(req))) return reply.code(401).send(LOGGED_OUT)
    }

    admin.post(ADMIN_ROUTES.login, async (req, reply) => {
      if (!isJson(req)) return reply.code(415).send(error('unsupported_media_type', 'send the login as application/json'))
      const wait = limiter.retryAfter(req.ip)
      if (wait > 0)
        return reply.code(429).header('Retry-After', wait).send(error('rate_limited', 'Too many failed logins. Try again later.'))
      const body = isLogin(req.body)
      if (!body.ok || !credentialsMatch(config, body.value.username, body.value.password)) {
        limiter.fail(req.ip)
        return reply.code(401).send(WRONG)
      }
      const token = sessions.create()
      return reply
        .header('Set-Cookie', `${COOKIE}=${token}; ${COOKIE_ATTRIBUTES}; Max-Age=${SESSION_TTL_MS / 1000}`)
        .code(204)
        .send()
    })

    admin.post(ADMIN_ROUTES.logout, async (req, reply) => {
      if (!isJson(req)) return reply.code(415).send(error('unsupported_media_type', 'send the logout as application/json'))
      sessions.revoke(sessionToken(req))
      return reply.header('Set-Cookie', `${COOKIE}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`).code(204).send()
    })

    admin.get(ADMIN_ROUTES.session, { onRequest: requireSession }, async (_req, reply) => reply.send({ username: config.username }))

    admin.get<{ Querystring: { page?: string } }>('/api/admin/scans', { onRequest: requireSession }, async (req, reply) => {
      const page = /^[1-9]\d{0,6}$/.test(req.query.page ?? '1') ? Number(req.query.page ?? '1') : 1
      const body: AdminScanPage = {
        total: devices.count(),
        ai_usage: insights.aiUsageToday(),
        page,
        page_size: ADMIN_PAGE_SIZE,
        scans: devices.list((page - 1) * ADMIN_PAGE_SIZE, ADMIN_PAGE_SIZE),
      }
      return reply.send(body)
    })

    // The full scan and its AI status, fetched only when Details is opened (FR-013 to FR-015).
    admin.get<{ Params: { id: string } }>('/api/admin/scans/:id', { onRequest: requireSession }, async (req, reply) => {
      const device = devices.get(req.params.id)
      if (!device) return reply.code(404).send(error('not_found', 'device not found'))
      const body: AdminScanDetail = { device, ai: insights.aiStatus(device.device_id) }
      return reply.send(body)
    })
  })
}
