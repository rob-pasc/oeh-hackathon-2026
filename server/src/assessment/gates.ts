// Feasibility and safety gates (feature 003 FR-003 to FR-006, T-002).
//
// Pure functions: the same scan, use, model evidence, and facts always give the same statuses.
// Each path gets one status with at least one reason, plus the plan the calculator prices.
// The rules are listed in DESIGN.md (docs/features/feature-003-five-path-ranking/DESIGN.md).
import type { DeviceScan, Fact, IntendedUse, Path, Suitability } from '@leaaf/shared'
import { lookupFacts, reason, type FactLookup, type Reason } from './facts.ts'

/** RAM the intended use needs, in GiB. Development builds and runs containers, so it needs more. */
export const RAM_TARGET_GB: Record<IntendedUse, number> = { office: 8, study: 8, development: 16, pass_on: 8 }

/** Below this share of its design capacity a battery counts as worn (a common replacement threshold). */
export const BATTERY_WORN_PERCENT = 80

export interface UpgradePlan {
  path: 'upgrade'
  /** Drive to install: an NVMe M.2 SSD, a SATA SSD, or none. */
  ssd: 'nvme' | 'sata' | null
  ram: { module_gb: 8 | 16; kind: 'add' | 'replace' } | null
  /** Installed RAM after the plan; null when the current amount is unknown. */
  ram_after_gb: number | null
}
export interface RepairPlan {
  path: 'repair'
  /** professional: the owner must not open the battery themselves (FR-006). */
  battery: 'diy' | 'professional'
}
export type PathPlan = UpgradePlan | RepairPlan | { path: 'pass_on' } | { path: 'salvage' } | { path: 'recycle' }

export interface GateResult {
  path: Path
  status: Suitability
  reasons: Reason[]
  /** null for not_suitable paths, which are neither priced nor scored. */
  plan: PathPlan | null
  /** The owner's needs are not fully met after the plan (for example RAM below the use's target). */
  shortfall: boolean
}

export interface GateInput {
  scan: DeviceScan
  use: IntendedUse
  modelEvidence: 'model_specific' | 'none'
  facts: readonly Fact[]
}

const USE_LABEL: Record<IntendedUse, string> = {
  office: 'office and browsing',
  study: 'school or university',
  development: 'programming',
  pass_on: 'passing it on',
}

/** Caps a status: `conditional` turns viable into conditional, never the other way. */
const atMost = (status: Suitability, cap: Suitability): Suitability =>
  status === 'not_suitable' || cap === 'not_suitable' ? 'not_suitable' : status === 'conditional' ? status : cap

const isLaptopLike = (scan: DeviceScan) => scan.identity.form_factor !== 'desktop'

/** Windows 11 CPU support; false means the owner needs another supported OS to keep using it safely. */
function osSupport(facts: FactLookup) {
  const fact = facts.get('windows11_supported_cpu')
  return { fact, supported: fact?.value ?? null }
}

function osCapForOwnUse(facts: FactLookup, reasons: Reason[]): Suitability {
  const { fact, supported } = osSupport(facts)
  if (supported !== false) return 'viable'
  reasons.push(
    reason(
      'os_unsupported',
      'The CPU is not supported by Windows 11, so this is only worthwhile with another supported system such as a current Linux distribution.',
      [fact],
    ),
  )
  return 'conditional'
}

