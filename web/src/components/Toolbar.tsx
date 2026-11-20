import type { Mode } from '@leaaf/shared/common'
import { MODE_LABELS, MODE_ORDER, USE_LABELS, USE_TAGS, isUseTag, type UseTag } from '../lib/labels'

interface Props {
  use: UseTag
  mode: Mode
  onUseChange: (use: UseTag) => void
  onModeChange: (mode: Mode) => void
  disabled?: boolean
}

export function Toolbar({ use, mode, onUseChange, onModeChange, disabled = false }: Props) {
  return (
    <div className="flex items-center justify-between gap-6">
      <label className="flex items-center gap-3 text-sm font-semibold">
        <span className="text-muted">Use</span>
        <select
          value={use}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value
            if (isUseTag(next)) onUseChange(next)
          }}
          className="cursor-pointer rounded-full border border-line bg-white py-2.5 pr-9 pl-4 text-sm font-semibold text-ink shadow-card"
        >
          {USE_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {USE_LABELS[tag]}
            </option>
          ))}
        </select>
      </label>

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
              className={`cursor-pointer rounded-full border-0 px-5 py-2.5 text-sm font-semibold transition-colors ${
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
