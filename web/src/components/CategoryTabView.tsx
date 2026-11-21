import type { CategoryView } from '../lib/categoryView'
import { PathCard } from './PathCard'
import { PathHeader, SUMMARY_BLOCK } from './PathHeader'

interface Props {
  category: CategoryView
  selectedKey: string | null
  openKey: string | null
  onToggle: (key: string) => void
}

/**
 * Left column for a category tab (feature 008 FR-009): the category's non-clickable header, then one
 * card per option, already ranked Good fit, Depends, Not a fit and by score within each.
 */
export function CategoryTabView({ category, selectedKey, openKey, onToggle }: Props) {
  return (
    <div className="fade-up flex flex-col gap-3.5" data-testid="category-tab-view">
      <section aria-label={`${category.title} summary`} className={SUMMARY_BLOCK}>
        <PathHeader view={category} onTint />
      </section>
      <p className="m-0 px-1 text-[13px] text-muted">Select an option to see why.</p>
      {category.options.map((option) => (
        <PathCard
          key={option.key}
          view={option}
          selected={selectedKey === option.key}
          open={openKey === option.key}
          pending={false}
          onToggle={() => onToggle(option.key)}
        />
      ))}
    </div>
  )
}