function gateUpgrade({ scan, use }: GateInput, facts: FactLookup): GateResult {
  const reasons: Reason[] = []
  const target = RAM_TARGET_GB[use]
  let unverified = false
  let blocked = 0

  // --- Storage: replace an HDD or a failing drive with an SSD ---
  const drives = scan.storage
  const failing = drives?.some((d) => d.health === 'warning' || d.health === 'unhealthy') ?? false
  const needSsd = drives === null || drives.length === 0 || failing || drives.some((d) => d.media === 'hdd')
  let ssd: UpgradePlan['ssd'] = null
  if (needSsd) {
    const slotsFact = facts.get('storage_slots')
    const why = drives === null ? 'The drive type could not be read' : failing ? 'A drive reports a health problem' : 'The computer still uses a hard disk'
    if (!slotsFact) {
      unverified = true
      ssd = 'sata' // The conservative (more expensive) choice while the slot type is unknown.
      reasons.push(reason('cannot_verify_storage', `${why}, but we cannot verify which SSD fits this model.`))
    } else {
      const slots = slotsFact.value
      const m2Nvme = slots.some((s) => s.form_factor.startsWith('m2_') && (s.interface === 'nvme' || s.interface === 'nvme_or_sata'))
      const sata = slots.some((s) => s.interface === 'sata' || s.interface === 'nvme_or_sata')
      if (m2Nvme) ssd = 'nvme'
      else if (sata) ssd = 'sata'
      if (ssd) {
        reasons.push(
          reason('ssd_slot_available', `${why}; a ${ssd === 'nvme' ? 'NVMe M.2' : 'SATA'} SSD fits this model.`, [slotsFact]),
        )
      } else {
        blocked++
        reasons.push(reason('no_ssd_slot', `${why}, but this model has no standard slot for a replacement SSD.`, [slotsFact]))
      }
    }
  }

  // --- Memory: reach the use's target ---
  const total = scan.memory.total_gb
  let ram: UpgradePlan['ram'] = null
  let ramAfter = total
  if (total === null || total < target) {
    const soldered = facts.get('ram_soldered')
    const maxGb = facts.get('ram_max_gb')
    const have = total === null ? 'The installed RAM could not be read' : `${total} GB of RAM is installed`
    if (soldered?.value === 'all') {
      blocked++
      reasons.push(reason('ram_soldered', `${have}, and all of it is soldered to the mainboard, so it cannot be upgraded.`, [soldered]))
    } else if (maxGb && maxGb.value < target) {
      blocked++
      reasons.push(reason('ram_max_too_low', `This model supports at most ${maxGb.value} GB of RAM, less than the ${target} GB ${USE_LABEL[use]} needs.`, [maxGb]))
    } else {
      const slotsTotal = facts.get('ram_slots_total')?.value ?? scan.memory.slots_total
      const used = scan.memory.slots_used
      const free = slotsTotal !== null && used !== null ? slotsTotal > used : null
      const missing = total === null ? target : target - total
      if (free === false) {
        // Every slot is taken: replace one module with a 16 GB one.
        const removed = total !== null && used ? total / used : null
        ram = { module_gb: 16, kind: 'replace' }
        ramAfter = total !== null && removed !== null ? total - removed + 16 : null
      } else {
        ram = { module_gb: missing <= 8 ? 8 : 16, kind: 'add' }
        ramAfter = total === null ? null : total + ram.module_gb
      }
      const action = ram.kind === 'add' ? `add a ${ram.module_gb} GB module` : `replace a module with a ${ram.module_gb} GB one`
      if (!soldered) {
        unverified = true
        reasons.push(reason('cannot_verify_memory', `${have}; we cannot verify whether this model's RAM can be upgraded (plan: ${action}).`))
      } else {
        reasons.push(reason('ram_upgradeable', `${have}; the RAM can be upgraded, so ${action}.`, [soldered, maxGb]))
      }
    }
  }

  const shortfall = ramAfter !== null && ramAfter < target
  if (shortfall)
    reasons.push(reason('ram_below_use', `The RAM stays at ${ramAfter} GB, below the ${target} GB ${USE_LABEL[use]} needs.`))

  if (!ssd && !ram) {
    if (blocked > 0) return { path: 'upgrade', status: 'not_suitable', reasons, plan: null, shortfall }
    return {
      path: 'upgrade',
      status: 'not_suitable',
      reasons: [reason('no_upgrade_needed', `It already has an SSD and enough RAM for ${USE_LABEL[use]}, so no upgrade is needed.`)],
      plan: null,
      shortfall: false,
    }
  }
  let status: Suitability = unverified || shortfall ? 'conditional' : 'viable'
  status = atMost(status, osCapForOwnUse(facts, reasons))
  return { path: 'upgrade', status, reasons, plan: { path: 'upgrade', ssd, ram, ram_after_gb: ramAfter }, shortfall }
}

function gateRepair({ scan, use }: GateInput, facts: FactLookup): GateResult {
  const notSuitable = (r: Reason): GateResult => ({ path: 'repair', status: 'not_suitable', reasons: [r], plan: null, shortfall: false })
  const { present, health_percent: health } = scan.battery
  if (present === false || scan.identity.form_factor === 'desktop')
    return notSuitable(reason('no_battery', 'No battery was detected, so there is no battery to repair.'))

  const reasons: Reason[] = []
  let unverified = false
  if (present === null) {
    unverified = true
    reasons.push(reason('cannot_verify_battery', 'We could not read whether a battery is present or how worn it is.'))
  } else if (health === null) {
    unverified = true
    reasons.push(reason('cannot_verify_battery_health', 'The battery\'s wear could not be read, so we cannot tell whether it needs replacing.'))
  } else if (health >= BATTERY_WORN_PERCENT) {
    return notSuitable(reason('battery_healthy', `The battery still holds ${Math.round(health)}% of its design capacity, so no repair is needed.`))
  }

  const part = facts.get('battery_replacement_part_available')
  if (part?.value === false)
    return notSuitable(reason('no_replacement_part', 'No replacement battery is documented as available for this model.', [part]))

  const worn = health !== null && present === true ? `The battery holds ${Math.round(health)}% of its design capacity` : null
  const replaceable = facts.get('battery_user_replaceable')
  let battery: RepairPlan['battery']
  if (replaceable?.value === true) {
    battery = 'diy'
    reasons.push(reason('battery_worn', `${worn ?? 'The battery may be worn'}; it is user-replaceable.`, [replaceable]))
  } else {
    // Safety gate (FR-006): never ask the owner to open a battery that is not user-replaceable,
    // and treat an unknown as not user-replaceable.
    battery = 'professional'
    if (!replaceable) unverified = true
    reasons.push(
      reason(
        'professional_repair',
        `${worn ? `${worn}. ` : ''}${replaceable ? 'The battery is not user-replaceable' : 'We cannot verify that the battery is user-replaceable'}: have a professional repair shop replace it, and do not open or pierce the battery yourself.`,
        [replaceable],
      ),
    )
  }
  if (!part) {
    unverified = true
    reasons.push(reason('cannot_verify_part', 'We cannot verify that a replacement battery is available for this model.'))
  }

  // A battery repair does not add RAM; the use's shortfall lowers the useful-life score but does
  // not change the status, because the repair itself is still sound.
  const total = scan.memory.total_gb
  const target = RAM_TARGET_GB[use]
  const shortfall = total !== null && total < target
  if (shortfall)
    reasons.push(reason('ram_below_use', `The RAM stays at ${total} GB, below the ${target} GB ${USE_LABEL[use]} needs; consider an upgrade as well.`))

  let status: Suitability = unverified || battery === 'professional' ? 'conditional' : 'viable'
  status = atMost(status, osCapForOwnUse(facts, reasons))
  return { path: 'repair', status, reasons, plan: { path: 'repair', battery }, shortfall }
}

