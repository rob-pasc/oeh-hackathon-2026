// Display helpers for step plans (feature 009): the load state of an option's plan, the time range,
// and the source links of one step.
import type { Range } from '@leaaf/shared/common'
import type { Step, StepPlan } from '@leaaf/shared/steps'
import type { SourceRef } from './pathView'

/** A plan's load state; `error` lets reopening the card try again. */
export type StepState = { state: 'loading' } | { state: 'ready'; plan: StepPlan } | { state: 'error'; message: string }

/** Shown instead of the plan when the server removed every step (FR-006). */
export const NO_VERIFIED_STEPS = 'No verified steps for this option yet. Ask a service provider to confirm it.'

const hours = (minutes: number) => String(Math.round((minutes / 60) * 10) / 10)

/** "10–15 min", "5 min", or "1–2 h" once both ends are whole hours of at least one hour. */
export function formatMinutes({ low, high }: Range): string {
  if (low >= 60 && low % 60 === 0 && high % 60 === 0) return low === high ? `${hours(low)} h` : `${hours(low)}–${hours(high)} h`
  return low === high ? `${low} min` : `${low}–${high} min`
}

/** The step's cited documents as links: one per document, labelled with its title and section (FR-007). */
export function stepSources(step: Step, plan: StepPlan): SourceRef[] {
  const passages = new Map(plan.passages.map((p) => [p.passage_id, p]))
  const sources: SourceRef[] = []
  for (const id of step.passage_ids) {
    const p = passages.get(id)
    if (!p || sources.some((s) => s.url === p.url)) continue
    sources.push({ label: p.section ? `${p.title}, ${p.section}` : p.title, url: p.url })
  }
  return sources
}
