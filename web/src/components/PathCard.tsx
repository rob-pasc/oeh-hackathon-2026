import type { CardView } from '../lib/pathView'
import type { StepState } from '../lib/steps'
import { PathHeader } from './PathHeader'
import { StepList } from './StepList'
import { Thinking } from './Thinking'
import { Sk } from './ui'

const SECTION_LABEL = 'text-xs font-bold tracking-wider text-leaf uppercase'

interface Props {
  view: CardView
  selected: boolean
  open: boolean
  /** True while the details are still on their way; the opened card then shows placeholders. */
  pending: boolean
  onToggle: () => void
  /** An option's step plan (feature 009); when given, it fills a full-width "What to do" section below "Why". */
  plan?: StepState
  /**
   * The card opens another view instead of expanding (a category on the Overview opens its tab),
   * so it shows a forward chevron and no details.
   */
  navigates?: boolean
}

function Chevron({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-5 w-5 flex-none text-muted transition-transform ${className}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function PathCard({ view, selected, open, pending, onToggle, plan, navigates = false }: Props) {
  const expanded = open && !navigates
  return (
    <section
      aria-label={view.title}
      className={`overflow-hidden rounded-[20px] border-2 bg-white shadow-card transition-[box-shadow,translate] duration-200 hover:shadow-lift motion-safe:hover:-translate-y-0.5 ${
        selected ? 'border-leaf' : 'border-transparent'
      }`}
    >
      <button
        type="button"
        {...(navigates ? {} : { 'aria-expanded': expanded })}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-4 border-0 bg-transparent px-5 py-[18px] text-left text-ink"
      >
        <PathHeader view={view} />
        <Chevron className={navigates ? '-rotate-90' : expanded ? 'rotate-180' : ''} />
      </button>

      {expanded ? (
        <div className="fade-up grid sm:grid-cols-2 gap-x-7 gap-y-3.5 border-t border-line pt-4 pr-5 pb-5 pl-5 sm:pl-[84px]">
          {pending && !view.why ? <Thinking className="sm:col-span-2" /> : null}
          {view.steps !== null ? (
            <div className="flex flex-col gap-2">
              <span className={SECTION_LABEL}>What to do</span>
              {view.steps.length > 0 ? (
                <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-[18px] text-sm leading-snug">
                  {view.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              ) : pending ? (
                <>
                  <Sk className="h-3.5 w-full" />
                  <Sk className="h-3.5 w-4/5" />
                </>
              ) : (
                <span className="text-sm text-muted">No steps available.</span>
              )}
            </div>
          ) : null}
          <div className={`flex flex-col gap-2 ${view.steps === null ? 'sm:col-span-2' : ''}`}>
            <span className={SECTION_LABEL}>Why</span>
            {view.why ? (
              <span className="text-sm leading-snug">{view.why}</span>
            ) : pending ? (
              <>
                <Sk className="h-3.5 w-full" />
                <Sk className="h-3.5 w-3/5" />
              </>
            ) : (
              <span className="text-sm text-muted">No explanation available.</span>
            )}
            {view.sources.map((source) => (
              <a
                key={source.url + source.label}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] font-medium text-leaf hover:text-leaf-dark"
              >
                Source: {source.label}
              </a>
            ))}
          </div>
          {plan ? (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className={SECTION_LABEL}>What to do</span>
              <StepList state={plan} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
