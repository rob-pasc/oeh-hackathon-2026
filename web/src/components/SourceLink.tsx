import type { SourceRef } from '../lib/pathView'

/** "22 Nov 2026" for an ISO date, read as a calendar day (no time-zone shift). */
export function formatRetrieved(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/**
 * A cited source. Pages found by web search carry a "Web source" label with their site and retrieval date
 * (feature 017 FR-007), so owners can tell them from the curated knowledge base and check them.
 */
export function SourceLink({ source }: { source: SourceRef }) {
  return (
    <a href={source.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-leaf hover:text-leaf-dark">
      {source.web ? (
        <>
          <span className="mr-1.5 rounded-full bg-amber-tint px-2 py-[2px] text-[11px] font-bold text-amber-ink">Web source</span>
          {source.label}
          <span className="text-muted">
            {' '}
            · {source.web.publisher} · retrieved {formatRetrieved(source.web.retrieved)}
          </span>
        </>
      ) : (
        <>Source: {source.label}</>
      )}
    </a>
  )
}
