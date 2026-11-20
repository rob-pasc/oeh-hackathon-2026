// Cost, extra-useful-life, and CO2e ranges per path (feature 003 FR-008, FR-009, T-004).
//
// Ranges are carried as low/high through every step (interval arithmetic), and every figure
// names the impact table entries it comes from (`impact_refs`). Paths are compared against one
// baseline, "the owner buys a comparable new computer now", and are never summed with each other.
import type { Assessment, DeviceScan, Impact, IntendedUse, Range } from '@leaaf/shared'
import type { ImpactEntry, ImpactTable } from '../impact/table.ts'
import type { PathPlan } from './gates.ts'

type Baseline = Assessment['baseline']
type Assumption = Impact['assumptions'][number]

export interface ImpactIndex {
  entry(id: string): ImpactEntry
}

export function indexImpactTable(table: ImpactTable): ImpactIndex {
  const byId = new Map(table.entries.map((e) => [e.id, e]))
  return {
    entry(id) {
      const e = byId.get(id)
      if (!e) throw new Error(`impact table has no entry ${id}`)
      return e
    },
  }
}

const ZERO: Range = { low: 0, high: 0 }
const add = (a: Range, b: Range): Range => ({ low: a.low + b.low, high: a.high + b.high })
const range = (e: ImpactEntry): Range => ({ low: e.low, high: e.high })

/** The baseline entries for the device's form factor; anything not a desktop is compared with a laptop. */
export function baselineFor(scan: DeviceScan, impact: ImpactIndex): Baseline {
  const kind = scan.identity.form_factor === 'desktop' ? 'desktop' : 'laptop'
  const co2 = impact.entry(`new_${kind}.production_co2e`)
  const price = impact.entry(`new_${kind}.price`)
  return {
    description: `The owner buys a comparable new ${kind === 'desktop' ? 'desktop computer' : 'laptop'} now`,
    co2e_kg: range(co2),
    cost_eur: range(price),
    impact_refs: [co2.id, price.id],
  }
}

/** Sums a list of impact entries and remembers which ones were used. */
class Tally {
  value: Range = ZERO
  readonly refs: string[] = []
  // A plain field, not a parameter property: Node's type stripping does not support those.
  private readonly impact: ImpactIndex
  constructor(impact: ImpactIndex) {
    this.impact = impact
  }
  add(id: string): this {
    this.value = add(this.value, range(this.impact.entry(id)))
    this.refs.push(id)
    return this
  }
}

/**
 * avoided_vs_baseline for each displacement assumption (see shared/src/assessment.ts):
 * assumed: the whole baseline is credited; conditional: only in the high end (pass it on, only if
 * the recipient would otherwise buy new); none: nothing is credited, so only the path's own emissions count.
 */
export function avoided(baseline: Range, path: Range, displacement: Impact['displacement']): Range {
  const credited = displacement === 'assumed' ? baseline : displacement === 'conditional' ? { low: 0, high: baseline.high } : ZERO
  return { low: credited.low - path.high, high: credited.high - path.low }
}

export interface CalcInput {
  plan: PathPlan
  use: IntendedUse
  scan: DeviceScan
  baseline: Baseline
  impact: ImpactIndex
}

/** Impact for a viable or conditional path. Not-suitable paths have no plan and no impact. */
export function calculateImpact({ plan, use, scan, baseline, impact }: CalcInput): Impact {
  const cost = new Tally(impact)
  const co2 = new Tally(impact)
  const assumptions: Assumption[] = []
  // When the owner plans to pass the device on anyway, a new purchase is only avoided if the
  // recipient would otherwise buy new (FR-009), even after an upgrade or repair.
  const keepsDevice = use !== 'pass_on'
  let displacement: Impact['displacement']

  switch (plan.path) {
    case 'upgrade': {
      const parts: string[] = []
      if (plan.ssd) {
        cost.add(plan.ssd === 'nvme' ? 'part.ssd_500gb.price' : 'part.ssd_sata_500gb.price')
        co2.add('part.ssd_500gb.production_co2e')
        parts.push(`a 500 GB ${plan.ssd === 'nvme' ? 'NVMe M.2' : '2.5-inch SATA'} SSD`)
      }
      if (plan.ram) {
        const id = `part.ram_${plan.ram.module_gb}gb_ddr4`
        cost.add(`${id}.price`)
        co2.add(`${id}.production_co2e`)
        parts.push(`a ${plan.ram.module_gb} GB RAM module`)
        const type = scan.memory.type
        if (type !== null && type !== 'ddr4')
          assumptions.push({ text: `The RAM module is priced as DDR4; this computer uses ${type.toUpperCase()}, which may cost more.`, impact_refs: [`${id}.price`] })
      }
      assumptions.unshift({ text: `Buys ${parts.join(' and ')} at sample retail prices; the owner installs them.`, impact_refs: [...cost.refs, ...co2.refs] })
      displacement = keepsDevice ? 'assumed' : 'conditional'
      break
    }
    case 'repair': {
      cost.add('part.battery_laptop.price')
      co2.add('part.battery_laptop.production_co2e')
      if (plan.battery === 'professional') cost.add('service.battery_replacement.price')
      assumptions.push({
        text:
          plan.battery === 'professional'
            ? 'A repair shop fits a replacement battery; the cost includes labour.'
            : 'The owner fits a replacement battery bought at a sample retail price.',
        impact_refs: [...cost.refs, ...co2.refs],
      })
      displacement = keepsDevice ? 'assumed' : 'conditional'
      break
    }
    case 'pass_on':
      co2.add('pass_on.handover_co2e')
      assumptions.push({
        text: 'Given away privately after a data wipe, so the owner pays nothing; resale value is not counted.',
        impact_refs: ['pass_on.handover_co2e'],
      })
      displacement = 'conditional'
      break
    case 'salvage':
      co2.add('recycle.processing_co2e')
      assumptions.push({
        text: 'Reusable parts are removed and the rest is recycled. Reused parts may spare new ones elsewhere, but this is not credited against the baseline.',
        impact_refs: ['recycle.processing_co2e'],
      })
      displacement = 'none'
      break
    case 'recycle':
      co2.add('recycle.processing_co2e')
      assumptions.push({
        text: 'Recycling recovers materials but does not avoid a new purchase; no recycling credit is counted.',
        impact_refs: ['recycle.processing_co2e'],
      })
      displacement = 'none'
      break
  }

  const life = impact.entry(`life_extra.${plan.path}.${use}`)
  assumptions.push({ text: life.description, impact_refs: [life.id] })
  if (displacement === 'conditional')
    assumptions.push({
      text: 'Avoided new-device production counts only if the recipient would otherwise buy a new device.',
      impact_refs: baseline.impact_refs.slice(0, 1),
    })

  return {
    cost_eur: cost.value,
    useful_life_years: range(life),
    co2e_kg: { path: co2.value, baseline: baseline.co2e_kg, avoided_vs_baseline: avoided(baseline.co2e_kg, co2.value, displacement) },
    displacement,
    assumptions,
  }
}
