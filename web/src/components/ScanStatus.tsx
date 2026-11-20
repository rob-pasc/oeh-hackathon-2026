import { SCAN_STEPS, type ScanStepId } from '../api/types'
import { Spinner } from './ui'

export type ScanProgress =
  | { phase: 'waiting' }
  | { phase: 'running'; step: ScanStepId }
  | { phase: 'done' }
  | { phase: 'failed'; message: string }

export function progressLabel(progress: ScanProgress): string {
  switch (progress.phase) {
    case 'waiting':
      return 'Waiting for the scanner… open the downloaded file and press Start scan.'
    case 'running':
      return SCAN_STEPS.find((s) => s.id === progress.step)?.running ?? 'Scanning…'
    case 'done':
      return 'Scan complete'
    case 'failed':
      return progress.message
  }
}

/** One-line status strip above the skeleton: spinner plus the scanner's latest message. */
export function ScanStatus({ progress }: { progress: ScanProgress }) {
  const stepIndex = progress.phase === 'running' ? SCAN_STEPS.findIndex((s) => s.id === progress.step) : -1
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3.5 rounded-full bg-white px-6 py-3.5 shadow-card">
      <Spinner />
      <span className="text-[15px] font-semibold">{progressLabel(progress)}</span>
      {stepIndex >= 0 ? (
        <span className="ml-auto text-[13px] text-muted">
          Step {stepIndex + 1} of {SCAN_STEPS.length}
        </span>
      ) : null}
    </div>
  )
}
