import type { DeviceScan } from '@leaaf/shared/device'
import type { PartLookup, PartLookupStatus } from '@leaaf/shared/parts'
import { sourceRef } from '../lib/pathView'
import { summarizeScan, type SpecRow, type Tone } from '../lib/specs'
import { SourceLink } from './SourceLink'

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

/** Part lookup badges (feature 018 FR-004); the styles follow the scan screen's part chips. */
const BADGE: Record<PartLookupStatus, { label: string; className: string }> = {
  knowledge_base: { label: 'Knowledge base', className: 'bg-leaf-tint text-leaf-deep' },
  web: { label: 'Web search · check', className: 'bg-amber-tint text-amber-ink' },
  no_match: { label: 'No match', className: 'bg-track text-muted' },
}

function LookingUp() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
      <span aria-hidden="true" className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
      Looking up…
    </span>
  )
}

function Lookup({ part, named }: { part: PartLookup; named: boolean }) {
  const badge = BADGE[part.status]
  return (
    <div className="fade-up flex flex-col items-start gap-1">
      <span className="flex flex-wrap items-baseline gap-2">
        <span className={`rounded-full px-2 py-[2px] text-[11px] font-bold ${badge.className}`}>{badge.label}</span>
        {named ? <span className="text-xs font-semibold text-muted">{part.identifier}</span> : null}
      </span>
      {part.sentence ? <span className="text-[13px] leading-snug text-ink">{part.sentence}</span> : null}
      {part.source ? <SourceLink source={sourceRef(part.source)} /> : null}
    </div>
  )
}

/** What the lookup says about a row's part: "Looking up…" while pending, else one entry per looked-up part. */
function RowLookups({ row, parts }: { row: SpecRow; parts: readonly PartLookup[] | null }) {
  if (!row.kind) return null
  if (parts === null)
    return (
      <dd className="col-span-2 m-0 mt-1.5">
        <LookingUp />
      </dd>
    )
  const own = parts.filter((p) => p.kind === row.kind)
  if (own.length === 0) return null
  return (
    <dd className="col-span-2 m-0 mt-1.5 flex flex-col gap-2">
      {own.map((part) => (
        // Rows with several parts (drive types, graphics) name each one.
        <Lookup key={part.part_id} part={part} named={own.length > 1} />
      ))}
    </dd>
  )
}

interface Props {
  scan: DeviceScan
  /**
   * Part lookups (feature 018): null while they load, an empty list when there are none (no lookup on the
   * server, or it could not be reached), in which case the card looks as it did before the lookup existed.
   */
  parts?: readonly PartLookup[] | null
}

export function SpecsCard({ scan, parts = [] }: Props) {
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
          <div
            key={row.label}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 border-t border-line py-2.5 first:border-t-0"
          >
            <dt className="text-sm text-muted">{row.label}</dt>
            <dd className={`m-0 text-right text-sm font-semibold ${TONE_TEXT[row.tone]}`}>{row.value}</dd>
            <RowLookups row={row} parts={parts} />
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
