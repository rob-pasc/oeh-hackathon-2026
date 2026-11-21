import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ADMIN_ROUTES, AdminLogin, AdminScanDetail, AdminScanPage, createValidator } from '../src/index.ts'

describe('admin contracts (feature 016)', () => {
  const page = createValidator(AdminScanPage)
  const login = createValidator(AdminLogin)
  const ai_usage = { day: '2026-11-21', used: 37, cap: 200 }
  const row = {
    device_id: 'q3Xk9vT2mB7pLw0cZr1sEa',
    created_at: '2026-11-21T09:30:00Z',
    os_family: null,
    manufacturer: 'LENOVO',
    model: 'ThinkPad T480',
    scan_status: 'partial',
  }

  it('accepts a page of rows with nullable display fields', () => {
    expect(page({ total: 1, ai_usage, page: 1, page_size: 50, scans: [row] }).ok).toBe(true)
    expect(page({ total: 0, ai_usage, page: 1, page_size: 50, scans: [] }).ok).toBe(true)
  })

  it('keeps the full scan out of a row', () => {
    expect(page({ total: 1, ai_usage, page: 1, page_size: 50, scans: [{ ...row, scan: {} }] }).ok).toBe(false)
  })

  it('accepts only a username and a password at login', () => {
    expect(login({ username: 'admin', password: 'x'.repeat(16) }).ok).toBe(true)
    expect(login({ username: 'admin', password: 'x', remember: true }).ok).toBe(false)
    expect(login({ username: '', password: 'x' }).ok).toBe(false)
  })

  it('builds the paged list route', () => {
    expect(ADMIN_ROUTES.scans(3)).toBe('/api/admin/scans?page=3')
  })

  it('describes a scan detail with its AI status and fallbacks', () => {
    const scan = JSON.parse(readFileSync(new URL('../fixtures/device-scan.laptop-complete.json', import.meta.url), 'utf8'))
    const detail = createValidator(AdminScanDetail)
    const value = {
      device: { device_id: row.device_id, created_at: row.created_at, scan },
      ai: {
        categories: [{ intended_use: 'office', generated_at: '2026-11-21T09:31:00Z' }],
        steps: [{ intended_use: 'office', plans: 2 }],
        fallbacks: [{ created_at: '2026-11-21T09:32:00Z', call: 'steps', intended_use: 'office', option_id: 'upgrade-ssd', reason: 'timeout' }],
      },
    }
    expect(detail(value).ok).toBe(true)
    value.ai.fallbacks[0]!.reason = 'the prompt said no'
    expect(detail(value).ok).toBe(false)
  })
})
