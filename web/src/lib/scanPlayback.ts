// Playback of the scanner's step events for the scan page (feature 006 FR-041, FR-042).
//
// A real scan takes a few seconds and reports its steps in bursts, so the laptop view would flash. The player
// turns step events into display frames and plays them back at a readable pace: one zone per `zoneMs`, CPU,
// GPU and RAM one after another. It never invents results: every zone state comes from a step the scanner
// reported, and the pacing only delays how soon it is shown. A completion waits for the queued frames, but at
// most `maxHoldMs`; an error is shown at once.
import type { ScanSessionEvent as SharedScanSessionEvent } from '@leaaf/shared/session'
import type { PartKind, ScanStepId } from '../api/types'
import type { ScanProgress } from '../components/ScanStatus'
import { STEP_KINDS } from './parts'

/** How a zone of the laptop view ended: its step was reported `done`, or `skipped` (nothing could be read). */
export type ZoneOutcome = 'found' | 'skipped'

export interface ScanView {
  progress: ScanProgress
  zones: Partial<Record<PartKind, ZoneOutcome>>
}

export interface ScanPlayerOptions {
  /** False when the system asks for reduced motion: every frame is shown at once. */
  paced: boolean
  zoneMs?: number
  maxHoldMs?: number
  onView: (view: ScanView) => void
  onComplete: (deviceId: string) => void
  onError: (message: string) => void
}

export interface ScanPlayer {
  push: (event: SharedScanSessionEvent) => void
  dispose: () => void
}

type Frame =
  | { type: 'progress'; step: ScanStepId }
  | { type: 'zone'; kind: PartKind; outcome: ZoneOutcome }
  | { type: 'complete'; deviceId: string }

/** Steps in the order the scanner runs them (shared/src/session.ts). */
const STEP_ORDER: readonly ScanStepId[] = ['started', 'cpu_memory', 'storage', 'battery', 'upload']

/** The zones a running step is reading and that have no outcome yet; they pulse. */
export function activeZones(view: ScanView): readonly PartKind[] {
  if (view.progress.phase !== 'running') return []
  return STEP_KINDS[view.progress.step].filter((kind) => !view.zones[kind])
}

export function createScanPlayer(options: ScanPlayerOptions): ScanPlayer {
  const { paced, zoneMs = 700, maxHoldMs = 2000, onView, onComplete, onError } = options
  let view: ScanView = { progress: { phase: 'waiting' }, zones: {} }
  const queue: Frame[] = []
  // Steps whose outcome is already queued, so a late or repeated event cannot change a zone twice.
  const resolved = new Set<ScanStepId>()
  let lastPacedAt = Number.NEGATIVE_INFINITY
  let timer: ReturnType<typeof setTimeout> | undefined
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let flushing = !paced
  let finished = false

  function resolve(step: ScanStepId, outcome: ZoneOutcome) {
    if (resolved.has(step)) return
    resolved.add(step)
    for (const kind of STEP_KINDS[step]) queue.push({ type: 'zone', kind, outcome })
  }

  // Scanners that never report `done` (before feature 001 FR-017), and pages that connect late, still light
  // the zones: a step counts as done once a later step starts or the scan completes.
  function finishBefore(step: ScanStepId | null) {
    const end = step === null ? STEP_ORDER.length : STEP_ORDER.indexOf(step)
    for (const earlier of STEP_ORDER.slice(0, end)) resolve(earlier, 'found')
  }

  function apply(frame: Frame) {
    switch (frame.type) {
      case 'progress':
        view = { ...view, progress: { phase: 'running', step: frame.step } }
        break
      case 'zone':
        view = { ...view, zones: { ...view.zones, [frame.kind]: frame.outcome } }
        break
      case 'complete':
        view = { ...view, progress: { phase: 'done' } }
        break
    }
    onView(view)
    if (frame.type === 'complete') {
      finished = true
      clearTimeout(holdTimer)
      onComplete(frame.deviceId)
    }
  }

  function pump() {
    timer = undefined
    while (queue.length > 0 && !finished) {
      const frame = queue[0]!
      // Zones are spaced; so is the completion, so the last zone is seen before the page changes.
      const spaced = frame.type !== 'progress'
      if (spaced && !flushing) {
        const wait = lastPacedAt + zoneMs - Date.now()
        if (wait > 0) {
          timer = setTimeout(pump, wait)
          return
        }
      }
      queue.shift()
      if (spaced) lastPacedAt = Date.now()
      apply(frame)
    }
  }

  function schedule() {
    if (timer === undefined) pump()
  }

  return {
    push(event) {
      if (finished) return
      switch (event.type) {
        case 'step':
          if (event.state === 'running') {
            finishBefore(event.step)
            queue.push({ type: 'progress', step: event.step })
          } else {
            resolve(event.step, event.state === 'done' ? 'found' : 'skipped')
          }
          break
        case 'complete':
          finishBefore(null)
          queue.push({ type: 'complete', deviceId: event.device_id })
          if (!flushing && holdTimer === undefined) {
            holdTimer = setTimeout(() => {
              flushing = true
              clearTimeout(timer)
              pump()
            }, maxHoldMs)
          }
          break
        case 'error':
          finished = true
          queue.length = 0
          clearTimeout(timer)
          clearTimeout(holdTimer)
          onError(event.message)
          return
      }
      schedule()
    },
    dispose() {
      finished = true
      clearTimeout(timer)
      clearTimeout(holdTimer)
    },
  }
}
