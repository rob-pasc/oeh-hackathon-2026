import type { CardView } from '../lib/pathView'
import { PathHeader, SUMMARY_BLOCK } from './PathHeader'
import { Sk } from './ui'

const BLOCK = 'rounded-[20px] bg-white shadow-card'

interface Props {
  view: CardView
  /** True until the explained report has arrived; the steps then show placeholders. */
  reportPending: boolean
}

/** The single steps of one path, each as its own block in the style of the path cards. */
export function StepsView({ view, reportPending }: Props) {
  return (
    <div className="flex flex-col gap-3.5" data-testid="steps-view">
      <section aria-label={view.title} className={SUMMARY_BLOCK}>
        <PathHeader view={view} onTint />
      </section>

      {view.steps.length > 0 ? (
        <ol aria-label={`Steps for ${view.title}`} className="m-0 flex list-none flex-col gap-3.5 p-0">
          {view.steps.map((step, index) => (
            <li key={`${index}-${step}`} className={`${BLOCK} flex items-center gap-4 px-5 py-[18px]`}>
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-leaf-tint text-xl font-extrabold text-leaf">
                {index + 1}
              </div>
              <span className="text-[17px] leading-snug font-semibold">{step}</span>
            </li>
          ))}
        </ol>
      ) : reportPending ? (
        <div aria-hidden="true" className="flex flex-col gap-3.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${BLOCK} flex items-center gap-4 px-5 py-[18px]`}>
              <Sk className="h-12 w-12 flex-none rounded-[14px]" />
              <Sk className="h-4 w-3/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className={`${BLOCK} px-5 py-[18px] text-[15px] text-muted`}>No steps available for this path.</div>
      )}

      {view.why || view.source ? (
        <section aria-label="Why" className={`${BLOCK} flex flex-col gap-2 px-5 py-[18px]`}>
          <span className="text-xs font-bold tracking-wider text-leaf uppercase">Why</span>
          {view.why ? <span className="text-sm leading-snug">{view.why}</span> : null}
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
        </section>
      ) : null}
    </div>
  )
}
