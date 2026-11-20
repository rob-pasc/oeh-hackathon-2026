import type { CardView } from '../lib/pathView'
import { PathCard } from './PathCard'
import { PathHeader } from './PathHeader'
import { StepsView } from './StepsView'
import { Sk } from './ui'

interface Props {
  /** The path the tag stands for; shown as the first block. */
  path: CardView
  /** The path's individual actions, for example the SSD and the RAM upgrade. Empty until the server sends them. */
  options: CardView[]
  /** True while the report (and with it the options) has not arrived yet. */
  pending: boolean
  selectedKey: string | null
  openKey: string | null
  onToggle: (key: string) => void
}

/** Left column for a selected path tag: the path on top, then its options as expandable cards. */
export function PathTabView({ path, options, pending, selectedKey, openKey, onToggle }: Props) {
  if (options.length === 0 && !pending) {
    // The server sent no options for this path: show the path's own steps instead.
    return <StepsView view={path} reportPending={false} />
  }
  return (
    <div className="flex flex-col gap-3.5" data-testid="path-tab-view">
      <section aria-label={`${path.title} summary`} className="flex items-center gap-4 rounded-[20px] border-2 border-transparent bg-white px-5 py-[18px] shadow-card">
        <PathHeader view={path} />
      </section>

      {options.length > 0 ? (
        options.map((option) => (
          <PathCard
            key={option.key}
            view={option}
            selected={selectedKey === option.key}
            open={openKey === option.key}
            reportPending={false}
            onToggle={() => onToggle(option.key)}
          />
        ))
      ) : (
        <div aria-hidden="true" className="flex flex-col gap-3.5" data-testid="options-skeleton">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-[20px] bg-white px-5 py-[18px] shadow-card">
              <Sk className="h-12 w-12 flex-none rounded-[14px]" />
              <div className="flex flex-1 flex-col gap-2.5">
                <Sk className="h-4 w-2/5" />
                <Sk className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
