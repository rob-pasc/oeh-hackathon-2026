// Admin scan overview (feature 013): one login from ADMIN_USERNAME and ADMIN_PASSWORD, then a
// read-only, paged list of stored scans. The list exposes device IDs, which are the only key to a
// result page, so every route except login answers 401 without a valid admin session.
//
// POST /api/admin/login    body AdminLogin (application/json only) -> 204 + session cookie | 401/429 ApiError
// POST /api/admin/logout   body {} (application/json only)         -> 204, cookie cleared
// GET  /api/admin/session                                          -> 200 AdminSession | 401 ApiError
// GET  /api/admin/scans?page=<n>                                   -> 200 AdminScanPage | 401 ApiError
// GET  /api/admin/scans/:id                                        -> 200 AdminScanDetail | 401/404 ApiError
// Every admin route answers 404 while the admin area is not configured.
import { Type, type Static } from 'typebox'
import { DeviceId, IntendedUse, IsoDate, IsoDateTime, Nullable, OsFamily } from './common.ts'
import { DeviceRecord } from './device.ts'

const strict = { additionalProperties: false } as const

export const ADMIN_ROUTES = {
  login: '/api/admin/login',
  logout: '/api/admin/logout',
  session: '/api/admin/session',
  scans: (page: number) => `/api/admin/scans?page=${page}`,
  scan: (id: string) => `/api/admin/scans/${id}`,
} as const

/** Scans per page of the admin list (feature 013 FR-007). */
export const ADMIN_PAGE_SIZE = 50

export const AdminLogin = Type.Object(
  { username: Type.String({ minLength: 1, maxLength: 256 }), password: Type.String({ minLength: 1, maxLength: 1024 }) },
  strict,
)
export type AdminLogin = Static<typeof AdminLogin>

export const AdminSession = Type.Object({ username: Type.String() }, strict)
export type AdminSession = Static<typeof AdminSession>

/** One row of the admin list: only what the overview shows, never the full scan. */
export const AdminScanRow = Type.Object(
  {
    device_id: DeviceId,
    created_at: IsoDateTime,
    os_family: Nullable(OsFamily),
    manufacturer: Nullable(Type.String()),
    model: Nullable(Type.String({ description: 'identity.product_version when present, else identity.model' })),
    scan_status: Type.Enum(['complete', 'partial']),
  },
  strict,
)
export type AdminScanRow = Static<typeof AdminScanRow>

/** Today's AI calls (UTC day) against LLM_DAILY_CALLS (feature 013 FR-017). */
export const AdminAiUsage = Type.Object(
  { day: IsoDate, used: Type.Integer({ minimum: 0 }), cap: Type.Integer({ minimum: 0 }) },
  strict,
)
export type AdminAiUsage = Static<typeof AdminAiUsage>

export const AdminScanPage = Type.Object(
  {
    total: Type.Integer({ minimum: 0 }),
    ai_usage: AdminAiUsage,
    page: Type.Integer({ minimum: 1 }),
    page_size: Type.Integer({ minimum: 1 }),
    scans: Type.Array(AdminScanRow, { description: 'Newest first' }),
  },
  strict,
)
export type AdminScanPage = Static<typeof AdminScanPage>

/**
 * Why the server showed a template instead of an AI answer (feature 013 FR-016): no AI
 * configured, one of the LLM client's error kinds, or an answer the server checks rejected.
 */
export const AI_FALLBACK_REASONS = [
  'no_llm',
  'config',
  'auth',
  'rate_limited',
  'timeout',
  'unavailable',
  'bad_request',
  'invalid_output',
  'rejected_answer',
] as const
export const AiFallbackReason = Type.Enum(AI_FALLBACK_REASONS)
export type AiFallbackReason = Static<typeof AiFallbackReason>

export const AI_CALLS = ['categories', 'steps'] as const
export const AiCall = Type.Enum(AI_CALLS)
export type AiCall = Static<typeof AiCall>

export const AdminAiFallback = Type.Object(
  {
    created_at: IsoDateTime,
    call: AiCall,
    intended_use: IntendedUse,
    option_id: Nullable(Type.String({ description: 'The opened option, for step plans' })),
    reason: AiFallbackReason,
  },
  strict,
)
export type AdminAiFallback = Static<typeof AdminAiFallback>

/** Response of GET /api/admin/scans/:id: the full stored scan and its AI status (FR-013 to FR-015). */
export const AdminScanDetail = Type.Object(
  {
    device: DeviceRecord,
    ai: Type.Object(
      {
        categories: Type.Array(Type.Object({ intended_use: IntendedUse, generated_at: IsoDateTime }, strict), {
          description: 'AI category results stored for this scan, one per intended use',
        }),
        steps: Type.Array(Type.Object({ intended_use: IntendedUse, plans: Type.Integer({ minimum: 1 }) }, strict), {
          description: 'AI step plans stored for this scan, counted per intended use',
        }),
        fallbacks: Type.Array(AdminAiFallback, { description: 'Newest first' }),
      },
      strict,
    ),
  },
  strict,
)
export type AdminScanDetail = Static<typeof AdminScanDetail>
