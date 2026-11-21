// Detected hardware parts on the scan screen. The server sends them as proposed `part` events (feature-006
// DESIGN.md); this module keeps the list in arrival order and knows which parts belong to which scan step.
import type { DeviceScan } from '@leaaf/shared/device'
import type { DetectedPart, PartKind, ScanStepId } from '../api/types'

/**
 * Parts the scanner reads during each step, in the order the laptop view lights them (left to right, feature
 * 006 FR-042).
 */
export const STEP_KINDS: Record<ScanStepId, readonly PartKind[]> = {
  started: [],
  cpu_memory: ['cpu', 'gpu', 'memory'],
  storage: ['storage'],
  battery: ['battery'],
  upload: [],
}

/** Adds a part, or replaces the entry with the same `part_id` in place (a finished lookup). */
export function upsertPart(parts: readonly DetectedPart[], part: DetectedPart): DetectedPart[] {
  const index = parts.findIndex((p) => p.part_id === part.part_id)
  if (index === -1) return [...parts, part]
  const next = parts.slice()
  next[index] = part
  return next
}

const MEDIA: Record<string, string> = { hdd: 'HDD', ssd: 'SSD', scm: 'SCM', unknown: 'Drive' }
const BUS: Record<string, string> = { nvme: 'NVMe', sata: 'SATA', other: '', unknown: '' }

function pending(part_id: string, kind: PartKind, label: string, value: string): DetectedPart {
  return { part_id, kind, label, value, lookup: 'pending', detail: null, source: null }
}

/**
 * The parts a scan contains, with the lookup still pending. Used by the mock; a real server builds the same
 * list from the uploaded scan. Parts the scanner could not read are left out rather than guessed.
 */
export function partsFromScan(scan: DeviceScan): DetectedPart[] {
  const parts: DetectedPart[] = []
  const { cpu, memory, gpus, storage, battery } = scan
  if (cpu.name) parts.push(pending('cpu', 'cpu', 'Processor', `${cpu.name}${cpu.cores ? ` · ${cpu.cores} cores` : ''}`))
  if (memory.total_gb !== null) {
    const type = memory.type ? ` ${memory.type.toUpperCase()}` : ''
    const slots =
      memory.slots_total !== null && memory.slots_used !== null ? ` · ${memory.slots_used}/${memory.slots_total} slots` : ''
    parts.push(pending('memory', 'memory', 'Memory', `${memory.total_gb} GB${type}${slots}`))
  }
  for (const [i, name] of (gpus ?? []).entries()) parts.push(pending(`gpu-${i}`, 'gpu', 'Graphics', name))
  for (const [i, drive] of (storage ?? []).entries()) {
    const size = drive.capacity_gb !== null ? `${Math.round(drive.capacity_gb)} GB ` : ''
    const bus = BUS[drive.bus] ? ` · ${BUS[drive.bus]}` : ''
    parts.push(pending(`storage-${i}`, 'storage', 'Storage', `${size}${MEDIA[drive.media] ?? 'Drive'}${bus}`))
  }
  if (battery.present !== false && battery.health_percent !== null) {
    const cycles = battery.cycle_count !== null ? ` · ${battery.cycle_count} cycles` : ''
    parts.push(pending('battery', 'battery', 'Battery', `${Math.round(battery.health_percent)}% health${cycles}`))
  }
  return parts
}
