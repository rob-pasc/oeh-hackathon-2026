// Which parts of a scan are looked up, and how (feature 018 FR-001, FR-002). Each part gets a
// normalized identifier, the phrases that find it in the corpus, a web query that contains only the
// identifier and fixed words, and a pattern a web page must match to be about it.
//
// The scan has no model names for drives and batteries, so they are looked up by type ("NVMe SSD",
// "laptop battery"); see the plan's scope change log (2026-11-22).
import type { DeviceScan, PartKind } from '@leaaf/shared'
import { cpuModelNumbers } from '../retrieval/retrieve.ts'

export interface PartQuery {
  part_id: string
  kind: PartKind
  /** Normalized name, shown and cached by: "Intel Core i5-8250U", "DDR4", "NVMe SSD". */
  identifier: string
  /** FTS phrases; a corpus passage naming one of them is about the part. */
  corpusTerms: string[]
  /** Web query: the identifier plus fixed words, nothing else from the scan. */
  webQuery: string
  /** A web page is about the part only if its title or text matches. */
  pattern: RegExp
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Matches `name` as whole words; spaces, hyphens and underscores between words are interchangeable. */
export function wordsPattern(name: string): RegExp {
  const words = name.normalize('NFKC').toLowerCase().split(/[\s\-_]+/).filter(Boolean).map(escape)
  return new RegExp(`(?<![\\p{L}\\p{N}])${words.join('[\\s\\-_]*')}(?![\\p{L}\\p{N}])`, 'iu')
}

/** "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz" -> "Intel Core i5-8250U". */
export function normalizeChipName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/\((r|tm|c)\)|®|™/gi, '')
    .replace(/@\s*[\d.]+\s*[gm]hz/gi, '')
    .replace(/\bwith radeon\b.*$/i, '')
    .replace(/\b(cpu|processor)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const VENDOR = /^(intel|amd|nvidia|apple|qualcomm|ati)\s+/i

/** The name without its vendor word when that still has a digit ("UHD Graphics 620"), else the whole name. */
function distinctive(identifier: string): string {
  const rest = identifier.replace(VENDOR, '')
  return /\d/.test(rest) ? rest : identifier
}

/** Display adapters that are not hardware parts. */
const VIRTUAL_GPU = /basic (display|render)|remote display|virtual|indirect display|parsec|vmware|virtualbox|hyper-v/i

function cpuPart(name: string): PartQuery | null {
  const identifier = normalizeChipName(name)
  if (!/\d/.test(identifier)) return null
  const numbers = cpuModelNumbers(name)
  const key = numbers[0] ?? distinctive(identifier)
  return {
    part_id: 'cpu',
    kind: 'cpu',
    identifier,
    corpusTerms: [...new Set([...numbers, distinctive(identifier)])],
    webQuery: `${identifier} processor specifications`,
    pattern: wordsPattern(key),
  }
}

function gpuPart(name: string, index: number): PartQuery | null {
  const identifier = normalizeChipName(name)
  if (!identifier || VIRTUAL_GPU.test(identifier)) return null
  const key = distinctive(identifier)
  return {
    part_id: `gpu-${index}`,
    kind: 'gpu',
    identifier,
    corpusTerms: [key],
    webQuery: `${identifier} graphics specifications`,
    pattern: wordsPattern(key),
  }
}

/** Drive types, by bus and media; null when neither is known. */
function driveType(drive: NonNullable<DeviceScan['storage']>[number]): { identifier: string; terms: string[]; pattern: RegExp } | null {
  if (drive.bus === 'nvme') return { identifier: 'NVMe SSD', terms: ['nvme'], pattern: /\bnvme\b/i }
  if (drive.media === 'ssd')
    return drive.bus === 'sata'
      ? { identifier: 'SATA SSD', terms: ['sata ssd', 'sata solid-state'], pattern: /\bsata\b/i }
      : { identifier: 'SSD', terms: ['ssd', 'solid-state drive'], pattern: /\b(ssd|solid[- ]state)\b/i }
  if (drive.media === 'hdd') return { identifier: 'Hard disk drive', terms: ['hard drive', 'hard disk', 'hdd'], pattern: /\b(hdd|hard (disk|drive))\b/i }
  return null
}

/** The parts of a scan to look up, in the order of the scan specs. Unknown values are left out, never guessed. */
export function scanParts(scan: DeviceScan): PartQuery[] {
  const parts: PartQuery[] = []
  if (scan.cpu.name) {
    const cpu = cpuPart(scan.cpu.name)
    if (cpu) parts.push(cpu)
  }
  if (scan.memory.type) {
    const identifier = scan.memory.type.toUpperCase()
    parts.push({
      part_id: 'memory',
      kind: 'memory',
      identifier,
      corpusTerms: [scan.memory.type],
      webQuery: `${identifier} laptop memory`,
      pattern: wordsPattern(scan.memory.type),
    })
  }
  const gpus = new Set<string>()
  for (const name of scan.gpus ?? []) {
    const gpu = gpuPart(name, gpus.size)
    if (gpu && !gpus.has(gpu.identifier.toLowerCase())) {
      gpus.add(gpu.identifier.toLowerCase())
      parts.push(gpu)
    }
  }
  // Drives of the same type share one lookup.
  const drives = new Set<string>()
  for (const drive of scan.storage ?? []) {
    const type = driveType(drive)
    if (!type || drives.has(type.identifier)) continue
    parts.push({
      part_id: `storage-${drives.size}`,
      kind: 'storage',
      identifier: type.identifier,
      corpusTerms: type.terms,
      webQuery: `${type.identifier} laptop drive`,
      pattern: type.pattern,
    })
    drives.add(type.identifier)
  }
  if (scan.battery.present === true)
    parts.push({
      part_id: 'battery',
      kind: 'battery',
      identifier: 'Laptop battery',
      corpusTerms: ['battery', 'batteries'],
      webQuery: 'laptop battery lifespan replacement',
      pattern: /\bbatter(y|ies)\b/i,
    })
  return parts
}
