import type { Mode } from '@leaaf/shared/common'
import {
  MODE_LABELS,
  MODE_ORDER,
  PATH_TABS,
  PATH_TAB_LABELS,
  USE_LABELS,
  USE_TAGS,
  isUseTag,
  type PathTab,
  type UseTag,
} from '../lib/labels'

interface Props {
  use: UseTag
  mode: Mode
  pathTab: PathTab
  onUseChange: (use: UseTag) => void
  onModeChange: (mode: Mode) => void
  onPathTabChange: (tab: PathTab) => void
  disabled?: boolean
}

/**
 * The highlight behind the active button of a segmented control. It slides to the active button instead of
 * jumping. The buttons are equally wide (flex-1) with a 4 px gap, so position and width follow from the index.
 */
function SlidingHighlight({ index, count, className }: { index: number; count: number; className: string }) {
  if (index < 0) return null
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 left-0 rounded-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out ${className}`}
      style={{
        width: `calc((100% - ${4 * (count - 1)}px) / ${count})`,
        transform: `translateX(calc(${index} * (100% + 4px)))`,
      }}
    />
  )
}

export function Toolbar({ use, mode, pathTab, onUseChange, onModeChange, onPathTabChange, disabled = false }: Props) {
  return (
    // Same two columns as the result screen, so the tag bar ends exactly where the cards end and the priority
    // toggle lines up with the gauge and specs column.
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] items-center gap-7">
      <div className="flex min-w-0 flex-col items-stretch gap-4 md:flex-row md:items-center">
        <label className="flex flex-none items-center gap-3 text-sm font-semibold">
          <span className="text-muted">Use</span>
          <span className="relative inline-flex">
            <select
              value={use}
              disabled={disabled}
              onChange={(event) => {
                const next = event.target.value
                if (isUseTag(next)) onUseChange(next)
              }}
              className="cursor-pointer appearance-none rounded-full border border-line bg-white py-3 pr-11 pl-5 text-sm font-semibold text-ink shadow-card"
            >
              {USE_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {USE_LABELS[tag]}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-4 h-[18px] w-[18px] -translate-y-1/2 text-ink"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </label>

        <div role="group" aria-label="Show steps for" className="flex min-w-0 flex-1 overflow-x-auto rounded-full bg-white p-1 shadow-card">
          <div className="relative flex min-w-[32rem] flex-1 xl:min-w-0 gap-1">
          <SlidingHighlight index={PATH_TABS.indexOf(pathTab)} count={PATH_TABS.length} className="bg-leaf-tint" />
          {PATH_TABS.map((tab) => {
            const active = tab === pathTab
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onPathTabChange(tab)}
                className={`relative min-w-0 flex-1 cursor-pointer rounded-full border-0 bg-transparent px-2 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-default ${
                  active ? 'text-leaf-deep' : 'text-muted hover:text-ink'
                }`}
              >
                {PATH_TAB_LABELS[tab]}
              </button>
            )
          })}
          </div>
        </div>
      </div>

      <div role="group" aria-label="Ranking priority" className="flex rounded-full bg-white p-1 shadow-card">
        <div className="relative flex flex-1 gap-1">
        <SlidingHighlight index={MODE_ORDER.indexOf(mode)} count={MODE_ORDER.length} className="bg-leaf" />
        {MODE_ORDER.map((m) => {
          const active = m === mode
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onModeChange(m)}
              className={`relative flex-1 cursor-pointer rounded-full border-0 bg-transparent px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                active ? 'text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          )
        })}
        </div>
      </div>
    </div>
  )
}
