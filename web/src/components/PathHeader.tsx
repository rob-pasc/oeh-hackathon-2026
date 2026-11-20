import type { Suitability } from '@leaaf/shared/common'
import type { CardView } from '../lib/pathView'
import { PathIcon } from './PathIcon'

const BADGE: Record<Suitability, string> = {
  viable: 'bg-leaf-tint text-leaf-deep',
  conditional: 'bg-amber-tint text-amber-ink',
  not_suitable: 'bg-rose-tint text-rose-ink',
}

/** Icon, rank, name, labels, one-sentence reason, and key figures of a path. Used by the path card and the steps view. */
export function PathHeader({ view }: { view: CardView }) {
  const muted = view.status === 'not_suitable'
  return (
    <>
      <div
        className={`flex h-12 w-12 flex-none items-center justify-center rounded-[14px] ${
          muted ? 'bg-track text-muted' : 'bg-leaf-tint text-leaf'
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
          <span className={`rounded-full px-2.5 py-[3px] text-xs font-bold ${BADGE[view.status]}`}>{view.statusLabel}</span>
        </div>
        <span className="text-sm leading-snug text-muted">{view.summary}</span>
        <div className="flex flex-wrap gap-x-[18px] text-[13px]">
          {view.metrics.map((metric) => (
            <span key={metric.label}>
              <span className="text-muted">{metric.label} </span>
              <strong>{metric.value}</strong>
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
