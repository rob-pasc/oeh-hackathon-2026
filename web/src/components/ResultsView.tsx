import type { Assessment } from '@leaaf/shared/assessment'
import type { Mode } from '@leaaf/shared/common'
import type { DeviceScan } from '@leaaf/shared/device'
import type { Report } from '@leaaf/shared/report'
import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, useApi } from '../api'
import { DEFAULT_USE, type UseTag } from '../lib/labels'
import { buildPathViews } from '../lib/pathView'
import { Gauge } from './Gauge'
import { PathCard } from './PathCard'
import { ResultSkeleton } from './ResultSkeleton'
import { SpecsCard } from './SpecsCard'
import { Toolbar } from './Toolbar'
import { ErrorCard } from './ui'

type Load<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'error'; error: ApiClientError }

/** The result screen: toolbar, five path cards (left), CO₂e gauge and scan specs (right). */
export function ResultsView({ deviceId }: { deviceId: string }) {
  const api = useApi()
  const [use, setUse] = useState<UseTag>(DEFAULT_USE)
  const [mode, setMode] = useState<Mode>('environment_first')
  const [scan, setScan] = useState<Load<DeviceScan>>({ state: 'loading' })
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [streamError, setStreamError] = useState<ApiClientError | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  // Scan data: loaded once per device.
  useEffect(() => {
    let cancelled = false
    api
      .getDevice(deviceId)
      .then((record) => {
        if (!cancelled) setScan({ state: 'ready', value: record.scan })
      })
      .catch((error: unknown) => {
        if (!cancelled) setScan({ state: 'error', error: toClientError(error) })
      })
    return () => {
      cancelled = true
    }
  }, [api, deviceId])

  // Assessment then report: restarted whenever the use tag changes. The previous ranking stays on screen
  // until the new assessment arrives, so switching tags does not flash the skeleton.
  useEffect(() => {
    setReport(null)
    setStreamError(null)
    return api.streamReport(deviceId, use, {
      onAssessment: setAssessment,
      onReport: setReport,
      onEnd: () => {},
      onError: setStreamError,
    })
  }, [api, deviceId, use])

  const views = useMemo(() => (assessment ? buildPathViews(assessment, report, mode) : []), [assessment, report, mode])

  // Default selection follows the recommendation until the user picks a card themselves.
  const recommendedId = views.find((v) => v.isRecommended)?.id ?? views[0]?.id ?? null
  const selectedView = views.find((v) => v.id === selected) ?? views.find((v) => v.id === recommendedId) ?? null

  if (scan.state === 'error') {
    return (
      <ErrorCard
        title={scan.error.code === 'not_found' ? 'We could not find this scan' : 'Something went wrong'}
        message={
          scan.error.code === 'not_found'
            ? 'The link may be wrong or the result may have expired. Start a new scan from the home page.'
            : scan.error.message
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Toolbar use={use} mode={mode} onUseChange={setUse} onModeChange={setMode} />
      {streamError && !assessment ? (
        <ErrorCard title="We could not load your results" message={streamError.message} />
      ) : !assessment || scan.state === 'loading' ? (
        <ResultSkeleton />
      ) : (
        <div className="grid grid-cols-[1fr_400px] items-start gap-7">
          <div className="flex flex-col gap-3.5">
            {views.map((view) => (
              <PathCard
                key={view.id}
                view={view}
                selected={selectedView?.id === view.id}
                open={open === view.id}
                reportPending={report === null && streamError === null}
                onToggle={() => {
                  setSelected(view.id)
                  setOpen((current) => (current === view.id ? null : view.id))
                }}
              />
            ))}
            {report && report.source === 'template' && report.notice ? (
              <p className="m-0 rounded-[10px] bg-amber-tint px-3 py-2 text-[13px] text-amber-ink">{report.notice}</p>
            ) : null}
          </div>
          <div className="sticky top-6 flex flex-col gap-5">
            <section aria-label="CO₂e gauge" className="rounded-[20px] bg-white p-6 shadow-card">
              <Gauge value={selectedView?.gauge ?? null} pathTitle={selectedView?.title ?? ''} />
            </section>
            <SpecsCard scan={scan.value} />
          </div>
        </div>
      )}
    </div>
  )
}

function toClientError(error: unknown): ApiClientError {
  return error instanceof ApiClientError ? error : new ApiClientError('internal', 'Something went wrong.')
}
