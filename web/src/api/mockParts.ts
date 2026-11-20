// FICTIONAL lookup results for the mock scan screen. They show how parts look once the server has matched them
// against the team's parts list or found them with an AI search. Not real data; the real lookups are the
// backend team's (feature-006 DESIGN.md, "Proposed part event").
import type { DetectedPart } from './types'

export const MOCK_LOOKUPS: Record<string, Pick<DetectedPart, 'lookup' | 'detail' | 'source'>> = {
  cpu: { lookup: 'catalog', detail: 'Soldered to the board. Cannot be replaced.', source: null },
  memory: { lookup: 'catalog', detail: 'One free slot. Takes up to 32 GB DDR4.', source: null },
  'gpu-0': { lookup: 'ai', detail: 'Built into the processor. No separate graphics card.', source: null },
  'storage-0': { lookup: 'catalog', detail: 'Has a free M.2 NVMe slot for an SSD.', source: null },
  battery: { lookup: 'ai', detail: 'Replacement pack EX-BAT-57 is still sold.', source: null },
}
