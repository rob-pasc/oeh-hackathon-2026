import { describe, expect, it } from 'vitest'
import { ADMIN_ROUTES, AdminLogin, AdminScanPage, createValidator } from '../src/index.ts'

describe('admin contracts (feature 013)', () => {
  const page = createValidator(AdminScanPage)
  const login = createValidator(AdminLogin)
  const row = {
    device_id: 'q3Xk9vT2mB7pLw0cZr1sEa',
    created_at: '2026-11-21T09:30:00Z',
    os_family: null,
    manufacturer: 'LENOVO',
    model: 'ThinkPad T480',
    scan_status: 'partial',
  }

  it('accepts a page of rows with nullable display fields', () => {
    expect(page({ total: 1, page: 1, page_size: 50, scans: [row] }).ok).toBe(true)
    expect(page({ total: 0, page: 1, page_size: 50, scans: [] }).ok).toBe(true)
  })

  it('keeps the full scan out of a row', () => {
    expect(page({ total: 1, page: 1, page_size: 50, scans: [{ ...row, scan: {} }] }).ok).toBe(false)
  })

  it('accepts only a username and a password at login', () => {
    expect(login({ username: 'admin', password: 'x'.repeat(16) }).ok).toBe(true)
    expect(login({ username: 'admin', password: 'x', remember: true }).ok).toBe(false)
    expect(login({ username: '', password: 'x' }).ok).toBe(false)
  })

  it('builds the paged list route', () => {
    expect(ADMIN_ROUTES.scans(3)).toBe('/api/admin/scans?page=3')
  })
})
