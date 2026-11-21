import { isIP } from 'node:net'
import type { DatabaseSync } from 'node:sqlite'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { MAX_UPLOAD_BYTES } from '@leaaf/shared'

export function loadLimits(env: NodeJS.ProcessEnv = {}) {
  function integer(name: string, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER) {
    const raw = env[name]
    if (raw === undefined) return fallback
    const value = Number(raw)
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max)
      throw new Error(`${name} must be an integer between ${min} and ${max}`)
    return value
  }
  const proxy = env.TRUSTED_PROXY_IP?.trim()
  if (proxy && !isIP(proxy)) throw new Error('TRUSTED_PROXY_IP must be a single IP address')
  return {
    trustedProxy: proxy || (false as const),
    uploadBytes: integer('UPLOAD_MAX_BYTES', MAX_UPLOAD_BYTES, 1, MAX_UPLOAD_BYTES),
    uploadsPerHour: integer('UPLOADS_PER_HOUR', 10, 1),
    reportsPerHour: integer('REPORTS_PER_HOUR', 60, 1),
    // Each opened option card asks for its step plan once (feature 009).
    stepsPerHour: integer('STEPS_PER_HOUR', 120, 1),
    dailyCalls: integer('LLM_DAILY_CALLS', 200, 0),
  }
}

/** Each route owns an independent window per client. Insert order is also expiry order. */
export function hourlyLimit(max: number) {
  const clients = new Map<string, { until: number; used: number }>()
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const now = Date.now()
    for (const [ip, window] of clients) {
      if (window.until > now) break
      clients.delete(ip)
    }
    const window = clients.get(req.ip)
    if (!window) {
      clients.set(req.ip, { until: now + 3_600_000, used: 1 })
    } else if (window.used >= max) {
      return reply.code(429).header('Retry-After', Math.ceil((window.until - now) / 1000))
        .send({ error: 'rate_limited', message: 'Hourly request limit reached. Try again later.' })
    } else {
      window.used++
    }
  }
}

/** Reserve before each outgoing HTTP attempt, including transport retries and JSON repairs. */
export function budgetedFetch(db: DatabaseSync, cap: number, transport = fetch, now = () => new Date()): typeof fetch {
  db.exec('CREATE TABLE IF NOT EXISTS llm_daily_usage (day TEXT PRIMARY KEY, calls INTEGER NOT NULL)')
  const reserve = db.prepare(`INSERT INTO llm_daily_usage (day, calls) VALUES (?, 1)
    ON CONFLICT(day) DO UPDATE SET calls = calls + 1 WHERE calls < ?`)
  return async (input, init) => {
    if (cap === 0 || reserve.run(now().toISOString().slice(0, 10), cap).changes === 0) {
      // Use the adapter's existing rate-limit fallback and suppress SDK retries of a local denial.
      return Response.json({ error: { message: 'Daily LLM call limit reached' } }, {
        status: 429, headers: { 'x-should-retry': 'false' },
      })
    }
    return transport(input, init)
  }
}
