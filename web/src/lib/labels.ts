import type { OptionKind } from '@leaaf/shared/categories'
import type { IntendedUse, Mode, Path, Suitability } from '@leaaf/shared/common'

/**
 * The "what do you use this computer for?" tags offered in the dropdown: exactly the contract's `IntendedUse`
 * values (shared/src/common.ts; `general` and `gaming` since feature 003 FR-015), in the dropdown's order.
 */
export type UseTag = IntendedUse

export const USE_TAGS: readonly UseTag[] = ['general', 'office', 'study', 'development', 'pass_on', 'gaming']

export const DEFAULT_USE: UseTag = 'general'

export const USE_LABELS: Record<UseTag, string> = {
  general: 'General',
  office: 'Office',
  study: 'Study',
  development: 'Development',
  pass_on: 'Hand down',
  gaming: 'Gaming',
}

export const PATH_TITLES: Record<Path, string> = {
  upgrade: 'Upgrade',
  repair: 'Repair',
  pass_on: 'Pass it on',
  salvage: 'Salvage for parts',
  recycle: 'Recycle',
}

export const STATUS_LABELS: Record<Suitability, string> = {
  viable: 'Good fit',
  conditional: 'Depends',
  not_suitable: 'Not a fit',
}

export const MODE_LABELS: Record<Mode, string> = {
  environment_first: 'Environment first',
  money_first: 'Money first',
}

export const MODE_ORDER: readonly Mode[] = ['environment_first', 'money_first']

export function isUseTag(value: string): value is UseTag {
  return (USE_TAGS as readonly string[]).includes(value)
}

/** What the left column shows: the ranked categories, or one category's options (feature 008 FR-009). */
export type ResultTab = 'overview' | string

/** Icon of an option kind (feature 008); `other` has its own icon. */
export type IconKind = Path | 'other'

export const KIND_ICONS: Record<OptionKind, IconKind> = {
  ssd: 'upgrade',
  ram: 'upgrade',
  battery: 'repair',
  hand_down: 'pass_on',
  salvage: 'salvage',
  recycle: 'recycle',
  other: 'other',
}
