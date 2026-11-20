// Makes avoided CO₂e tangible ("about as much as driving 1,300 km"). The factors are published averages for
// Austria; they are not computed by the app. Update them here together with the source when a newer table appears.
import type { Range } from '@leaaf/shared/common'

/** Umweltbundesamt, "Emissionskennzahlen Verkehrsmittel pro Personenkilometer", updated May 2026 (data year 2024). */
export const EQUIVALENTS_SOURCE = {
  label: 'Umweltbundesamt (2026)',
  url: 'https://www.umweltbundesamt.at/fileadmin/site/themen/mobilitaet/daten/ekz_pkm_verkehrsmittel.pdf',
}

/** Average car in Austria (incl. electric), g CO₂e per passenger-km, direct emissions. */
export const CAR_G_PER_KM = 136.7
/** Short- and medium-haul flight, g CO₂e per passenger-km, including the factor 2 for non-CO₂ effects. */
export const FLIGHT_G_PER_KM = 236
/** Vienna to London, approximate flight distance in km (one way). */
export const VIENNA_LONDON_KM = 1240

export interface Equivalent {
  kind: 'car' | 'flight'
  /** e.g. "1,320–2,500 km" or "up to 1,900 km". */
  amount: string
  /** e.g. "by car". */
  label: string
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step
const km = (n: number) => roundTo(n, n >= 1000 ? 50 : 10).toLocaleString('en-US')
const one = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 })

function amount(low: number, high: number, fmt: (n: number) => string, unit: string): string {
  const hi = fmt(high)
  if (low <= 0) return `up to ${hi}${unit}`
  const lo = fmt(low)
  return lo === hi ? `${hi}${unit}` : `${lo}–${hi}${unit}`
}

/** Equivalents for an avoided CO₂e range in kg, or null when nothing is avoided. */
export function equivalents(avoidedKg: Range): Equivalent[] | null {
  const high = avoidedKg.high
  if (!(high > 0)) return null
  const low = Math.max(0, avoidedKg.low)
  const carKm = (kg: number) => (kg * 1000) / CAR_G_PER_KM
  const flights = (kg: number) => (kg * 1000) / (FLIGHT_G_PER_KM * VIENNA_LONDON_KM)
  const flightHigh = flights(high)
  return [
    { kind: 'car', amount: amount(carKm(low), carKm(high), km, ' km'), label: 'by car' },
    {
      kind: 'flight',
      amount: amount(flights(low), flightHigh, one, ''),
      label: flightHigh < 1.05 ? 'flight Vienna → London' : 'flights Vienna → London',
    },
  ]
}
