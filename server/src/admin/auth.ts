// Credential check, sessions, and failed-login limits for the admin area (feature 016).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { AdminConfig } from './config.ts'

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()

/**
 * Compares both values as fixed-length SHA-256 digests with timingSafeEqual, and always checks
 * both, so the time taken does not reveal how much of the input matched or which part was wrong
 * (FR-003).
 */
export function credentialsMatch(config: AdminConfig, username: string, password: string): boolean {
  const userOk = timingSafeEqual(digest(username), digest(config.username))
  const passOk = timingSafeEqual(digest(password), digest(config.password))
  return userOk && passOk
}

/** A session lasts 12 hours from login (FR-005). */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000

/**
 * Sessions live in memory only: a restart or deployment logs everyone out, and no token is ever
 * written to disk (FR-005). Tokens are 32 random bytes (256 bits), base64url.
 */
export function createAdminSessions(now: () => number) {
  const sessions = new Map<string, number>() // token -> expiry
  const prune = () => {
    const t = now()
    for (const [token, until] of sessions) if (until <= t) sessions.delete(token)
  }
  return {
    create(): string {
      prune()
      const token = randomBytes(32).toString('base64url')
      sessions.set(token, now() + SESSION_TTL_MS)
      return token
    },
    valid(token: string | undefined): boolean {
      if (!token) return false
      const until = sessions.get(token)
      if (until === undefined) return false
      if (until <= now()) {
        sessions.delete(token)
        return false
      }
      return true
    },
    revoke(token: string | undefined) {
      if (token) sessions.delete(token)
    },
  }
}

/** Failed logins allowed per client, and from all clients together, in one window (FR-004). */
export const LOGIN_FAILURES_PER_CLIENT = 5
export const LOGIN_FAILURES_GLOBAL = 50
export const LOGIN_WINDOW_MS = 15 * 60 * 1000

interface Window {
  until: number
  failures: number
}

/**
 * Counts failed logins in fixed 15-minute windows that start at the first failure. The global
 * window stops brute force from many addresses, at the price that an attacker can lock the team
 * out for one window at a time (accepted in the plan).
 */
export function createLoginLimiter(now: () => number) {
  const clients = new Map<string, Window>()
  let global: Window | null = null
  const active = (w: Window | null | undefined, t: number) => (w && w.until > t ? w : null)
  return {
    /** Seconds to wait when the client may not try now, else 0. */
    retryAfter(client: string): number {
      const t = now()
      for (const [key, w] of clients) if (w.until <= t) clients.delete(key)
      const blocks = [active(clients.get(client), t), active(global, t)].filter(
        (w, i): w is Window => w !== null && w.failures >= (i === 0 ? LOGIN_FAILURES_PER_CLIENT : LOGIN_FAILURES_GLOBAL),
      )
      if (blocks.length === 0) return 0
      return Math.ceil((Math.max(...blocks.map((w) => w.until)) - t) / 1000)
    },
    fail(client: string) {
      const t = now()
      const own = active(clients.get(client), t) ?? { until: t + LOGIN_WINDOW_MS, failures: 0 }
      own.failures++
      clients.set(client, own)
      global = active(global, t) ?? { until: t + LOGIN_WINDOW_MS, failures: 0 }
      global.failures++
    },
  }
}
