// Formatting and derived figures for impact ranges. All numbers come from the Assessment contract
// (feature 003); nothing here invents a figure. Ranges stay ranges (feature 003 NFR "Honesty").
import type { Assessment, Impact } from '@leaaf/shared/assessment'
import type { Range } from '@leaaf/shared/common'

type Baseline = Assessment['baseline']

const round = (n: number) => Math.round(n)
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function formatEur(range: Range): string {
  const low = round(range.low)
  const high = round(range.high)
  return low === high ? `€${low}` : `€${low}–${high}`
}

export function formatYears(range: Range): string {
  const low = Math.round(range.low * 10) / 10
  const high = Math.round(range.high * 10) / 10
  if (high <= 0) return 'No extra life'
  if (low === high) return `+${low} ${low === 1 ? 'year' : 'years'}`
  return `+${low}–${high} years`
}

export interface GaugeValue {
  /** Percent of a comparable new laptop's production CO₂e that this path avoids (0–100). */
  mid: number
  low: number
  high: number
}

/**
 * Gauge scale: avoided CO₂e (contract field `avoided_vs_baseline`) divided by the midpoint of the baseline
 * range, clamped to 0–100 %. Low and high give the shaded range on the gauge.
 */
export function gaugeValue(impact: Impact, baseline: Baseline): GaugeValue | null {
  const baselineMid = (baseline.co2e_kg.low + baseline.co2e_kg.high) / 2
  if (!(baselineMid > 0)) return null
  const { low, high } = impact.co2e_kg.avoided_vs_baseline
  const pct = (kg: number) => clamp(round((kg / baselineMid) * 100), 0, 100)
  return { mid: pct((low + high) / 2), low: pct(low), high: pct(high) }
}

/** Emissions caused by the action itself (new parts), as "+5–12 kg CO₂e". Shown on option cards. */
export function formatAdded(impact: Impact): string {
  const { low, high } = impact.co2e_kg.path
  const hi = round(high)
  if (hi <= 0) return '0 kg'
  const lo = Math.max(0, round(low))
  return `+${lo === hi ? hi : `${lo}–${hi}`} kg`
}
