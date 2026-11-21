import { useState } from 'react'
import type { OsFamily } from '@leaaf/shared/common'
import { useApi } from '../api'
import { navigate } from '../app/router'
import { Footer } from '../components/Footer'
import { Acronym, Logo } from '../components/Logo'
import { PRIMARY_BUTTON } from '../components/ui'
import { detectOs, PLATFORM_ORDER, PLATFORMS } from '../lib/platform'

const STEPS = [
  {
    title: 'Scan Device',
    text: 'Run a small scanner on Windows, Mac or Linux. It reads your hardware, nothing personal.',
    icon: 'M4 5h16v11H4zM2 19h20',
  },
  {
    title: 'AI Analysis',
    text: 'We rank five paths: upgrade, repair, pass on, salvage, recycle.',
    icon: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  },
  {
    title: 'Save CO₂ & Money',
    text: 'See what each path saves, in CO₂e and euros.',
    icon: 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19c3-5 6-8 10-10',
  },
] as const

const LINK_BUTTON = 'cursor-pointer border-0 bg-transparent p-0 font-semibold text-leaf underline underline-offset-2 disabled:cursor-wait'

export function Landing() {
  const api = useApi()
  const [detected] = useState<OsFamily | null>(() => (typeof navigator === 'undefined' ? null : detectOs(navigator)))
  // The system whose steps are shown: the detected one, or the last one the visitor chose.
  const [shown, setShown] = useState<OsFamily | null>(detected)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startScan(os: OsFamily) {
    if (busy) return
    setBusy(true)
    setError(null)
    setShown(os)
    // Open the result tab inside the click handler so popup blockers allow it, then point it at the session.
    const tab = window.open('', '_blank')
    try {
      const session = await api.createScanSession(os)
      if (session.download_url) {
        const link = document.createElement('a')
        link.href = session.download_url
        link.download = PLATFORMS[os].filename
        document.body.appendChild(link)
        link.click()
        link.remove()
      }
      const target = `/s/${session.session_id}`
      if (tab) tab.location.href = target
      else navigate(target)
    } catch {
      tab?.close()
      setError('We could not start a scan. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const platform = shown ? PLATFORMS[shown] : null
  const others = PLATFORM_ORDER.filter((os) => os !== detected)

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 sm:py-12 xl:px-16">
        <div className="flex w-full max-w-[1100px] flex-col items-center gap-10 text-center sm:gap-14">
          <div className="flex flex-col items-center gap-5">
            <div className="flex flex-col items-center gap-2">
              <Logo variant="hero" />
              <Acronym />
            </div>
            <p className="m-0 max-w-[560px] text-lg leading-snug text-muted sm:text-[22px]">
              Is your old computer ready for the bin? Find out what it can still do.
            </p>
          </div>

          <ol className="m-0 grid w-full max-w-[520px] list-none grid-cols-1 gap-4 p-0 md:max-w-none md:grid-cols-3 md:gap-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-7 shadow-card md:px-7 md:py-9">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-leaf-tint text-leaf">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-8 w-8"
                  >
                    <path d={step.icon} />
                  </svg>
                </div>
                <span className="text-xs font-bold tracking-wider text-leaf uppercase">Step {index + 1}</span>
                <h2 className="m-0 text-2xl font-bold">{step.title}</h2>
                <p className="m-0 text-base leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="flex flex-col items-center gap-3">
            {platform ? (
              <details className="max-w-[580px] text-left text-sm text-muted">
                <summary className="cursor-pointer text-center font-semibold text-ink">What does the scanner collect?</summary>
                <p className="mt-3">{platform.reads}</p>
                <p className="mt-2">
                  {platform.saves} and uploads it to leaaf for your report. The scan excludes personal files, user and
                  computer names, serial numbers, device UUIDs, and network addresses.
                </p>
              </details>
            ) : null}
            {detected ? (
              <>
                <button
                  type="button"
                  onClick={() => startScan(detected)}
                  disabled={busy}
                  className={`${PRIMARY_BUTTON} mb-[15px] w-full justify-center py-5 text-lg font-bold sm:w-auto sm:py-6 sm:text-[26px] disabled:cursor-wait disabled:opacity-80`}
                >
                  Download and Scan now
                  <span aria-hidden="true">→</span>
                </button>
                <span className="text-sm text-muted">
                  Scanner for {PLATFORMS[detected].label}. Opens a new tab and downloads a small scanner.
                </span>
                <span className="text-sm text-muted">
                  Other systems:{' '}
                  {others.map((os, i) => (
                    <span key={os}>
                      {i > 0 ? ' · ' : null}
                      <button type="button" onClick={() => startScan(os)} disabled={busy} className={LINK_BUTTON}>
                        {PLATFORMS[os].label}
                      </button>
                    </span>
                  ))}
                </span>
              </>
            ) : (
              <>
                <span className="text-base text-ink">Run the scanner on the computer you want to check.</span>
                <div className="flex flex-wrap justify-center gap-3" role="group" aria-label="Download the scanner">
                  {PLATFORM_ORDER.map((os) => (
                    <button
                      key={os}
                      type="button"
                      onClick={() => startScan(os)}
                      disabled={busy}
                      className={`${PRIMARY_BUTTON} py-4 text-lg font-bold disabled:cursor-wait disabled:opacity-80`}
                    >
                      Download for {PLATFORMS[os].label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {platform ? (
              <section aria-label={`How to run the scanner on ${platform.label}`} className="max-w-[580px] text-left text-sm text-muted">
                <h3 className="m-0 mb-1 text-center text-sm font-semibold text-ink">How to run it on {platform.label}</h3>
                <ol className="m-0 pl-5">
                  {platform.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            ) : null}
            {error ? (
              <span role="alert" className="text-sm font-semibold text-rose-ink">
                {error}
              </span>
            ) : null}
            {api.mode === 'mock' ? (
              <span className="rounded-full bg-amber-tint px-3 py-1 text-xs font-semibold text-amber-ink">
                Sample data: no real scan is run
              </span>
            ) : null}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
