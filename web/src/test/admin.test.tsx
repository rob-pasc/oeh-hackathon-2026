import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiContext } from '../api'
import { createMockClient, MOCK_ADMIN, MOCK_DEVICE_IDS } from '../api/mock'
import { ApiClientError, type ApiClient } from '../api/types'
import { parseRoute } from '../app/router'
import { Admin } from '../pages/Admin'

const show = (client: ApiClient) =>
  render(
    <ApiContext.Provider value={client}>
      <Admin />
    </ApiContext.Provider>,
  )

async function logIn(username: string = MOCK_ADMIN.username, password: string = MOCK_ADMIN.password) {
  await userEvent.type(await screen.findByLabelText('Username'), username)
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

describe('admin page (feature 016)', () => {
  it('has its own route', () => {
    expect(parseRoute('/admin')).toEqual({ name: 'admin' })
    expect(parseRoute('/admin/')).toEqual({ name: 'admin' })
  })

  it('says the admin area is not set up when the server has no admin login (FR-001)', async () => {
    const client = { ...createMockClient(), adminSession: () => Promise.reject(new ApiClientError('not_found', 'not found')) }
    show(client)
    expect(await screen.findByText(/The admin area is not set up/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('shows the login form and refuses wrong credentials with one generic message (FR-003)', async () => {
    show(createMockClient())
    await logIn('admin', 'not-the-password')
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('says how long to wait after too many failed logins (FR-004)', async () => {
    const client = { ...createMockClient(), adminLogin: () => Promise.reject(new ApiClientError('rate_limited', 'slow down', 600)) }
    show(client)
    await logIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many failed logins. Try again in 10 minutes.')
  })

  it('lists the scans newest first with links, dashes, paging and log out (FR-007)', async () => {
    show(createMockClient())
    await logIn()
    const table = await screen.findByRole('table')
    expect(screen.getByText('73 scans stored, newest first.')).toBeInTheDocument()
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(50)
    const link = within(rows[0]!).getByRole('link', { name: MOCK_DEVICE_IDS.laptop })
    expect(link).toHaveAttribute('href', `/d/${MOCK_DEVICE_IDS.laptop}`)
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(rows[0]).toHaveTextContent('ThinkPad T480')
    expect(rows[0]).toHaveTextContent('Windows')
    expect(rows[2]).toHaveTextContent('macOS')
    expect(within(rows[4]!).getAllByText('–')).toHaveLength(3) // maker, model and system unknown

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(24)

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(await screen.findByLabelText('Username')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('returns to the login form when the session has expired (FR-006)', async () => {
    const base = createMockClient()
    const client = { ...base, adminSession: async () => ({ username: 'admin' }), adminScans: () => Promise.reject(new ApiClientError('unauthorized', 'log in')) }
    show(client)
    expect(await screen.findByLabelText('Username')).toBeInTheDocument()
  })

  it('marks the page noindex while it is shown (FR-009)', async () => {
    const { unmount } = show(createMockClient())
    await screen.findByLabelText('Username')
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    unmount()
    await waitFor(() => expect(document.head.querySelector('meta[name="robots"]')).toBeNull())
  })
})

describe('cookies (feature 016 FR-012)', () => {
  it('names the admin-only session cookie in both languages of the privacy notice', async () => {
    const { legalDoc } = await import('../legal/content')
    for (const lang of ['de', 'en'] as const) {
      const text = JSON.stringify(legalDoc('privacy', lang))
      expect(text).toContain('leaaf_admin')
      expect(text).toContain('/admin')
    }
  })

  it('sets no cookie in the browser on the public pages', async () => {
    const { App } = await import('../app/App')
    for (const path of ['/', '/privacy', '/imprint', `/d/${MOCK_DEVICE_IDS.laptop}`]) {
      window.history.pushState(null, '', path)
      const { unmount } = render(
        <ApiContext.Provider value={createMockClient({ stepMs: 1, assessmentMs: 1, reportMs: 1, stepsMs: 1 })}>
          <App />
        </ApiContext.Provider>,
      )
      expect(document.cookie).toBe('')
      unmount()
    }
  })
})

describe('scan details (feature 016 FR-013 to FR-017)', () => {
  it("shows today's AI calls above the list", async () => {
    show(createMockClient())
    await logIn()
    expect(await screen.findByText('AI calls today: 37 of 200')).toBeInTheDocument()
  })

  it('loads the details only when opened, with AI status, fallbacks and the scan JSON', async () => {
    const client = createMockClient()
    const detail = vi.spyOn(client, 'adminScan')
    show(client)
    await logIn()
    const table = await screen.findByRole('table')
    expect(detail).not.toHaveBeenCalled()
    const firstRow = within(table).getAllByRole('row')[1]!
    await userEvent.click(within(firstRow).getByRole('button', { name: 'Details' }))
    expect(detail).toHaveBeenCalledWith(MOCK_DEVICE_IDS.laptop)

    const status = await screen.findByRole('region', { name: 'AI status' })
    expect(status).toHaveTextContent('General: result categories from the AI')
    expect(status).toHaveTextContent('General: 2 step plans from the AI')
    expect(status).toHaveTextContent('Steps for battery-swap')
    expect(status).toHaveTextContent('AI timed out')

    const json = screen.getByRole('region', { name: 'Scan JSON' })
    expect(json).toHaveTextContent('"schema_version": 1')
    expect(json).toHaveTextContent('"product_version": "ThinkPad T480"')

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await userEvent.click(within(json).getByRole('button', { name: 'Copy JSON' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"schema_version": 1'))
    expect(await within(json).findByRole('status')).toHaveTextContent('Copied')

    await userEvent.click(within(firstRow).getByRole('button', { name: 'Hide' }))
    expect(screen.queryByRole('region', { name: 'Scan JSON' })).not.toBeInTheDocument()
  })

  it('says when a scan has no AI results and no fallbacks', async () => {
    show(createMockClient())
    await logIn()
    const rows = within(await screen.findByRole('table')).getAllByRole('row')
    await userEvent.click(within(rows[3]!).getByRole('button', { name: 'Details' }))
    const status = await screen.findByRole('region', { name: 'AI status' })
    expect(status).toHaveTextContent('No AI results stored for this scan.')
    expect(status).toHaveTextContent('No fallbacks recorded.')
  })
})
