// Geometry of the CO₂e gauge: a half circle from 0 % (left) over the top to 100 % (right).
export const GAUGE = { cx: 150, cy: 150, r: 110 } as const

/** Point on the gauge circle for a percentage (0–100) at the given radius. */
export function polar(pct: number, radius: number = GAUGE.r): { x: number; y: number } {
  const angle = Math.PI * (1 - pct / 100)
  return {
    x: GAUGE.cx + radius * Math.cos(angle),
    y: GAUGE.cy - radius * Math.sin(angle),
  }
}

const f = (n: number) => n.toFixed(1)

/** SVG path of the full background track (0–100 %). */
export const TRACK_PATH = (() => {
  const a = polar(0)
  const b = polar(100)
  return `M${f(a.x)} ${f(a.y)}A${GAUGE.r} ${GAUGE.r} 0 0 1 ${f(b.x)} ${f(b.y)}`
})()

/**
 * SVG path of the arc between two percentages, or null when the range is empty.
 * The scale is a half circle, so no arc is ever longer than 180 degrees: the SVG "large arc" flag must stay 0.
 * (Setting it for ranges above 50 % makes the arc swing around the wrong centre.)
 */
export function arcPath(lowPct: number, highPct: number): string | null {
  if (highPct - lowPct < 0.5) return null
  const a = polar(lowPct)
  const b = polar(highPct)
  return `M${f(a.x)} ${f(a.y)}A${GAUGE.r} ${GAUGE.r} 0 0 1 ${f(b.x)} ${f(b.y)}`
}

/** Rotation of a needle that points straight up at 50 %: -90° at 0 %, +90° at 100 %. */
export function needleAngle(pct: number): number {
  const clamped = Math.min(100, Math.max(0, pct))
  return (clamped / 100) * 180 - 90
}
