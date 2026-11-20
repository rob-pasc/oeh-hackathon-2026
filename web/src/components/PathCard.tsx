import type { Suitability } from '@leaaf/shared/common'
import type { PathView } from '../lib/pathView'
import { PathIcon } from './PathIcon'
import { Sk } from './ui'

const BADGE: Record<Suitability, string> = {
  viable: 'bg-leaf-tint text-leaf-deep',
  conditional: 'bg-amber-tint text-amber-ink',
  not_suitable: 'bg-rose-tint text-rose-ink',
}

const SECTION_LABEL = 'text-xs font-bold tracking-wider text-leaf uppercase'

interface Props {
  view: PathView
  selected: boolean
  open: boolean
  /** True until the explained report has arrived; the details then show placeholders. */
  reportPending: boolean
  onToggle: () => void
}

export function PathCard({ view, selected, open, reportPending, onToggle }: Props) {
  const muted = view.status === 'not_suitable'
  return (
    <section
      aria-label={view.title}
      className={`overflow-hidden rounded-[20px] border-2 bg-white shadow-card transition-shadow hover:shadow-lift ${
        selected ? 'border-leaf' : 'border-transparent'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-4 border-0 bg-transparent px-5 py-[18px] text-left text-ink"
      >
        <div
          className={`flex h-12 w-12 flex-none items-center justify-center rounded-[14px] ${
            muted ? 'bg-track text-muted' : 'bg-leaf-tint text-leaf'
          }`}
        >
          <PathIcon path={view.id} className="h-6 w-6" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[13px] font-bold text-muted">#{view.rank}</span>
            <span className="text-[19px] font-bold">{view.title}</span>
            {view.isRecommended ? (
              <span className="rounded-full bg-leaf px-2.5 py-[3px] text-xs font-bold text-white">Recommended</span>
            ) : null}
            <span className={`rounded-full px-2.5 py-[3px] text-xs font-bold ${BADGE[view.status]}`}>
              {view.statusLabel}
            </span>
          </div>
          <span className="text-sm leading-snug text-muted">{view.summary}</span>
          <div className="flex flex-wrap gap-x-[18px] text-[13px]">
            <span>
              <span className="text-muted">Cost </span>
              <strong>{view.cost}</strong>
            </span>
            <span>
              <span className="text-muted">Extra life </span>
              <strong>{view.life}</strong>
            </span>
            <span>
              <span className="text-muted">Score </span>
              <strong>{view.total === null ? '—' : Math.round(view.total)}</strong>
            </span>
          </div>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`h-5 w-5 flex-none text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="grid grid-cols-2 gap-x-7 gap-y-3.5 border-t border-line pt-4 pr-5 pb-5 pl-[84px]">
          <div className="flex flex-col gap-2">
            <span className={SECTION_LABEL}>What to do</span>
            {view.steps.length > 0 ? (
              <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-[18px] text-sm leading-snug">
                {view.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : reportPending ? (
              <>
                <Sk className="h-3.5 w-full" />
                <Sk className="h-3.5 w-4/5" />
              </>
            ) : (
              <span className="text-sm text-muted">No steps available.</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className={SECTION_LABEL}>Why</span>
            {view.why ? (
              <span className="text-sm leading-snug">{view.why}</span>
            ) : reportPending ? (
              <>
                <Sk className="h-3.5 w-full" />
                <Sk className="h-3.5 w-3/5" />
              </>
            ) : (
              <span className="text-sm text-muted">No explanation available.</span>
            )}
            {view.source ? (
              <a
                href={view.source.url}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] font-medium text-leaf hover:text-leaf-dark"
              >
                Source: {view.source.label}
              </a>
            ) : null}
          </div>
          {view.notes.length > 0 ? (
            <div className="col-span-2 flex flex-col gap-1 rounded-[10px] bg-amber-tint px-3 py-2 text-[13px] leading-snug text-amber-ink">
              {view.notes.map((note) => (
                <span key={note}>{note}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
