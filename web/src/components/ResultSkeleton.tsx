import { Sk } from './ui'

/** Placeholder with the same layout as the result screen: five path cards on the left, gauge and specs on the right. */
export function ResultSkeleton() {
  return (
    <div className="grid grid-cols-[1fr_400px] gap-7" aria-hidden="true" data-testid="result-skeleton">
      <div className="flex flex-col gap-3.5">
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
        <div className="flex flex-col items-center gap-3 rounded-[20px] bg-white p-6 shadow-card">
          <Sk className="h-[150px] w-[300px] rounded-t-[150px] rounded-b-none" />
          <Sk className="h-6 w-24" />
        </div>
        <div className="flex flex-col gap-3 rounded-[20px] bg-white p-6 shadow-card">
          <Sk className="h-4 w-1/2" />
          <Sk className="h-3 w-full" />
          <Sk className="h-3 w-full" />
          <Sk className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  )
}

/** Toolbar placeholder, shown while the scan is still running. */
export function ToolbarSkeleton() {
  return (
    <div className="flex items-center justify-between" aria-hidden="true">
      <Sk className="h-11 w-52 rounded-full" />
      <Sk className="h-11 w-72 rounded-full" />
    </div>
  )
}
