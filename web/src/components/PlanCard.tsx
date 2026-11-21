import type { PlanView } from '../lib/planView'
import type { StepState } from '../lib/steps'
import { PathHeader } from './PathHeader'
import { StepList } from './StepList'

interface Props {
  view: PlanView
  selected: boolean
  open: boolean
  onToggle: () => void
  /** The plan's single step list (feature 014), once requested. */
  steps?: StepState | undefined
}

/**
 * "Your plan" above the categories (feature 013 FR-007): the plan's header, figures and step titles in
 * order. Opening it shows one step list for the whole plan (feature 014).
 */
export function PlanCard({ view, selected, open, onToggle, steps }: Props) {
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
      <ol aria-label="Plan steps" className="m-0 flex list-decimal flex-col gap-1.5 border-t border-line py-4 pr-5 pl-[38px] text-sm leading-snug sm:pl-[102px]">
        {view.stepTitles.map((title, i) => (
          // Two AI options can share a title, so the position is part of the key.
          <li key={`${i}:${title}`}>{title}</li>
        ))}
      </ol>
      {open && steps ? (
        <div className="fade-up flex flex-col gap-2 border-t border-line pt-4 pr-5 pb-5 pl-5 sm:pl-[84px]">
          <span className="text-xs font-bold tracking-wider text-leaf uppercase">What to do</span>
          <StepList state={steps} />
        </div>
      ) : null}
    </section>
  )
}
