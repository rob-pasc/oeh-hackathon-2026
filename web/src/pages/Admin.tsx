// Admin scan overview (feature 013): a login form, then a read-only, paged list of the stored scans.
// The page holds no secret: the server decides everything, and the session cookie never reaches
// JavaScript (HttpOnly).
import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react'
import type { AdminScanDetail, AdminScanPage, AiFallbackReason } from '@leaaf/shared/admin'
import type { OsFamily } from '@leaaf/shared/common'
import { useApi } from '../api'
import { MOCK_ADMIN } from '../api/mock'
import { ApiClientError } from '../api/types'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { PRIMARY_BUTTON, Spinner } from '../components/ui'
import { USE_LABELS } from '../lib/labels'

type View = { kind: 'loading' } | { kind: 'disabled' } | { kind: 'login' } | { kind: 'list'; username: string } | { kind: 'error' }

const SYSTEM: Record<OsFamily, string> = { windows: 'Windows', macos: 'macOS', linux: 'Linux' }
const DASH = '–'

/** Plain-language reasons for an AI fallback (feature 013 FR-015). */
const FALLBACK_REASONS: Record<AiFallbackReason, string> = {
  no_llm: 'No AI configured',
  config: 'AI configuration problem',
  auth: 'AI key rejected',
  rate_limited: 'Rate limit or daily cap reached',
  timeout: 'AI timed out',
  unavailable: 'AI service unavailable',
  bad_request: 'Request rejected by the AI service',
  invalid_output: 'AI answer unreadable',
  rejected_answer: 'AI answer failed the server checks',
}
const SECONDARY_BUTTON =
  'cursor-pointer rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-leaf-tint disabled:cursor-default disabled:opacity-50'
const INPUT = 'rounded-xl border border-line bg-white px-4 py-3 text-base text-ink'

/** Keeps the page out of search engines while it is shown (FR-009). */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const title = document.title
    document.title = 'leaaf admin'
    return () => {
      meta.remove()
      document.title = title
    }
  }, [])
}

