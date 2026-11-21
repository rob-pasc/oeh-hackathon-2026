import type { PlanView } from '../lib/planView'
import { PathHeader } from './PathHeader'

/** "Your plan" above the categories (feature 013 FR-007): the plan's header, figures and step titles in order. */
export function PlanCard({ view, selected }: { view: PlanView; selected: boolean }) {
  return (
    <section
      aria-label={view.title}
      className={`overflow-hidden rounded-[20px] border-2 bg-white shadow-card ${selected ? 'border-leaf' : 'border-transparent'}`}
    >
      <div className="flex items-center gap-4 px-5 py-[18px] text-ink">
        <PathHeader view={view} />
      </div>
      <ol aria-label="Plan steps" className="m-0 flex list-decimal flex-col gap-1.5 border-t border-line py-4 pr-5 pl-[38px] text-sm leading-snug sm:pl-[102px]">
        {view.stepTitles.map((title, i) => (
          // Two AI options can share a title, so the position is part of the key.
          <li key={`${i}:${title}`}>{title}</li>
        ))}
      </ol>
    </section>
  )
}