function gatePassOn({ scan }: GateInput, facts: FactLookup): GateResult {
  const { fact, supported } = osSupport(facts)
  if (supported === false)
    return {
      path: 'pass_on',
      status: 'not_suitable',
      reasons: [
        reason(
          'os_unsupported',
          'The CPU is not supported by Windows 11, so passing it on unchanged would leave the next owner without security updates.',
          [fact],
        ),
      ],
      plan: null,
      shortfall: false,
    }
  const reasons: Reason[] = []
  let status: Suitability = 'viable'
  if (supported === null) {
    status = 'conditional'
    reasons.push(reason('cannot_verify_os_support', 'We cannot verify that this CPU is supported by a current Windows version.'))
  } else {
    reasons.push(reason('os_supported', 'The CPU is supported by Windows 11, so the next owner keeps getting security updates.', [fact]))
  }
  if (scan.storage?.some((d) => d.health === 'unhealthy')) {
    status = 'conditional'
    reasons.push(reason('drive_failing', 'A drive reports as unhealthy; replace it before passing the computer on.'))
  }
  return { path: 'pass_on', status, reasons, plan: { path: 'pass_on' }, shortfall: false }
}

function gateSalvage({ scan }: GateInput, facts: FactLookup, passOn: GateResult): GateResult {
  const verified: string[] = []
  let unverified = false
  if (scan.storage?.some((d) => d.media === 'ssd' && d.health === 'healthy')) verified.push('the SSD')
  const soldered = facts.get('ram_soldered')
  const hasModules = (scan.memory.slots_used ?? 0) > 0
  if (soldered) {
    if (soldered.value !== 'all' && hasModules) verified.push('the RAM modules')
  } else if (!isLaptopLike(scan) && hasModules) {
    verified.push('the RAM modules') // Desktops use standard socketed DIMMs.
  } else {
    unverified = true
  }

  if (verified.length === 0 && !unverified)
    return {
      path: 'salvage',
      status: 'not_suitable',
      reasons: [reason('no_reusable_parts', 'No standard parts could be identified that another computer could reuse.', [soldered])],
      plan: null,
      shortfall: false,
    }
  const reasons: Reason[] = []
  let status: Suitability = 'viable'
  if (verified.length > 0) {
    const ramReusable = verified.includes('the RAM modules')
    reasons.push(reason('parts_reusable', `${capitalize(joinList(verified))} can serve another computer.`, ramReusable ? [soldered] : []))
  } else {
    status = 'conditional'
    reasons.push(reason('cannot_verify_parts', 'We cannot verify which parts of this model can be removed and reused.'))
  }
  if (passOn.status !== 'not_suitable') {
    status = 'conditional'
    reasons.push(reason('device_functional', 'The computer can still be used whole; salvaging parts only makes sense if no one can use it.'))
  }
  return { path: 'salvage', status, reasons, plan: { path: 'salvage' }, shortfall: false }
}

/**
 * Recycling is always possible, but under the waste hierarchy it comes after reuse: while any path
 * keeps the computer in use, recycling is only conditional, so it is never recommended over them.
 */
function gateRecycle(keepInUse: readonly GateResult[]): GateResult {
  const reasons = [reason('always_available', 'Certified e-waste recycling is always possible after erasing your data.')]
  const usable = keepInUse.some((g) => g.status !== 'not_suitable')
  if (usable) reasons.push(reason('reuse_first', 'The computer can still be used, and reusing it saves far more CO₂e; recycle it only if no one can use it.'))
  return { path: 'recycle', status: usable ? 'conditional' : 'viable', reasons, plan: { path: 'recycle' }, shortfall: false }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const joinList = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

/** All five paths, in the canonical PATHS order. */
export function runGates(input: GateInput): GateResult[] {
  const facts = lookupFacts(input.facts, input.modelEvidence)
  const upgrade = gateUpgrade(input, facts)
  const repair = gateRepair(input, facts)
  const passOn = gatePassOn(input, facts)
  return [upgrade, repair, passOn, gateSalvage(input, facts, passOn), gateRecycle([upgrade, repair, passOn])]
}
