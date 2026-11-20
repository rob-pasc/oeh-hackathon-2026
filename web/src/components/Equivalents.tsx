import type { Range } from '@leaaf/shared/common'
import { EQUIVALENTS_SOURCE, equivalents, type Equivalent } from '../lib/equivalents'
import { AnimatedText } from './AnimatedText'

function Icon({ kind }: { kind: Equivalent['kind'] }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
      {kind === 'car' ? (
        <>
          <path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11" />
          <rect x="3" y="11" width="18" height="6" rx="2" />
          <path d="M6 17v2M18 17v2M7 14h1M16 14h1" />
        </>
      ) : (
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      )}
    </svg>
  )
}

/** "That's about as much CO₂e as …": the avoided range turned into car kilometres and flights. */
export function Equivalents({ avoided, conditional }: { avoided: Range | null; conditional: boolean }) {
  const items = avoided ? equivalents(avoided) : null
  if (!items) return null
  return (
    <div className="fade-up mt-5 flex flex-col gap-2.5 border-t border-line pt-4" data-testid="equivalents">
      <span className="text-xs font-bold tracking-wider text-leaf uppercase">That’s about as much CO₂e as</span>
      {items.map((item) => (
        <div key={item.kind} className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-leaf-tint text-leaf">
            <Icon kind={item.kind} />
          </span>
          <span className="text-[15px]">
            <strong className="font-bold">
              <AnimatedText text={item.amount} />
            </strong>{' '}
            <span className="text-muted">{item.label}</span>
          </span>
        </div>
      ))}
      <span className="text-xs leading-snug text-muted">
        {conditional ? 'Only if the receiver would otherwise buy new. ' : ''}Per person, average values from{' '}
        <a href={EQUIVALENTS_SOURCE.url} target="_blank" rel="noreferrer" className="font-medium text-leaf hover:text-leaf-dark">
          {EQUIVALENTS_SOURCE.label}
        </a>
        .
      </span>
    </div>
  )
}
