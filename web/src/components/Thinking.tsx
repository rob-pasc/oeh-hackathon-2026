import { useEffect, useState } from 'react'
import { nextThinkingPhrase, THINKING_INTERVAL_MS } from '../lib/thinking'

const PETALS = [0, 60, 120, 180, 240, 300]

/** Six leaf-shaped petals around a centre; each brightens in turn (CSS `.thinking-petal`). */
function LeafGlyph() {
  return (
    <svg viewBox="-12 -12 24 24" aria-hidden="true" className="thinking-glyph h-5 w-5 flex-none text-leaf">
      {PETALS.map((angle, i) => (
        <path
          key={angle}
          className="thinking-petal"
          style={{ animationDelay: `${(i * 1.2) / PETALS.length}s` }}
          transform={`rotate(${angle})`}
          d="M0 -2.2 C2.6 -4.6 2.6 -8.4 0 -10.8 C-2.6 -8.4 -2.6 -4.6 0 -2.2 Z"
          fill="currentColor"
        />
      ))}
      <circle r="1.3" fill="currentColor" />
    </svg>
  )
}

/**
 * Thinking line shown above placeholders while the page waits for the AI (feature 006 FR-044): an animated leaf
 * glyph and a phrase that changes to a random other phrase every few seconds. The changing phrase is hidden from
 * screen readers, which hear the steady `label` once instead.
 */
export function Thinking({ label = 'Writing the explanation…', className = '' }: { label?: string; className?: string }) {
  const [phrase, setPhrase] = useState(() => nextThinkingPhrase(null))

  useEffect(() => {
    const timer = window.setInterval(() => setPhrase((p) => nextThinkingPhrase(p)), THINKING_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div role="status" className={`flex items-center gap-2.5 ${className}`} data-testid="thinking">
      <LeafGlyph />
      <span key={phrase} aria-hidden="true" className="fade-up text-sm font-semibold text-muted">
        {phrase}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  )
}
