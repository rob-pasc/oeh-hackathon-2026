// Template step plans (feature 009 FR-011, FR-012): used when the step call cannot be made or fails,
// and for the five-path fallback categories. One plan per priced option kind plus a generic one for
// `other`, in the same step structure as the AI's plans.
//
// The text is generic, so a template cannot know which passage supports a step. Each step lists the
// words a supporting passage must contain; the first passage retrieved for the option that contains
// one is cited, preferring passages for the device's own model. A technical step that finds none is
// turned into a `professional` step, so no unsourced procedure is ever shown as owner work.
import type { OptionKind, Passage, Step } from '@leaaf/shared'

export const STEPS_UNAVAILABLE = 'AI steps unavailable. These steps are a general template for this kind of option.'

export const PROFESSIONAL_SENTENCE = 'Have a service provider do this step.'

interface TemplateStep extends Omit<Step, 'passage_ids'> {
  /** Lowercase words a supporting passage contains; a step without them never cites. */
  match: readonly string[]
}

const step = (s: Partial<TemplateStep> & Pick<TemplateStep, 'title' | 'detail' | 'kind'>): TemplateStep => ({
  tools: [],
  parts: [],
  minutes: null,
  safety: 'none',
  warning: null,
  match: [],
  ...s,
})

const BACK_UP = step({
  title: 'Back up your files',
  detail: 'Copy your documents, photos and other personal files to an external drive or a cloud storage service before you start.',
  tools: ['External drive or cloud storage'],
  minutes: { low: 30, high: 90 },
  kind: 'general',
  match: ['back up', 'backup', 'file history'],
})

const ERASE = step({
  title: 'Erase your data and reset the system',
  detail:
    'Sign out of your accounts, then reset the operating system and choose to remove everything, so no personal files remain. On Windows, use Reset this PC with Remove everything.',
  minutes: { low: 30, high: 120 },
  kind: 'general',
  match: ['reset this pc', 'remove everything', 'erase'],
})

const OPEN_COVER = step({
  title: 'Shut down and remove the bottom cover',
  detail: 'Shut the computer down, unplug the charger, and follow the service manual to disconnect the battery and remove the bottom cover.',
  tools: ['Precision screwdriver set', 'Plastic opening tool'],
  minutes: { low: 10, high: 20 },
  safety: 'caution',
  warning: 'Disconnect the battery before you touch internal parts, and touch grounded metal first to discharge static electricity.',
  kind: 'technical',
  match: ['base cover', 'bottom cover', 'disconnect the battery', 'built-in battery'],
})

const COLLECTION_POINT = step({
  title: 'Bring it to an e-waste collection point',
  detail: 'Take the computer to a municipal collection point or a retailer that takes old devices back. Never put it or its battery in household waste.',
  minutes: { low: 30, high: 60 },
  kind: 'general',
  match: ['collection point', 'sammelstelle', 'elektroaltger', 'take back', 'rücknahme'],
})

