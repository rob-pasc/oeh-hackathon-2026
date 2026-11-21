// Admin scan overview (feature 013): one login from ADMIN_USERNAME and ADMIN_PASSWORD, then a
// read-only, paged list of stored scans. The list exposes device IDs, which are the only key to a
// result page, so every route except login answers 401 without a valid admin session.
//
// POST /api/admin/login    body AdminLogin (application/json only) -> 204 + session cookie | 401/429 ApiError
// POST /api/admin/logout   body {} (application/json only)         -> 204, cookie cleared
// GET  /api/admin/session                                          -> 200 AdminSession | 401 ApiError
// GET  /api/admin/scans?page=<n>                                   -> 200 AdminScanPage | 401 ApiError
// Every admin route answers 404 while the admin area is not configured.
import { Type, type Static } from 'typebox'
import { DeviceId, IsoDateTime, Nullable, OsFamily } from './common.ts'

const strict = { additionalProperties: false } as const

export const ADMIN_ROUTES = {
  login: '/api/admin/login',
  logout: '/api/admin/logout',
  session: '/api/admin/session',
  scans: (page: number) => `/api/admin/scans?page=${page}`,
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

export const AdminScanPage = Type.Object(
  {
    total: Type.Integer({ minimum: 0 }),
    page: Type.Integer({ minimum: 1 }),
    page_size: Type.Integer({ minimum: 1 }),
    scans: Type.Array(AdminScanRow, { description: 'Newest first' }),
  },
  strict,
)
export type AdminScanPage = Static<typeof AdminScanPage>
