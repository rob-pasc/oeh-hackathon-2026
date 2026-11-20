// Small motion helpers. Every animation in the app checks motionAllowed(), so nothing moves when the system asks
// for reduced motion, during server rendering, or in tests (which assert final values).
import { useCallback, useLayoutEffect, useRef } from 'react'

export function motionAllowed(): boolean {
  if (import.meta.env.MODE === 'test') return false
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * FLIP animation for a reordered list: when the order of `ids` changes, every item slides from its old position
 * to its new one instead of jumping. Positions are measured with offsetTop, so the list container should be the
 * items' offset parent (give it `relative`). Returns a ref factory: `ref={register(id)}`.
 */
export function useFlip(ids: readonly string[]) {
  const nodes = useRef(new Map<string, HTMLElement>())
  const tops = useRef(new Map<string, number>())
  const lastOrder = useRef<string | null>(null)
  const order = ids.join('|')

  useLayoutEffect(() => {
    const reordered = lastOrder.current !== null && lastOrder.current !== order
    const animate = reordered && motionAllowed()
    for (const [id, el] of nodes.current) {
      const top = el.offsetTop
      const before = tops.current.get(id)
      if (animate && before !== undefined && before !== top && typeof el.animate === 'function') {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'translateY(0)' }], {
          duration: 450,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        })
      }
      tops.current.set(id, top)
    }
    lastOrder.current = order
  })

  return useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(id, el)
      else nodes.current.delete(id)
    },
    [],
  )
}

// ---- Counting numbers -------------------------------------------------------------------------------------

const NUMBER = /\d[\d,]*(?:\.\d+)?/g

interface NumberToken {
  value: number
  decimals: number
  grouped: boolean
}

function tokens(text: string): { parts: string[]; numbers: NumberToken[] } {
  const parts = text.split(NUMBER)
  const numbers = (text.match(NUMBER) ?? []).map((raw) => ({
    value: Number(raw.replace(/,/g, '')),
    decimals: raw.includes('.') ? raw.split('.')[1]!.length : 0,
    grouped: raw.includes(','),
  }))
  return { parts, numbers }
}

function format(value: number, token: NumberToken): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: token.decimals,
    maximumFractionDigits: token.decimals,
    useGrouping: token.grouped,
  })
}

/**
 * The text `to` with each of its numbers moved a share `t` (0–1) of the way from the matching number in `from`.
 * When the two texts do not have the same shape (different words or a different count of numbers), every number
 * starts from 0. Example: interpolateText('€40–70', '€60–90', 0.5) → '€50–80'.
 */
export function interpolateText(from: string, to: string, t: number): string {
  const target = tokens(to)
  if (target.numbers.length === 0) return to
  const start = tokens(from)
  const sameShape =
    start.numbers.length === target.numbers.length && start.parts.every((part, i) => part === target.parts[i])
  const p = Math.min(1, Math.max(0, t))
  let out = target.parts[0] ?? ''
  target.numbers.forEach((token, i) => {
    const origin = sameShape ? start.numbers[i]!.value : 0
    out += format(origin + (token.value - origin) * p, token) + (target.parts[i + 1] ?? '')
  })
  return out
}
