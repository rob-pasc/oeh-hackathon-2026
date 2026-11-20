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

export function Toolbar({ use, mode, pathTab, onUseChange, onModeChange, onPathTabChange, disabled = false }: Props) {
  return (
    // Same two columns as the result screen, so the tag bar ends exactly where the cards end and the priority
    // toggle lines up with the gauge and specs column.
    <div className="grid grid-cols-[1fr_400px] items-center gap-7">
      <div className="flex min-w-0 items-center gap-4">
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

        <div role="group" aria-label="Show steps for" className="flex min-w-0 flex-1 gap-1 rounded-full bg-white p-1 shadow-card">
          {PATH_TABS.map((tab) => {
            const active = tab === pathTab
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onPathTabChange(tab)}
                className={`min-w-0 flex-1 cursor-pointer rounded-full border-0 px-2 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-default ${
                  active ? 'bg-leaf-tint text-leaf-deep' : 'bg-transparent text-muted hover:text-ink'
                }`}
              >
                {PATH_TAB_LABELS[tab]}
              </button>
            )
          })}
        </div>
      </div>

      <div role="group" aria-label="Ranking priority" className="flex gap-1 rounded-full bg-white p-1 shadow-card">
        {MODE_ORDER.map((m) => {
          const active = m === mode
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onModeChange(m)}
              className={`flex-1 cursor-pointer rounded-full border-0 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                active ? 'bg-leaf text-white' : 'bg-transparent text-muted hover:text-ink'
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
