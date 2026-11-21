import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScanSessionEvent } from '@leaaf/shared/session'
import type { PartKind, ScanStepId } from '../api/types'
import { activeZones, createScanPlayer, type ScanView } from '../lib/scanPlayback'

const DEVICE = 'q3Xk9vT2mB7pLw0cZr1sEa'
const step = (s: ScanStepId, state: 'running' | 'done' | 'skipped' = 'running'): ScanSessionEvent => ({ type: 'step', step: s, state })

/** The events of a whole scan by a scanner with feature 001 FR-017, as they arrive in one burst. */
const WHOLE_SCAN: ScanSessionEvent[] = [
  step('started'),
  step('cpu_memory'),
  step('cpu_memory', 'done'),
  step('storage'),
  step('storage', 'done'),
  step('battery'),
  step('battery', 'done'),
  step('upload'),
]

function record(paced: boolean) {
  const views: { at: number; view: ScanView }[] = []
  const zoneChanges: { at: number; kind: PartKind }[] = []
  const completed: number[] = []
  const errors: string[] = []
  const start = Date.now()
  let previous: ScanView['zones'] = {}
  const player = createScanPlayer({
    paced,
    onView: (view) => {
      const at = Date.now() - start
      views.push({ at, view })
      for (const kind of Object.keys(view.zones) as PartKind[]) {
        if (view.zones[kind] !== previous[kind]) zoneChanges.push({ at, kind })
      }
      previous = view.zones
    },
    onComplete: () => completed.push(Date.now() - start),
    onError: (message) => errors.push(message),
  })
  const latest = () => views.at(-1)?.view
  return { player, views, zoneChanges, completed, errors, latest }
}

describe('scan playback', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // AC-045
  it('plays the zones one at a time, 700 ms apart, CPU, GPU, RAM, drive, battery, with the status following', () => {
    const r = record(true)
    WHOLE_SCAN.forEach((e) => r.player.push(e))

    expect(r.latest()?.progress).toEqual({ phase: 'running', step: 'cpu_memory' })
    vi.advanceTimersByTime(1000)
    expect(r.latest()?.progress).toEqual({ phase: 'running', step: 'cpu_memory' })
    vi.advanceTimersByTime(10_000)

    expect(r.zoneChanges.map((c) => c.kind)).toEqual(['cpu', 'gpu', 'memory', 'storage', 'battery'])
    const gaps = r.zoneChanges.slice(1).map((c, i) => c.at - r.zoneChanges[i]!.at)
    expect(gaps.every((gap) => gap >= 700)).toBe(true)
    // The status moves to storage only after RAM has lit up, and ends on the upload step.
    const storageAt = r.views.find((v) => v.view.progress.phase === 'running' && v.view.progress.step === 'storage')!.at
    expect(storageAt).toBe(r.zoneChanges[2]!.at)
    expect(r.latest()?.progress).toEqual({ phase: 'running', step: 'upload' })
  })

  // AC-046
  it('shows the result at most 2 s after the completion arrived, with every zone filled in', () => {
    const r = record(true)
    WHOLE_SCAN.forEach((e) => r.player.push(e))
    r.player.push({ type: 'complete', device_id: DEVICE })

    vi.advanceTimersByTime(1999)
    expect(r.completed).toEqual([])
    vi.advanceTimersByTime(1)
    expect(r.completed).toEqual([2000])
    expect(r.latest()?.zones).toEqual({ cpu: 'found', gpu: 'found', memory: 'found', storage: 'found', battery: 'found' })
    expect(r.latest()?.progress).toEqual({ phase: 'done' })
  })

  it('waits one step after the last zone before the result when the playback finishes in time', () => {
    const r = record(true)
    WHOLE_SCAN.forEach((e) => r.player.push(e))
    vi.advanceTimersByTime(3000) // the battery, the last zone, lights up at 2800 ms
    r.player.push({ type: 'complete', device_id: DEVICE })
    vi.advanceTimersByTime(499)
    expect(r.completed).toEqual([])
    vi.advanceTimersByTime(1)
    expect(r.completed).toEqual([3500])
  })

  // AC-046
  it('shows an error at once and plays nothing after it', () => {
    const r = record(true)
    WHOLE_SCAN.forEach((e) => r.player.push(e))
    const shown = r.views.length
    r.player.push({ type: 'error', code: 'upload_failed', message: 'The scanner could not upload its results.' })
    expect(r.errors).toEqual(['The scanner could not upload its results.'])
    vi.advanceTimersByTime(10_000)
    expect(r.views.length).toBe(shown)
    expect(r.completed).toEqual([])
  })

  // AC-047
  it('paces nothing when the system asks for reduced motion', () => {
    const r = record(false)
    WHOLE_SCAN.forEach((e) => r.player.push(e))
    r.player.push({ type: 'complete', device_id: DEVICE })
    expect(r.zoneChanges.map((c) => c.kind)).toEqual(['cpu', 'gpu', 'memory', 'storage', 'battery'])
    expect(r.zoneChanges.every((c) => c.at === 0)).toBe(true)
    expect(r.completed).toEqual([0])
  })

  // AC-044
  it('treats a step as done when the next one starts, for scanners that report only running', () => {
    const r = record(false)
    r.player.push(step('started'))
    r.player.push(step('cpu_memory'))
    expect(r.latest()?.zones).toEqual({})
    expect(activeZones(r.latest()!)).toEqual(['cpu', 'gpu', 'memory'])
    r.player.push(step('storage'))
    expect(r.latest()?.zones).toEqual({ cpu: 'found', gpu: 'found', memory: 'found' })
    expect(activeZones(r.latest()!)).toEqual(['storage'])
    r.player.push({ type: 'complete', device_id: DEVICE })
    expect(r.latest()?.zones).toMatchObject({ storage: 'found', battery: 'found' })
  })

  // AC-044
  it('marks the zones of a skipped step and keeps the first outcome of a step', () => {
    const r = record(false)
    r.player.push(step('battery'))
    r.player.push(step('battery', 'skipped'))
    r.player.push(step('battery', 'done'))
    r.player.push({ type: 'complete', device_id: DEVICE })
    expect(r.latest()?.zones.battery).toBe('skipped')
  })
})