export function Admin() {
  useNoIndex()
  const api = useApi()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const toLogin = useCallback(() => setView({ kind: 'login' }), [])

  useEffect(() => {
    let live = true
    api
      .adminSession()
      .then((s) => live && setView(s ? { kind: 'list', username: s.username } : { kind: 'login' }))
      .catch((e: unknown) => live && setView(e instanceof ApiClientError && e.code === 'not_found' ? { kind: 'disabled' } : { kind: 'error' }))
    return () => {
      live = false
    }
  }, [api])

  async function logout() {
    try {
      await api.adminLogout()
    } finally {
      toLogin()
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        acronym
        right={
          view.kind === 'list' ? (
            <button type="button" onClick={logout} className={SECONDARY_BUTTON}>
              Log out
            </button>
          ) : undefined
        }
      />
      {/* The login and status screens sit in the middle of the page; the scan list uses the full width. */}
      <main
        className={`mx-auto flex w-full max-w-[1312px] flex-1 flex-col gap-6 px-4 pt-6 pb-16 sm:px-8 xl:px-16 ${
          view.kind === 'list' ? '' : 'items-center justify-center text-center'
        }`}
      >
        <h1 className="m-0 text-3xl font-extrabold">Admin</h1>
        {view.kind === 'loading' ? (
          <div className="flex items-center gap-3 text-muted">
            <Spinner /> Loading…
          </div>
        ) : view.kind === 'disabled' ? (
          <p className="m-0 max-w-[560px] text-lg text-muted">
            The admin area is not set up. Set ADMIN_USERNAME and ADMIN_PASSWORD (at least 16 characters) in the server’s .env and
            restart the server.
          </p>
        ) : view.kind === 'error' ? (
          <p role="alert" className="m-0 text-lg font-semibold text-rose-ink">
            The admin area could not be reached. Try again later.
          </p>
        ) : view.kind === 'login' ? (
          <LoginForm onLogin={(username) => setView({ kind: 'list', username })} mock={api.mode === 'mock'} />
        ) : (
          <ScanList onLoggedOut={toLogin} />
        )}
      </main>
      <Footer />
    </div>
  )
}

function LoginForm({ onLogin, mock }: { onLogin: (username: string) => void; mock: boolean }) {
  const api = useApi()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.adminLogin(username, password)
      setPassword('')
      onLogin(username)
    } catch (e) {
      if (e instanceof ApiClientError && e.code === 'rate_limited') {
        const minutes = e.retryAfter ? Math.max(1, Math.ceil(e.retryAfter / 60)) : null
        setError(`Too many failed logins. Try again ${minutes ? `in ${minutes} minute${minutes === 1 ? '' : 's'}` : 'later'}.`)
      } else if (e instanceof ApiClientError && e.code === 'unauthorized') {
        setError('Wrong username or password')
      } else {
        setError('The login did not work. Try again later.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-[400px] flex-col gap-4 rounded-[20px] bg-white p-7 text-left shadow-card" aria-label="Admin login">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Username
        <input className={INPUT} name="username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Password
        <input
          className={INPUT}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error ? (
        <span role="alert" className="text-sm font-semibold text-rose-ink">
          {error}
        </span>
      ) : null}
      <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON} justify-center py-3 text-base font-bold disabled:cursor-wait disabled:opacity-80`}>
        Log in
      </button>
      {mock ? (
        <span className="rounded-full bg-amber-tint px-3 py-1 text-center text-xs font-semibold text-amber-ink">
          Sample data: log in with {MOCK_ADMIN.username} / {MOCK_ADMIN.password}
        </span>
      ) : null}
    </form>
  )
}

function ScanList({ onLoggedOut }: { onLoggedOut: () => void }) {
  const api = useApi()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AdminScanPage | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setFailed(false)
    api
      .adminScans(page)
      .then((d) => live && setData(d))
      .catch((e: unknown) => {
        if (!live) return
        // An expired session (12 hours, logout elsewhere, server restart) returns to the form.
        if (e instanceof ApiClientError && e.code === 'unauthorized') onLoggedOut()
        else setFailed(true)
      })
    return () => {
      live = false
    }
  }, [api, page, onLoggedOut])

  if (failed)
    return (
      <p role="alert" className="m-0 text-lg font-semibold text-rose-ink">
        The scans could not be loaded. Try again later.
      </p>
    )
  if (!data)
    return (
      <div className="flex items-center gap-3 text-muted">
        <Spinner /> Loading scans…
      </div>
    )

  const pages = Math.max(1, Math.ceil(data.total / data.page_size))
  return (
    <section aria-label="Scans" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="m-0 text-lg text-muted">
          {data.total} {data.total === 1 ? 'scan' : 'scans'} stored, newest first.
        </p>
        <p className="m-0 text-sm text-muted">
          AI calls today: {data.ai_usage.used} of {data.ai_usage.cap}
        </p>
      </div>
      <div className="overflow-x-auto rounded-[20px] bg-white shadow-card">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs tracking-wider text-muted uppercase">
              {['Time', 'Device', 'Maker', 'Model', 'System', 'Status'].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 font-bold">
                  {h}
                </th>
              ))}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.scans.map((s) => (
              <Fragment key={s.device_id}>
                <tr className="border-b border-line last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <a href={`/d/${s.device_id}`} target="_blank" rel="noopener noreferrer" className="text-leaf">
                      {s.device_id}
                    </a>
                  </td>
                  <td className="px-4 py-3">{s.manufacturer ?? DASH}</td>
                  <td className="px-4 py-3">{s.model ?? DASH}</td>
                  <td className="px-4 py-3">{s.os_family ? SYSTEM[s.os_family] : DASH}</td>
                  <td className="px-4 py-3">{s.scan_status === 'complete' ? 'Complete' : 'Partial'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className={SECONDARY_BUTTON}
                      aria-expanded={open === s.device_id}
                      aria-controls={`details-${s.device_id}`}
                      onClick={() => setOpen(open === s.device_id ? null : s.device_id)}
                    >
                      {open === s.device_id ? 'Hide' : 'Details'}
                    </button>
                  </td>
                </tr>
                {open === s.device_id ? (
                  <tr id={`details-${s.device_id}`} className="border-b border-line bg-page">
                    <td colSpan={7} className="px-4 py-4">
                      <ScanDetails deviceId={s.device_id} onLoggedOut={onLoggedOut} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pages" className="flex items-center gap-3">
        <button type="button" className={SECONDARY_BUTTON} disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span className="text-sm text-muted">
          Page {data.page} of {pages}
        </span>
        <button type="button" className={SECONDARY_BUTTON} disabled={page >= pages} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </nav>
    </section>
  )
}

/** The full scan and its AI status, fetched when Details is opened (feature 013 FR-013 to FR-015). */
function ScanDetails({ deviceId, onLoggedOut }: { deviceId: string; onLoggedOut: () => void }) {
  const api = useApi()
  const [detail, setDetail] = useState<AdminScanDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)

  useEffect(() => {
    let live = true
    api
      .adminScan(deviceId)
      .then((d) => live && setDetail(d))
      .catch((e: unknown) => {
        if (!live) return
        if (e instanceof ApiClientError && e.code === 'unauthorized') onLoggedOut()
        else setFailed(true)
      })
    return () => {
      live = false
    }
  }, [api, deviceId, onLoggedOut])

  if (failed)
    return (
      <p role="alert" className="m-0 font-semibold text-rose-ink">
        The details could not be loaded.
      </p>
    )
  if (!detail)
    return (
      <div className="flex items-center gap-3 text-muted">
        <Spinner /> Loading details…
      </div>
    )

  const json = JSON.stringify(detail.device.scan, null, 2)
  const { categories, steps, fallbacks } = detail.ai
  async function copy() {
    try {
      await navigator.clipboard.writeText(json)
      setCopied('yes')
    } catch {
      setCopied('no')
    }
  }

  return (
    <div className="flex flex-col gap-4 text-left">
      <section aria-label="AI status" className="flex flex-col gap-2">
        <h2 className="m-0 text-base font-bold">AI status</h2>
        {categories.length === 0 && steps.length === 0 ? (
          <p className="m-0 text-sm text-muted">No AI results stored for this scan.</p>
        ) : (
          <ul className="m-0 flex flex-col gap-1 pl-5 text-sm">
            {categories.map((c) => (
              <li key={`c-${c.intended_use}`}>
                {USE_LABELS[c.intended_use]}: result categories from the AI, {new Date(c.generated_at).toLocaleString()}
              </li>
            ))}
            {steps.map((s) => (
              <li key={`s-${s.intended_use}`}>
                {USE_LABELS[s.intended_use]}: {s.plans} step {s.plans === 1 ? 'plan' : 'plans'} from the AI
              </li>
            ))}
          </ul>
        )}
        <h3 className="m-0 text-sm font-bold">Fallbacks</h3>
        {fallbacks.length === 0 ? (
          <p className="m-0 text-sm text-muted">No fallbacks recorded.</p>
        ) : (
          <ul className="m-0 flex flex-col gap-1 pl-5 text-sm">
            {fallbacks.map((f, i) => (
              <li key={i}>
                {new Date(f.created_at).toLocaleString()} · {f.call === 'categories' ? 'Result categories' : `Steps for ${f.option_id ?? 'an option'}`} ·{' '}
                {USE_LABELS[f.intended_use]} · {FALLBACK_REASONS[f.reason]}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Scan JSON" className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h2 className="m-0 text-base font-bold">Scan JSON</h2>
          <button type="button" className={SECONDARY_BUTTON} onClick={copy}>
            Copy JSON
          </button>
          {copied ? (
            <span role="status" className="text-sm text-muted">
              {copied === 'yes' ? 'Copied' : 'Copying failed; select the text instead'}
            </span>
          ) : null}
        </div>
        <pre className="m-0 max-h-[480px] overflow-auto rounded-xl border border-line bg-white p-4 font-mono text-xs leading-relaxed">{json}</pre>
      </section>
    </div>
  )
}
