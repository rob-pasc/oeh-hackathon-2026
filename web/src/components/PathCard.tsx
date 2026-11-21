import type { CardView } from '../lib/pathView'
import { PathHeader } from './PathHeader'
import { Thinking } from './Thinking'
import { Sk } from './ui'

const SECTION_LABEL = 'text-xs font-bold tracking-wider text-leaf uppercase'

interface Props {
  children?: React.ReactNode
  view: CardView
  selected: boolean
  open: boolean
  /** True until the explained report has arrived; the details then show placeholders. */
  reportPending: boolean
  onToggle: () => void
}

export function PathCard({ view, selected, open, reportPending, onToggle, children }: Props) {
  return (
    <section
      aria-label={view.title}
      className={`overflow-hidden rounded-[20px] border-2 bg-white shadow-card transition-[box-shadow,translate] duration-200 hover:shadow-lift motion-safe:hover:-translate-y-0.5 ${
        selected ? 'border-leaf' : 'border-transparent'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-4 border-0 bg-transparent px-5 py-[18px] text-left text-ink"
      >
        <PathHeader view={view} />
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
        <div className="fade-up grid sm:grid-cols-2 gap-x-7 gap-y-3.5 border-t border-line pt-4 pr-5 pb-5 pl-5 sm:pl-[84px]">
          {reportPending && view.steps.length === 0 && !view.why ? <Thinking className="sm:col-span-2" /> : null}
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
          {children}
          {view.changes.length > 0 ? (
            <div className="col-span-full flex flex-col gap-2" data-testid="before-after">
              <span className={SECTION_LABEL}>Before → after</span>
              <div className="grid grid-cols-[auto_auto_auto_1fr] items-center gap-x-3 gap-y-1.5 rounded-[12px] bg-page px-4 py-3 text-sm">
                {view.changes.map((change) => (
                  <div key={change.label} className="contents">
                    <span className="text-muted">{change.label}</span>
                    <span className="text-muted">{change.before}</span>
                    <span aria-hidden="true" className="text-leaf">→</span>
                    <strong className="text-leaf-deep">{change.after}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
