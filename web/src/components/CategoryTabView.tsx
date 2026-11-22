import type { WebPrice } from '@leaaf/shared/prices'
import type { CategoryView } from '../lib/categoryView'
import { offerKindOf, type OfferState } from '../lib/webPrices'
import type { StepState } from '../lib/steps'
import { PathCard } from './PathCard'
import { PathHeader, SUMMARY_BLOCK } from './PathHeader'

interface Props {
  category: CategoryView
  selectedKey: string | null
  openKey: string | null
  onToggle: (key: string) => void
  /** The loaded step plan of an option, by option ID (feature 009). */
  planOf: (optionId: string) => StepState | undefined
  /** Web prices by option ID (feature 019). */
  prices?: Record<string, WebPrice>
  /** The loaded local offers of an option, by option ID (feature 019). */
  offersOf?: (optionId: string) => OfferState | undefined
}

/**
 * Left column for a category tab (feature 008 FR-009): the category's non-clickable header, then one
 * card per option, already ranked Good fit, Depends, Not a fit and by score within each.
 */
export function CategoryTabView({ category, selectedKey, openKey, onToggle, planOf, prices = {}, offersOf }: Props) {
  return (
    <div className="fade-up flex flex-col gap-3.5" data-testid="category-tab-view">
      <section aria-label={`${category.title} summary`} className={SUMMARY_BLOCK}>
        <PathHeader view={category} onTint />
      </section>
      <p className="m-0 px-1 text-[13px] text-muted">Select an option to see why and what to do.</p>
      {category.options.map((option) => (
        <PathCard
          key={option.key}
          view={option}
          selected={selectedKey === option.key}
          open={openKey === option.key}
          pending={false}
          plan={planOf(option.id) ?? { state: 'loading' }}
          webPrice={prices[option.id]}
          offers={offersFor(option.option, offersOf)}
          onToggle={() => onToggle(option.key)}
        />
      ))}
    </div>
  )
}

function offersFor(option: CategoryView['options'][number]['option'], offersOf: Props['offersOf']) {
  const kind = offerKindOf(option)
  return kind && offersOf ? { kind, state: offersOf(option.option_id) } : undefined
}
