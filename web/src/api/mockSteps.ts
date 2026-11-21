// FICTIONAL sample step plans for mock mode (feature 009 FR-013). The laptop's SSD plan is the shared
// fixture, which the server builds from a sample AI answer; its other options have plans written here
// against the sample categories' passages. The desktop's fallback options show the server's template
// steps (shared/fixtures/steps.templates.json), with the notice the server sends with them.
import type { CategoryResult, OptionKind } from '@leaaf/shared/categories'
import type { IntendedUse } from '@leaaf/shared/common'
import type { Step, StepPlan } from '@leaaf/shared/steps'
import laptopSsdJson from '@leaaf/fixtures/steps.example-laptop-14.office.json'
import templatesJson from '@leaaf/fixtures/steps.templates.json'
import { LAPTOP_CATEGORIES } from './mockCategories'

/** The server's notice for a template plan (server/src/steps/templates.ts). */
export const STEPS_UNAVAILABLE = 'AI steps unavailable. These steps are a general template for this kind of option.'

const TEMPLATES = templatesJson as unknown as Record<OptionKind, Step[]>

const step = (s: Partial<Step> & Pick<Step, 'title' | 'detail'>): Step => ({
  tools: [],
  parts: [],
  minutes: null,
  safety: 'none',
  warning: null,
  kind: 'general',
  passage_ids: [],
  ...s,
})

const BACK_UP = step({
  title: 'Back up your files',
  detail: 'Copy your documents, photos and other personal files to an external drive or a cloud storage service.',
  tools: ['External drive or cloud storage'],
  minutes: { low: 30, high: 60 },
})

const ERASE = step({
  title: 'Reset Windows and erase the drives',
  detail: 'Sign out of your accounts, then open Settings, choose Reset this PC and select Remove everything, so no personal files remain.',
  minutes: { low: 30, high: 90 },
  passage_ids: ['reuse-guide#data-wipe'],
})

/** Steps of the laptop's sample options other than the SSD swap, which comes from the shared fixture. */
const LAPTOP_STEPS: Record<string, Step[]> = {
  'clean-install': [
    BACK_UP,
    step({
      title: 'Create Windows installation media',
      detail: 'On another computer, download the Media Creation Tool from Microsoft and write the Windows installer to a USB stick.',
      tools: ['USB stick with at least 8 GB'],
      minutes: { low: 20, high: 40 },
    }),
    step({
      title: 'Install Windows from the USB stick',
      detail: 'Start the laptop from the USB stick, delete the old partitions when asked, and install Windows on the empty drive.',
      minutes: { low: 40, high: 60 },
    }),
  ],
  'ram-add': [
    step({
      title: 'Shut down and remove the battery and the base cover',
      detail: 'Shut the laptop down, unplug the charger, remove the battery, then loosen the screws of the base cover and lift it off.',
      tools: ['Phillips #0 screwdriver', 'Plastic opening tool'],
      minutes: { low: 10, high: 15 },
      safety: 'caution',
      warning: 'Remove the battery before you touch the memory slots, and touch grounded metal first to discharge static electricity.',
      kind: 'technical',
      passage_ids: ['ex14-hmm#battery-1'],
    }),
    step({
      title: 'Insert the memory module into the free slot',
      detail: 'Insert the module at an angle into the free SO-DIMM slot and press it down until both clips lock.',
      parts: ['8 GB DDR4 SO-DIMM'],
      minutes: { low: 5, high: 10 },
      kind: 'technical',
      passage_ids: ['ex14-hmm#memory-1'],
    }),
    step({
      title: 'Reattach the cover and check the memory',
      detail: 'Reattach the base cover and the battery, start Windows and check under Settings, System, About that it shows 8 GB more memory.',
      minutes: { low: 5, high: 10 },
    }),
  ],
  'battery-swap': [
    BACK_UP,
    step({
      title: 'Order a replacement battery pack',
      detail: 'Order the replacement pack with the part number from the maintenance manual, from the manufacturer or a trusted parts shop.',
      parts: ['Replacement battery EX-BAT-57'],
      kind: 'technical',
      passage_ids: ['ex14-hmm#battery-1'],
    }),
    step({
      title: 'Swap the battery',
      detail: 'Shut the laptop down, unplug the charger, remove the two battery screws, lift the old pack out and fit the new one.',
      tools: ['Phillips #0 screwdriver'],
      minutes: { low: 10, high: 15 },
      safety: 'caution',
      warning: 'Never bend, puncture or heat a lithium-ion battery; stop and ask a repair shop if it is swollen.',
      kind: 'technical',
      passage_ids: ['ex14-hmm#battery-1'],
    }),
    step({
      title: 'Bring the old battery to a collection point',
      detail: 'Take the old pack to a battery collection point or back to the shop. Never put it in household waste.',
    }),
  ],
  'gpu-add': [
    step({
      title: 'Use the built-in graphics for office work',
      detail: 'This laptop has no slot for a graphics card. Its built-in graphics are enough for office work, so consider the memory or storage upgrade instead.',
    }),
    step({
      title: 'Ask a service provider about external graphics',
      detail: 'If you need more graphics power, ask a service provider whether an external graphics solution works with this laptop. Have a service provider do this step.',
      safety: 'professional',
      kind: 'technical',
    }),
  ],
  donate: [
    BACK_UP,
    ERASE,
    step({
      title: 'Give it to a refurbishing organisation',
      detail: 'Bring the laptop with its charger to a local organisation that refurbishes computers for people who need one.',
      minutes: { low: 30, high: 60 },
    }),
  ],
  recycle: [
    BACK_UP,
    ERASE,
    step({
      title: 'Bring it to an e-waste collection point',
      detail: 'Take the laptop to a municipal collection point or a retailer that takes old devices back. Never put it in household waste.',
      minutes: { low: 30, high: 60 },
    }),
  ],
}

const generatedAt = '2026-11-21T12:00:00Z'

/** The sample plan of a laptop option, or null when the sample categories have no such option. */
export function laptopPlan(deviceId: string, use: IntendedUse, optionId: string): StepPlan | null {
  const base = { device_id: deviceId, intended_use: use, option_id: optionId }
  if (optionId === 'ssd-swap') return { ...structuredClone(laptopSsdJson as unknown as StepPlan), ...base }
  const steps = LAPTOP_STEPS[optionId]
  if (!steps) return null
  const cited = new Set(steps.flatMap((s) => s.passage_ids))
  return {
    ...base,
    generated_at: generatedAt,
    source: 'llm',
    notice: null,
    steps: structuredClone(steps),
    passages: LAPTOP_CATEGORIES.passages.filter((p) => cited.has(p.passage_id)),
  }
}

/** The template plan of a fallback option, as the server sends it for the five-path fallback (FR-012). */
export function templatePlan(categories: CategoryResult, optionId: string): StepPlan | null {
  const option = categories.categories.flatMap((c) => c.options).find((o) => o.option_id === optionId)
  if (!option) return null
  return {
    device_id: categories.device_id,
    intended_use: categories.intended_use,
    option_id: optionId,
    generated_at: generatedAt,
    source: 'template',
    notice: STEPS_UNAVAILABLE,
    steps: structuredClone(TEMPLATES[option.kind]),
    passages: [],
  }
}

/** Option IDs of the laptop's sample plans, for tests over the mock data (AC-013). */
export const LAPTOP_PLAN_IDS = ['ssd-swap', ...Object.keys(LAPTOP_STEPS)]
