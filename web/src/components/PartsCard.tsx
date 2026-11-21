import { useState } from 'react'
import type { DetectedPart, PartKind, PartLookup } from '../api/types'
import { LaptopView } from './LaptopView'

const CHIP: Record<Exclude<PartLookup, 'pending'>, { label: string; className: string }> = {
  catalog: { label: 'Matched', className: 'bg-leaf-tint text-leaf-deep' },
  ai: { label: 'AI estimate · check', className: 'bg-amber-tint text-amber-ink' },
  not_found: { label: 'No match', className: 'bg-track text-muted' },
}

const STORAGE_KEY = 'leaaf.showLaptopView'

// Shown unless the person hid it; the choice is remembered per browser. Storage can be missing or blocked, so
// every access is guarded.
function readShowLaptop(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function writeShowLaptop(show: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, show ? '1' : '0')
  } catch {
    // Not remembered; the toggle still works for this page.
  }
}

function LookupChip({ lookup }: { lookup: PartLookup }) {
  if (lookup === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
        <span aria-hidden="true" className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
        Looking up…
      </span>
    )
  }
  const chip = CHIP[lookup]
  return <span className={`rounded-full px-2 py-[2px] text-[11px] font-bold ${chip.className}`}>{chip.label}</span>
}

interface Props {
  parts: readonly DetectedPart[]
  /** Kinds the scanner is reading right now (for the laptop view). */
  active: readonly PartKind[]
}

/** Live list of what the scanner found, with what the parts list or the AI search says about each part. */
export function PartsCard({ parts, active }: Props) {
  const [showLaptop, setShowLaptop] = useState(readShowLaptop)

  return (
    <section aria-label="Found in your device" className="flex flex-col gap-4 rounded-[20px] bg-white p-6 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold">Found so far</h2>
        <button
          type="button"
          aria-pressed={showLaptop}
          onClick={() => {
            setShowLaptop(!showLaptop)
            writeShowLaptop(!showLaptop)
          }}
          className="cursor-pointer rounded-full border-0 bg-transparent px-2 py-1 text-[13px] font-semibold text-leaf hover:text-leaf-dark"
        >
          {showLaptop ? 'Hide laptop view' : 'Show laptop view'}
        </button>
      </div>

      {showLaptop ? <LaptopView parts={parts} active={active} /> : null}

      {parts.length === 0 ? (
        <p className="m-0 text-sm text-muted">Parts appear here as the scanner finds them.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {parts.map((part) => (
            <li key={part.part_id} className="fade-up flex flex-col gap-1 border-t border-line py-2.5 first:border-t-0 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted">{part.label}</span>
                <LookupChip lookup={part.lookup} />
              </div>
              <span className="text-sm font-semibold">{part.value}</span>
              {part.detail ? (
                <span className="fade-up text-[13px] leading-snug text-muted">
                  {part.detail}
                  {part.source ? (
                    <>
                      {' '}
                      <a href={part.source.url} target="_blank" rel="noreferrer" className="font-medium text-leaf hover:text-leaf-dark">
                        {part.source.label}
                      </a>
                    </>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
