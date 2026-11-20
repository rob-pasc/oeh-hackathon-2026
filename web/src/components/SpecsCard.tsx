import type { DeviceScan } from '@leaaf/shared/device'
import { summarizeScan, type Tone } from '../lib/specs'

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-leaf',
  warn: 'text-amber-ink',
  bad: 'text-rose-ink',
  neutral: 'text-ink',
}

const TONE_BAR: Record<Tone, string> = {
  good: 'bg-leaf',
  warn: 'bg-amber',
  bad: 'bg-rose-ink',
  neutral: 'bg-leaf',
}

export function SpecsCard({ scan }: { scan: DeviceScan }) {
  const summary = summarizeScan(scan)
  const batteryRow = summary.rows.find((r) => r.label === 'Battery health')
  return (
    <section aria-label="Your device" className="rounded-[20px] bg-white p-6 shadow-card">
      <div className="mb-4 flex flex-col gap-0.5">
        <h2 className="m-0 text-lg font-bold">{summary.title}</h2>
        {summary.subtitle ? <span className="text-[13px] text-muted">{summary.subtitle}</span> : null}
      </div>
      {summary.batteryPercent !== null && batteryRow ? (
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
          <div className={`h-full rounded-full ${TONE_BAR[batteryRow.tone]}`} style={{ width: `${summary.batteryPercent}%` }} />
        </div>
      ) : null}
      <dl className="m-0 flex flex-col">
        {summary.rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-t-0">
            <dt className="text-sm text-muted">{row.label}</dt>
            <dd className={`m-0 text-right text-sm font-semibold ${TONE_TEXT[row.tone]}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {scan.scan_status === 'partial' ? (
        <p className="mt-3 mb-0 rounded-[10px] bg-amber-tint px-3 py-2 text-[13px] leading-snug text-amber-ink">
          Some values could not be read. Results are less certain.
        </p>
      ) : null}
    </section>
  )
}
