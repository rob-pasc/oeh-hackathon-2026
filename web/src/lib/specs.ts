// Turns a DeviceScan into the short "Your device" rows. Unknown values stay visibly unknown ("Unknown"),
// never guessed (feature 001 FR-004).
import type { DeviceScan } from '@leaaf/shared/device'

export type Tone = 'good' | 'warn' | 'bad' | 'neutral'

export interface SpecRow {
  label: string
  value: string
  tone: Tone
}

export interface SpecsSummary {
  title: string
  subtitle: string
  rows: SpecRow[]
  /** Battery health 0–100 for the bar, or null when unknown / no battery. */
  batteryPercent: number | null
}

const UNKNOWN = 'Unknown'

const MEDIA: Record<string, string> = { hdd: 'HDD', ssd: 'SSD', scm: 'SCM', unknown: 'Drive' }
const HEALTH_TONE: Record<string, Tone> = { healthy: 'good', warning: 'warn', unhealthy: 'bad', unknown: 'neutral' }
const HEALTH_LABEL: Record<string, string> = {
  healthy: 'healthy',
  warning: 'warning',
  unhealthy: 'unhealthy',
  unknown: 'health unknown',
}

function formatSize(gb: number | null): string {
  if (gb === null) return UNKNOWN
  return gb >= 1000 ? `${Math.round((gb / 1000) * 10) / 10} TB` : `${Math.round(gb)} GB`
}

function batteryTone(percent: number): Tone {
  if (percent >= 80) return 'good'
  if (percent >= 60) return 'warn'
  return 'bad'
}

export function summarizeScan(scan: DeviceScan): SpecsSummary {
  const { identity, cpu, memory, battery, storage, os, tpm, gpus } = scan

  const name = identity.product_version ?? identity.model ?? 'Your computer'
  const subtitle = [identity.manufacturer, os.caption?.replace(/^Microsoft /, '')].filter(Boolean).join(' · ')

  const rows: SpecRow[] = []

  // Battery (laptops only; hidden when the scan says there is no battery).
  let batteryPercent: number | null = null
  if (battery.present !== false) {
    if (battery.health_percent !== null) {
      batteryPercent = Math.min(100, Math.round(battery.health_percent))
      const cycles = battery.cycle_count !== null ? ` · ${battery.cycle_count} cycles` : ''
      rows.push({ label: 'Battery health', value: `${batteryPercent}%${cycles}`, tone: batteryTone(batteryPercent) })
    } else {
      rows.push({ label: 'Battery health', value: UNKNOWN, tone: 'neutral' })
    }
  }

  // Storage
  if (storage === null) {
    rows.push({ label: 'Storage', value: UNKNOWN, tone: 'neutral' })
  } else if (storage.length === 0) {
    rows.push({ label: 'Storage', value: 'No internal drive found', tone: 'warn' })
  } else {
    const RANK: Record<Tone, number> = { neutral: 0, good: 1, warn: 2, bad: 3 }
    const worst = storage.reduce<Tone>((tone, d) => {
      const t = HEALTH_TONE[d.health] ?? 'neutral'
      return RANK[t] > RANK[tone] ? t : tone
    }, 'neutral')
    const value = storage
      .map((d) => `${formatSize(d.capacity_gb)} ${MEDIA[d.media] ?? 'Drive'} · ${HEALTH_LABEL[d.health] ?? d.health}`)
      .join(', ')
    rows.push({ label: 'Storage', value, tone: worst })
  }

  // Memory
  const ramParts = [
    memory.total_gb !== null ? `${memory.total_gb} GB` : null,
    memory.type ? memory.type.toUpperCase() : null,
  ].filter(Boolean)
  const slots =
    memory.slots_total !== null && memory.slots_used !== null ? ` · ${memory.slots_used}/${memory.slots_total} slots used` : ''
  rows.push({ label: 'Memory', value: ramParts.length ? `${ramParts.join(' ')}${slots}` : UNKNOWN, tone: 'neutral' })

  // Processor
  const cores = cpu.cores !== null ? ` · ${cpu.cores} cores` : ''
  rows.push({ label: 'Processor', value: cpu.name ? `${cpu.name}${cores}` : UNKNOWN, tone: 'neutral' })

  // Graphics
  if (gpus !== null && gpus.length > 0) rows.push({ label: 'Graphics', value: gpus.join(', '), tone: 'neutral' })

  // Windows 11 readiness hint: only what the scan can show without claiming a verdict.
  const tpmValue = tpm.present === null ? UNKNOWN : tpm.present ? `TPM ${tpm.spec_version ?? ''}`.trim() : 'No TPM'
  rows.push({ label: 'Security chip', value: tpmValue, tone: tpm.present === false ? 'warn' : 'neutral' })

  return { title: name, subtitle, rows, batteryPercent }
}
