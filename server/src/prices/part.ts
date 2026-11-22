// Which part an SSD, RAM or battery option's web price is searched for (feature 019 FR-001).
//
// The part follows the same plan the impact table prices (categories/options.ts planFor): the
// drive interface and module size come from the device's upgrade gate, the slot and memory type
// from its facts. A part that cannot be named precisely gets no web price rather than a range for
// a different part (plan risk "comparing like for like").
import type { CategoryOption, ModelMatch, WebPrice } from '@leaaf/shared'
import { lookupFacts } from '../assessment/facts.ts'
import { planFor, type OptionContext } from '../categories/options.ts'
import type { DeviceAssessment } from '../assessment/service.ts'
import { distinctiveModel, modelMatcher, queryManufacturer } from '../search/evidence.ts'
import type { SearchHit } from '../search/types.ts'

export type PriceKind = 'ssd' | 'ram' | 'battery'

export interface PricePart {
  kind: PriceKind
  /** Shown as WebPrice.part and sent as the search query: nothing from the scan but the model. */
  label: WebPrice['part']
  /** Extra condition on a search hit; a battery page must name the exact model. */
  accept?: (hit: SearchHit) => boolean
}

/** Capacity the impact table prices an SSD at (data/impact.yaml part.ssd_500gb). */
export const SSD_CAPACITY = '500 GB'

const M2_LENGTH: Record<string, string> = { m2_2230: '2230', m2_2242: '2242', m2_2260: '2260', m2_2280: '2280' }
/** Memory that comes as SO-DIMM modules; LPDDR is soldered and has no module to buy. */
const MODULE_TYPES: Record<string, string> = { ddr3: 'DDR3', ddr4: 'DDR4', ddr5: 'DDR5' }

const isPriceKind = (kind: string): kind is PriceKind => kind === 'ssd' || kind === 'ram' || kind === 'battery'

export function partFor(option: CategoryOption, ctx: OptionContext, input: Pick<DeviceAssessment, 'facts' | 'assessment'>): PricePart | null {
  if (!isPriceKind(option.kind) || option.status === 'not_suitable') return null
  const facts = lookupFacts(input.facts.facts, input.assessment.model_evidence)
  const plan = planFor(option.kind, option.difficulty, ctx)

  switch (option.kind) {
    case 'ssd': {
      if (plan.path !== 'upgrade' || !plan.ssd) return null
      const iface = plan.ssd
      const slot = facts.get('storage_slots')?.value.find((s) => s.interface === iface || s.interface === 'nvme_or_sata')
      if (iface === 'nvme') {
        const length = slot ? M2_LENGTH[slot.form_factor] : undefined
        return { kind: 'ssd', label: `${SSD_CAPACITY} M.2 ${length ? `${length} ` : ''}NVMe SSD` }
      }
      const m2 = slot ? M2_LENGTH[slot.form_factor] : undefined
      return { kind: 'ssd', label: m2 ? `${SSD_CAPACITY} M.2 ${m2} SATA SSD` : `${SSD_CAPACITY} 2.5" SATA SSD` }
    }
    case 'ram': {
      if (plan.path !== 'upgrade' || !plan.ram) return null
      const type = MODULE_TYPES[facts.get('ram_type')?.value ?? ctx.scan.memory.type ?? '']
      return type ? { kind: 'ram', label: `${plan.ram.module_gb} GB ${type} SO-DIMM` } : null
    }
    case 'battery':
      return batteryPart(input.facts.model)
  }
}

function batteryPart(model: ModelMatch): PricePart | null {
  const name = distinctiveModel(model)
  if (!name) return null
  const matches = modelMatcher(name)
  // "Akku": the allowlisted sites are German-language.
  return { kind: 'battery', label: `${queryManufacturer(model.manufacturer)} ${name} Akku`, accept: (hit) => matches(hit.title) || matches(hit.text) }
}

/** Plausible single-part prices, so shipping fees, deposits or bundles are not taken as the part's price. */
export const PRICE_BOUNDS: Record<PriceKind, { min: number; max: number }> = {
  ssd: { min: 15, max: 400 },
  ram: { min: 5, max: 400 },
  battery: { min: 15, max: 400 },
}
