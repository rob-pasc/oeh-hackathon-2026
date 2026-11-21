import { PATHS, type IntendedUse, type Mode, type Path, type Suitability } from '@leaaf/shared/common'

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

/** What the left column shows: all five paths at once, or the single steps of one path. */
export type PathTab = 'overview' | Path

/** Order of the path tags in the toolbar: the overview first, then the five paths in contract order. */
export const PATH_TABS: readonly PathTab[] = ['overview', ...PATHS]

export const PATH_TAB_LABELS: Record<PathTab, string> = {
  overview: 'Overview',
  upgrade: 'Upgrade',
  repair: 'Repair',
  pass_on: 'Pass on',
  salvage: 'Salvage',
  recycle: 'Recycle',
}
