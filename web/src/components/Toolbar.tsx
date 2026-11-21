import type { Mode } from '@leaaf/shared/common'
import { useLayoutEffect, useState } from 'react'
import { MODE_LABELS, MODE_ORDER, USE_LABELS, USE_TAGS, isUseTag, type ResultTab, type UseTag } from '../lib/labels'

export interface TabItem {
  id: ResultTab
  label: string
}

interface Props {
  use: UseTag
  mode: Mode
  /** Overview first, then one tab per category in the Overview's order (feature 008 FR-009). */
  tabs: readonly TabItem[]
  tab: ResultTab
  onUseChange: (use: UseTag) => void
  onModeChange: (mode: Mode) => void
  onTabChange: (tab: ResultTab) => void
  disabled?: boolean
}

/**
 * The highlight behind the active button of a segmented control. It slides to the active button instead of
 * jumping. The buttons of the priority toggle are equally wide (flex-1) with a 4 px gap, so position and width follow from the index.
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

/**
 * Highlight for a segmented control whose buttons differ in width (the path tags). It follows the real position and
 * width of the active button, so a long label such as "Overview" is never wider than its highlight.
 */
function MeasuredHighlight({ container, index, className }: { container: HTMLElement | null; index: number; className: string }) {
  const [box, setBox] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    if (!container || index < 0) return undefined
    const buttons = Array.from(container.querySelectorAll('button'))
    const measure = () => {
      const button = buttons[index]
      if (button) setBox({ left: button.offsetLeft, width: button.offsetWidth })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    // Buttons change width when the window, the font, or the labels change.
    const observer = new ResizeObserver(measure)
    buttons.forEach((button) => observer.observe(button))
    return () => observer.disconnect()
  }, [container, index])
  if (index < 0 || !box) return null
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 left-0 rounded-full motion-safe:transition-[transform,width] motion-safe:duration-300 motion-safe:ease-out ${className}`}
      style={{ width: box.width, transform: `translateX(${box.left}px)` }}
    />
  )
}

export function Toolbar({ use, mode, tabs: items, tab: activeTab, onUseChange, onModeChange, onTabChange, disabled = false }: Props) {
  // The tag bar is held in state (not a ref object) so the highlight measures it once it exists.
  const [tabs, setTabs] = useState<HTMLDivElement | null>(null)
  return (
    // Same two columns as the result screen: the tab bar ends exactly where the cards end, and the priority
    // toggle beside it lines up with the gauge and specs column.
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] items-center gap-x-7 gap-y-4">
      <div className="flex min-w-0 items-center">
        <label className="flex flex-none items-center gap-3 text-sm font-semibold">
          <span className="text-muted">Intended use</span>
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
      </div>

      {/* Keeps the Use dropdown alone on the first row, so the gauge column starts level with the tab bar. */}
      <div aria-hidden="true" className="hidden xl:block" />

      {/* Category tabs get their own row above the cards: AI labels are longer than the old path names. */}
      <div role="group" aria-label="Show options for" className="flex min-w-0 overflow-x-auto rounded-full bg-white p-1 shadow-card">
        <div ref={setTabs} className="relative flex min-w-max flex-1 gap-1">
        <MeasuredHighlight key={items.map((t) => t.id).join('|')} container={tabs} index={items.findIndex((t) => t.id === activeTab)} className="bg-leaf-tint" />
        {items.map((tab) => {
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex-auto cursor-pointer rounded-full border-0 bg-transparent px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-default ${
                active ? 'text-leaf-deep' : 'text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
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
