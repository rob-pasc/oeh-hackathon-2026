import type { Step, StepPlan } from '@leaaf/shared/steps'
import { formatMinutes, NO_VERIFIED_STEPS, stepSources, type StepState } from '../lib/steps'
import { SourceLink } from './SourceLink'
import { Thinking } from './Thinking'
import { Sk } from './ui'

const FLAG = 'rounded-full px-2.5 py-[3px] text-xs font-bold'

/** The safety flag as visible text, so it is announced and not shown by colour alone (FR-004). */
function SafetyFlag({ step }: { step: Step }) {
  if (step.safety === 'professional') return <span className={`${FLAG} bg-rose-tint text-rose-ink`}>Professional only</span>
  if (step.safety === 'caution') return <span className={`${FLAG} bg-amber-tint text-amber-ink`}>Caution</span>
  return null
}

/** Tools, parts and time; lines without a value are left out (FR-003). */
function StepNeeds({ step }: { step: Step }) {
  const rows: [string, string][] = []
  if (step.tools.length) rows.push(['Tools', step.tools.join(', ')])
  if (step.parts.length) rows.push(['Parts', step.parts.join(', ')])
  if (step.minutes) rows.push(['Time', formatMinutes(step.minutes)])
  if (!rows.length) return null
  return (
    <dl className="m-0 flex flex-wrap gap-x-[18px] gap-y-1 text-[13px]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-1">
          <dt className="text-muted">{label}</dt>
          <dd className="m-0 font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function StepBlock({ step, index, plan }: { step: Step; index: number; plan: StepPlan }) {
  return (
    <li className="flex gap-3 rounded-[14px] border border-line p-3.5">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-leaf-tint text-[13px] font-bold text-leaf-deep"
      >
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold leading-snug">{step.title}</span>
          <SafetyFlag step={step} />
        </div>
        <p className="m-0 text-sm leading-snug">{step.detail}</p>
        {step.warning ? (
          <p className="m-0 rounded-[10px] bg-amber-tint px-3 py-2 text-[13px] text-amber-ink">
            <strong>Warning: </strong>
            {step.warning}
          </p>
        ) : null}
        <StepNeeds step={step} />
        {stepSources(step, plan).map((source) => (
          <SourceLink key={source.url} source={source} />
        ))}
      </div>
    </li>
  )
}

/**
 * The "What to do" section of an option card (feature 009): numbered step blocks with their needs,
 * safety flags and sources, the thinking line while the plan loads (FR-010), the empty-plan message
 * (FR-006) and the template notice (FR-011).
 */
export function StepList({ state }: { state: StepState | undefined }) {
  if (!state || state.state === 'loading') {
    return (
      <div className="flex flex-col gap-2.5" data-testid="steps-loading">
        <Thinking label="Writing the steps…" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 rounded-[14px] border border-line p-3.5">
            <Sk className="h-7 w-7 flex-none rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Sk className="h-3.5 w-1/2" />
              <Sk className="h-3.5 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (state.state === 'error') {
    return <span className="text-sm text-muted">The steps could not be loaded. Close and reopen the option to try again.</span>
  }
  const { plan } = state
  return (
    <div className="flex flex-col gap-2.5">
      {plan.source === 'template' && plan.notice ? (
        <p className="m-0 rounded-[10px] bg-amber-tint px-3 py-2 text-[13px] text-amber-ink">{plan.notice}</p>
      ) : null}
      {plan.steps.length ? (
        // role="list" keeps the list semantics that list-none removes in Safari.
        <ol role="list" aria-label="Steps" className="m-0 flex list-none flex-col gap-2.5 p-0">
          {plan.steps.map((step, index) => (
            <StepBlock key={`${index}:${step.title}`} step={step} index={index} plan={plan} />
          ))}
        </ol>
      ) : (
        <span className="text-sm text-muted">{NO_VERIFIED_STEPS}</span>
      )}
    </div>
  )
}
