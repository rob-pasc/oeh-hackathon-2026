import { PATHS, type IntendedUse, type Mode, type Path, type Suitability } from '@leaaf/shared/common'

/**
 * The "what do you use this computer for?" tags offered in the dropdown. `office`, `study`, `development`, and
 * `pass_on` are the contract's `IntendedUse` values. `gaming` and `general` are requested by the team and still
 * have to be added to shared/src/common.ts by the backend team (see docs/features/feature-006-web-app/PLAN.md,
 * FR-009 and FR-021).
 */
export type UseTag = IntendedUse | 'gaming' | 'general'

export const USE_TAGS: readonly UseTag[] = ['general', 'office', 'study', 'development', 'pass_on', 'gaming']

export const DEFAULT_USE: UseTag = 'general'

export const USE_LABELS: Record<UseTag, string> = {
  general: 'General',
  office: 'Office',
  study: 'Study',
  development: 'Development',
  pass_on: 'Give to a friend',
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
  viable: 'Viable',
  conditional: 'Conditional',
  not_suitable: 'Not suitable',
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