export const TEMPLATE_STEPS: Record<OptionKind, readonly TemplateStep[]> = {
  ssd: [
    BACK_UP,
    step({
      title: 'Check which drive fits',
      detail: 'Look up the drive slot and interface of this model in its service manual, and buy an SSD that matches them.',
      parts: ['SSD that matches the drive slot'],
      minutes: { low: 10, high: 20 },
      kind: 'technical',
      match: ['solid-state drive', 'ssd', 'm.2', 'hard drive'],
    }),
    OPEN_COVER,
    step({
      title: 'Swap the drive',
      detail: 'Remove the old drive as the service manual describes and install the new SSD in its place.',
      tools: ['Precision screwdriver set'],
      minutes: { low: 10, high: 20 },
      kind: 'technical',
      match: ['solid-state drive', 'ssd', 'hard drive', 'm.2'],
    }),
    step({
      title: 'Reinstall the system and restore your files',
      detail: 'Reattach the cover, install the operating system from installation media, and copy your files back.',
      tools: ['USB stick with installation media'],
      minutes: { low: 60, high: 120 },
      kind: 'general',
      match: ['installation media', 'reinstall'],
    }),
  ],
  ram: [
    step({
      title: 'Check which memory fits',
      detail: 'Look up the memory slots, type and maximum of this model in its service manual, and buy a module that matches them.',
      parts: ['Memory module that matches the slot'],
      minutes: { low: 10, high: 20 },
      kind: 'technical',
      match: ['memory', 'so-dimm', 'sodimm', 'ddr'],
    }),
    OPEN_COVER,
    step({
      title: 'Insert the memory module',
      detail: 'Insert the module into the free slot at an angle and press it down until the clips lock, as the service manual shows.',
      minutes: { low: 5, high: 10 },
      kind: 'technical',
      match: ['memory module', 'so-dimm', 'sodimm', 'memory'],
    }),
    step({
      title: 'Reattach the cover and check the memory',
      detail: 'Reattach the bottom cover, start the computer, and check that the system shows the larger amount of memory.',
      minutes: { low: 5, high: 10 },
      kind: 'general',
    }),
  ],
  battery: [
    BACK_UP,
    step({
      title: 'Find a repair offer',
      detail: 'Look for a service provider or repair café near you and ask for a quote first. In Austria, a repair bonus may cover part of the cost.',
      minutes: { low: 15, high: 30 },
      kind: 'general',
      match: ['repair café', 'reparaturcafé', 'repair bonus', 'reparaturbonus', 'geräte-retter'],
    }),
    step({
      title: 'Have the battery replaced',
      detail: `Internal lithium-ion batteries are not owner work unless the manual says so. ${PROFESSIONAL_SENTENCE}`,
      safety: 'professional',
      kind: 'technical',
      match: ['battery'],
    }),
    step({
      title: 'Recycle the old battery',
      detail: 'If you get the old battery back, take it to a battery collection point. Never put it in household waste.',
      kind: 'general',
      match: ['batter', 'akku'],
    }),
  ],
  hand_down: [
    BACK_UP,
    ERASE,
    step({
      title: 'Hand it over',
      detail: 'Give the computer to someone who needs one, or donate it to an organisation that refurbishes computers for reuse.',
      minutes: { low: 30, high: 60 },
      kind: 'general',
      match: ['donat', 'spende', 'reuse', 'refurbish'],
    }),
  ],
  salvage: [
    BACK_UP,
    ERASE,
    OPEN_COVER,
    step({
      title: 'Remove the reusable parts',
      detail: 'Follow the service manual to remove parts such as the memory modules and the drive, and keep them in an antistatic bag.',
      tools: ['Precision screwdriver set', 'Antistatic bag'],
      minutes: { low: 15, high: 30 },
      kind: 'technical',
      match: ['removing the memory', 'memory module', 'solid-state drive'],
    }),
    step({
      title: 'Offer the parts for reuse',
      detail: 'Give the removed parts to a refurbisher, a repair café or someone who can use them.',
      kind: 'general',
      match: ['spare part', 'ersatzteil', 'reuse'],
    }),
    COLLECTION_POINT,
  ],
  recycle: [BACK_UP, ERASE, COLLECTION_POINT],
  other: [
    BACK_UP,
    step({
      title: 'Ask a service provider to confirm and do the work',
      detail: `Ask a service provider whether this option suits the computer and what it involves. ${PROFESSIONAL_SENTENCE}`,
      safety: 'professional',
      kind: 'technical',
    }),
  ],
}

/** Model-specific passages first, so a step cites the device's own manual when it can. */
const modelFirst = (passages: readonly Passage[]) =>
  [...passages].sort((a, b) => Number(b.applicability.kind === 'model') - Number(a.applicability.kind === 'model'))

/** The template plan's steps for a kind, citing the given passages where they match (FR-011). */
export function templateSteps(kind: OptionKind, passages: readonly Passage[]): Step[] {
  const ordered = modelFirst(passages)
  return TEMPLATE_STEPS[kind].map(({ match, ...s }) => {
    const source = match.length
      ? ordered.find((p) => {
          const text = `${p.section ?? ''} ${p.text}`.toLowerCase()
          return match.some((word) => text.includes(word))
        })
      : undefined
    if (source) return { ...s, passage_ids: [source.passage_id] }
    if (s.kind === 'technical' && s.safety !== 'professional')
      return { ...s, safety: 'professional', warning: null, detail: `${s.detail} ${PROFESSIONAL_SENTENCE}`, passage_ids: [] }
    return { ...s, passage_ids: [] }
  })
}
