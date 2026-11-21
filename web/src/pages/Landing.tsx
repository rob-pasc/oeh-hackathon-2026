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
    text: 'We rank the options that fit your laptop, from upgrades and repairs to passing it on.',
    icon: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  },
  {
    title: 'Save CO₂ & Money',
    text: 'See what each path saves, in CO₂e and euros.',
    icon: 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19c3-5 6-8 10-10',
  },
] as const

// Small secondary download buttons for the other systems: they stay quiet next to the big button.
const OTHER_BUTTON =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-leaf-soft bg-white px-4 py-1.5 text-sm font-semibold text-leaf-deep transition-colors hover:border-leaf hover:bg-leaf-tint disabled:cursor-wait disabled:opacity-60'

// Words in the run steps that get a style: commands and file names as code, buttons and menu names in bold.
const STEP_MARKUP = /(leaaf-scanner\.exe|chmod \+x leaaf-scanner|More info|Run anyway|Start scan|Open Anyway|System Settings|Privacy & Security|X11|Wayland)/
const STEP_CODE = /^(leaaf-scanner\.exe|chmod \+x leaaf-scanner)$/

function StepText({ text }: { text: string }) {
  // `split` with a capture group puts every match at an odd index.
  return (
    <>
      {text.split(STEP_MARKUP).map((part, index) => {
        if (index % 2 === 0) return part
        return STEP_CODE.test(part) ? (
          <code key={index} className="rounded-md bg-track px-1.5 py-0.5 font-mono text-[13px] whitespace-nowrap text-ink">
            {part}
          </code>
        ) : (
          <strong key={index} className="font-semibold text-ink">
            {part}
          </strong>
        )
      })}
    </>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
      <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
    </svg>
  )
}

export function Landing() {
  const api = useApi()
  const [detected] = useState<OsFamily | null>(() => (typeof navigator === 'undefined' ? null : detectOs(navigator)))
  // The system whose steps are shown: the detected one, or the one the visitor picked in the steps card or downloaded.
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
                <div role="group" aria-label="Download for another system" className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-sm text-muted">Other systems</span>
                  {others.map((os) => (
                    <button key={os} type="button" onClick={() => startScan(os)} disabled={busy} className={OTHER_BUTTON}>
                      {PLATFORMS[os].label}
                      <DownloadIcon />
                    </button>
                  ))}
                </div>
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
              <section
                aria-label={`How to run the scanner on ${platform.label}`}
                id="run-steps"
                className="mt-2 w-full max-w-[580px] rounded-2xl bg-white p-5 text-left shadow-card sm:p-6"
              >
                {/* Choosing a system here only changes what is shown; nothing is downloaded. */}
                <div role="tablist" aria-label="Show the steps for" className="mb-4 inline-flex gap-1 rounded-full bg-track p-1">
                  {PLATFORM_ORDER.map((os) => (
                    <button
                      key={os}
                      type="button"
                      role="tab"
                      aria-selected={shown === os}
                      aria-controls="run-steps"
                      onClick={() => setShown(os)}
                      className={`cursor-pointer rounded-full border-0 px-4 py-1.5 text-sm font-semibold transition-colors ${
                        shown === os ? 'bg-leaf text-white' : 'bg-transparent text-muted hover:text-ink'
                      }`}
                    >
                      {PLATFORMS[os].label}
                    </button>
                  ))}
                </div>
                <h3 className="m-0 mb-4 flex items-center gap-2 text-base font-bold text-ink">
                  <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-leaf-tint text-leaf">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M5 4l14 8-14 8z" />
                    </svg>
                  </span>
                  How to run it on {platform.label}
                </h3>
                <ol className="m-0 flex list-none flex-col gap-3 p-0">
                  {platform.steps.map((step, index) => (
                    <li key={step} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf text-xs font-bold text-white"
                      >
                        {index + 1}
                      </span>
                      <span className="text-sm leading-relaxed text-muted">
                        <StepText text={step} />
                      </span>
                    </li>
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
