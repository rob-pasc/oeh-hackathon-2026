import type { Suitability } from '@leaaf/shared/common'
import type { CardView } from '../lib/pathView'
import { AnimatedText } from './AnimatedText'
import { PathIcon } from './PathIcon'

const BADGE: Record<Suitability, string> = {
  viable: 'bg-leaf-tint text-leaf-deep',
  conditional: 'bg-amber-tint text-amber-ink',
  not_suitable: 'bg-rose-tint text-rose-ink',
}

/** Classes of the flat, tinted block that shows a category's summary above its options. It is not clickable. */
export const SUMMARY_BLOCK = 'flex items-center gap-4 rounded-[20px] bg-leaf-tint px-5 py-[18px]'

/**
 * Icon, rank, name, labels, one-sentence reason, and key figures of a path, category or option.
 * `onTint` draws the icon tile white, for use on the tinted summary block.
 */
export function PathHeader({ view, onTint = false }: { view: CardView; onTint?: boolean }) {
  const muted = view.status === 'not_suitable'
  return (
    <>
      <div
        className={`flex h-12 w-12 flex-none items-center justify-center rounded-[14px] ${
          muted ? 'bg-track text-muted' : onTint ? 'bg-white text-leaf' : 'bg-leaf-tint text-leaf'
        }`}
      >
        <PathIcon path={view.iconPath} className="h-6 w-6" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {view.rank !== null ? <span className="text-[13px] font-bold text-muted">#{view.rank}</span> : null}
          <span className="text-[19px] font-bold">{view.title}</span>
          {view.isRecommended ? (
            <span className="rounded-full bg-leaf px-2.5 py-[3px] text-xs font-bold text-white">Recommended</span>
          ) : null}
          <span className={`rounded-full px-2.5 py-[3px] text-xs font-bold ${onTint && view.status === 'viable' ? 'bg-white text-leaf-deep' : BADGE[view.status]}`}>
            {view.statusLabel}
          </span>
          {view.aiEstimate ? (
            <span
              title="These figures are an AI estimate, not calculated from our impact table."
              className="cursor-help rounded-full border border-current px-2.5 py-[2px] text-xs font-bold text-amber-ink"
            >
              AI estimate
            </span>
          ) : null}
        </div>
        <span className="text-sm leading-snug text-muted">{view.summary}</span>
        <div className="flex flex-wrap gap-x-[18px] text-[13px]">
          {view.metrics.map((metric) => (
            <span key={metric.label} title={metric.hint} className={metric.hint ? 'cursor-help' : undefined}>
              <span className="text-muted">{metric.label} </span>
              <strong>
                <AnimatedText text={metric.value} />
              </strong>
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
