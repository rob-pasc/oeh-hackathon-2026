import type { ReactNode } from 'react'
import { Sk } from './ui'

/**
 * Placeholder with the same layout as the result screen: five cards on the left, gauge and specs on the
 * right. `side` replaces the specs placeholder, e.g. with the live parts list on the scan screen.
 */
export function ResultSkeleton({ side }: { side?: ReactNode } = {}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] items-start gap-7" data-testid="result-skeleton">
      <div className="flex flex-col gap-3.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-[20px] bg-white px-5 py-[18px] shadow-card">
            <Sk className="h-12 w-12 flex-none rounded-[14px]" />
            <div className="flex flex-1 flex-col gap-2.5">
              <Sk className="h-4 w-2/5" />
              <Sk className="h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-5">
        {/* With a live side card (scan screen) that card comes first, so it is visible without scrolling. */}
        {side ?? null}
        <div className="flex flex-col items-center gap-3 rounded-[20px] bg-white p-6 shadow-card" aria-hidden="true">
          <Sk className="h-[150px] w-full max-w-[300px] rounded-t-[150px] rounded-b-none" />
          <Sk className="h-6 w-24" />
        </div>
        {side ? null : (
          <div className="flex flex-col gap-3 rounded-[20px] bg-white p-6 shadow-card" aria-hidden="true">
            <Sk className="h-4 w-1/2" />
            <Sk className="h-3 w-full" />
            <Sk className="h-3 w-full" />
            <Sk className="h-3 w-3/4" />
          </div>
        )}
      </div>
    </div>
  )
}

/** Toolbar placeholder, shown while the scan is still running. */
export function ToolbarSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] items-center gap-7" aria-hidden="true">
      <Sk className="h-12 w-full rounded-full" />
      <Sk className="h-12 w-full rounded-full" />
    </div>
  )
}
