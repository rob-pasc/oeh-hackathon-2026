// FICTIONAL lookup results for the mock scan screen. They show how parts look once the server has matched them
// against the team's parts list or found them with an AI search. Not real data; the real lookups are the
// backend team's (feature-006 DESIGN.md, "Proposed part event").
import type { PartLookupResult } from '@leaaf/shared/parts'
import partsFixture from '@leaaf/fixtures/parts.example-laptop-14.json'
import type { DetectedPart } from './types'

export const MOCK_LOOKUPS: Record<string, Pick<DetectedPart, 'lookup' | 'detail' | 'source'>> = {
  cpu: { lookup: 'catalog', detail: 'Soldered to the board. Cannot be replaced.', source: null },
  memory: { lookup: 'catalog', detail: 'One free slot. Takes up to 32 GB DDR4.', source: null },
  'gpu-0': { lookup: 'ai', detail: 'Built into the processor. No separate graphics card.', source: null },
  'storage-0': { lookup: 'catalog', detail: 'Has a free M.2 NVMe slot for an SSD.', source: null },
  battery: { lookup: 'ai', detail: 'Replacement pack EX-BAT-57 is still sold.', source: null },
}

/**
 * FICTIONAL part lookups for the result screen's scan specs (feature 018): the shared fixture plus the sample
 * laptop's drive and battery, so mock mode shows every badge. Not real data.
 */
export function laptopPartLookups(deviceId: string): PartLookupResult {
  const result = structuredClone(partsFixture as unknown as PartLookupResult)
  result.device_id = deviceId
  const cpuSource = result.parts.find((p) => p.part_id === 'cpu')!.source!
  result.parts.push(
    {
      part_id: 'storage-0',
      kind: 'storage',
      identifier: 'Hard disk drive',
      status: 'knowledge_base',
      sentence: 'A spinning hard drive; swapping it for an SSD is the usual way to speed up an older laptop.',
      source: { ...cpuSource, passage_id: 'example-upgrade-guide:0001', document_id: 'example-upgrade-guide', title: 'Example upgrade guide', url: 'https://example.org/upgrade-guide', section: 'Storage', text: 'Replacing a hard drive with an SSD is the most effective upgrade.' },
    },
    {
      part_id: 'battery',
      kind: 'battery',
      identifier: 'Laptop battery',
      status: 'web',
      sentence: 'Laptop batteries lose capacity with every charge cycle and are usually replaced after a few years.',
      source: { ...result.parts.find((p) => p.part_id === 'memory')!.source!, passage_id: 'web:0000000000000001:part-battery', document_id: 'web:0000000000000001', title: 'Laptop battery care', url: 'https://example.com/laptop-battery-care', section: 'Laptop battery care', text: 'Laptop batteries lose capacity with every charge cycle.' },
    },
  )
  return result
}
