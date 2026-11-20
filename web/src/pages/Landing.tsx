import { useState } from 'react'
import { useApi } from '../api'
import { navigate } from '../app/router'
import { Footer } from '../components/Footer'
import { Logo } from '../components/Logo'
import { PRIMARY_BUTTON } from '../components/ui'

const STEPS = [
  {
    title: 'Scan Device',
    text: 'Run a small Windows scanner. It reads your hardware, nothing personal.',
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

export function Landing() {
  const api = useApi()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startScan() {
    if (busy) return
    setBusy(true)
    setError(null)
    // Open the result tab inside the click handler so popup blockers allow it, then point it at the session.
    const tab = window.open('', '_blank')
    try {
      const session = await api.createScanSession()
      if (session.download_url) {
        const link = document.createElement('a')
        link.href = session.download_url
        link.download = 'leaaf-scanner.exe'
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

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-16 py-12">
        <div className="flex w-full max-w-[1100px] flex-col items-center gap-14 text-center">
          <div className="flex flex-col items-center gap-5">
            <Logo variant="hero" />
            <p className="m-0 max-w-[560px] text-[22px] leading-snug text-muted">
              Is your old computer ready for the bin? Find out what it can still do.
            </p>
          </div>

          <ol className="m-0 grid w-full list-none grid-cols-3 gap-6 p-0">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col items-center gap-4 rounded-3xl bg-white px-7 py-9 shadow-card">
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
            <button
              type="button"
              onClick={startScan}
              disabled={busy}
              className={`${PRIMARY_BUTTON} mb-[5px] py-6 text-[26px] font-bold disabled:cursor-wait disabled:opacity-80`}
            >
              Download and Scan now
              <span aria-hidden="true">→</span>
            </button>
            <span className="text-sm text-muted">Windows laptops and PCs. Opens a new tab and downloads a small scanner.</span>
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
