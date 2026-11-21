import type { Assessment } from '@leaaf/shared/assessment'
import type { Mode } from '@leaaf/shared/common'
import type { DeviceScan } from '@leaaf/shared/device'
import type { Report } from '@leaaf/shared/report'
import type { PathOption } from '../api/types'
import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, useApi } from '../api'
import { DEFAULT_USE, type PathTab, type UseTag } from '../lib/labels'
import { buildOptionViews } from '../lib/optionView'
import { useFlip } from '../lib/motion'
import { buildPathViews } from '../lib/pathView'
import { ReportDetails } from './ReportDetails'
import { explainModeChange } from '../lib/modeChange'
import { formatEur, formatYears } from '../lib/impact'
import { Equivalents } from './Equivalents'
import { Gauge } from './Gauge'
import { PathCard } from './PathCard'
import { PathTabView } from './PathTabView'
import { ResultSkeleton } from './ResultSkeleton'
import { Thinking } from './Thinking'
import { SpecsCard } from './SpecsCard'
import { Toolbar } from './Toolbar'
import { ErrorCard } from './ui'

type Load<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'error'; error: ApiClientError }

/** The result screen: toolbar, five path cards (left), CO₂e gauge and scan specs (right). */
export function ResultsView({ deviceId }: { deviceId: string }) {
  const api = useApi()
  const [use, setUse] = useState<UseTag>(DEFAULT_USE)
  const [mode, setMode] = useState<Mode>('environment_first')
  const [change, setChange] = useState<string[]>([])
  const [scan, setScan] = useState<Load<DeviceScan>>({ state: 'loading' })
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [options, setOptions] = useState<PathOption[]>([])
  const [streamError, setStreamError] = useState<ApiClientError | null>(null)
  const [streamEnded, setStreamEnded] = useState(false)
  const [pathTab, setPathTab] = useState<PathTab>('overview')
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [optionSelected, setOptionSelected] = useState<string | null>(null)
  const [optionOpen, setOptionOpen] = useState<string | null>(null)

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
    setOptions([])
    setStreamError(null)
    setStreamEnded(false)
    return api.streamReport(deviceId, use, {
      onAssessment: value => { setAssessment(value); setChange([]) },
      onReport: setReport,
      onOptions: setOptions,
      onEnd: () => setStreamEnded(true),
      onError: setStreamError,
    })
  }, [api, deviceId, use])

  const views = useMemo(() => (assessment ? buildPathViews(assessment, report, mode) : []), [assessment, report, mode])

  // Default selection follows the recommendation until the user picks a card themselves.
  const recommendedId = views.find((v) => v.isRecommended)?.id ?? views[0]?.id ?? null
  // A chosen path tag decides the selected path; in the overview it is the last clicked card.
  const recommendation = views.find(v => v.isRecommended)
  const explanations = new Map(report?.paths.map(p => [p.path, p]))
  const impact = assessment?.paths.find(p => p.path === recommendation?.id)?.impact
  const tabView = pathTab === 'overview' ? null : (views.find((v) => v.id === pathTab) ?? null)
  const selectedView =
    tabView ?? views.find((v) => v.id === selected) ?? views.find((v) => v.id === recommendedId) ?? null
  // Older streams can end after the assessment alone.
  const reportPending = report === null && streamError === null && !streamEnded

  // Options of the selected path tag; the gauge follows the option the user last clicked.
  const optionViews = useMemo(
    () =>
      tabView && assessment
        ? buildOptionViews(
            options.filter((o) => o.path === tabView.id),
            assessment.baseline,
          )
        : [],
    [options, tabView, assessment],
  )
  const selectedOption = optionViews.find((o) => o.key === optionSelected) ?? null
  const gaugeItem = selectedOption ?? selectedView
  const gaugeValue = gaugeItem?.gauge ?? null
  // Path cards slide to their new places when the ranking changes (priority toggle or use tag).
  const registerCard = useFlip(views.map((v) => v.key))
  const gaugeTitle = selectedOption && tabView ? `${tabView.title} · ${selectedOption.title}` : (selectedView?.title ?? '')

  function changePathTab(tab: PathTab) {
    setPathTab(tab)
    setOptionSelected(null)
    setOptionOpen(null)
  }

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
    <div className="results-view flex flex-col gap-6">
      <Toolbar
        use={use}
        mode={mode}
        pathTab={pathTab}
        onUseChange={setUse}
        onModeChange={next => {
          if (next === mode) return
          setChange(assessment ? explainModeChange(assessment, mode, next) : [])
          setMode(next)
        }}
        onPathTabChange={changePathTab}
      />
      {change.length > 0 && <div role="status" className="text-sm text-muted">{change.map(t => <p key={t}>{t}</p>)}</div>}
      {streamError && !assessment ? (
        <ErrorCard title="We could not load your results" message={streamError.message} />
      ) : !assessment || scan.state === 'loading' ? (
        <div className="flex flex-col gap-3.5">
          <Thinking label="Assessing your computer…" className="px-1" />
          <ResultSkeleton />
        </div>
      ) : (
        <div className="fade-up grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] items-start gap-7">
          <div className="relative flex flex-col gap-3.5">
            {!tabView && <p className="px-1 text-sm text-muted" aria-label="Recommendation summary">
              {recommendation && impact ? <>
                <strong className="text-ink">{recommendation.title}</strong> · {formatEur(impact.cost_eur)} · {formatYears(impact.useful_life_years)} · {impact.co2e_kg.avoided_vs_baseline.low}–{impact.co2e_kg.avoided_vs_baseline.high} kg CO₂e avoided.
                {' '}Baseline: {assessment.baseline.description}.
              </> : 'No path is clearly recommended. Each is conditional or unsuitable for this use.'}
            </p>}
            {tabView ? (
              <PathTabView
                key={tabView.id}
                path={tabView}
                options={optionViews}
                pending={reportPending}
                selectedKey={optionSelected}
                openKey={optionOpen}
                onToggle={(key) => {
                  setOptionSelected(key)
                  setOptionOpen((current) => (current === key ? null : key))
                }}
              />
            ) : (
              views.map((view) => (
                <div key={view.key} ref={registerCard(view.key)}>
                <PathCard
                  view={view}
                  selected={selectedView?.id === view.id}
                  open={open === view.id}
                  reportPending={reportPending}
                  onToggle={() => {
                    setSelected(view.id)
                    setOpen((current) => (current === view.id ? null : view.id))
                  }}
                >
                  {report && <ReportDetails explanation={explanations.get(view.id)} passages={report.passages} />}
                </PathCard>
                </div>
              ))
            )}
            {report && report.source === 'template' && report.notice ? (
              <p className="m-0 rounded-[10px] bg-amber-tint px-3 py-2 text-[13px] text-amber-ink">{report.notice}</p>
            ) : null}
          </div>
          <div className="xl:sticky top-6 flex flex-col gap-5">
            <section aria-label="CO₂e gauge" className="rounded-[20px] bg-white p-6 shadow-card">
              <Gauge value={gaugeValue} pathTitle={gaugeTitle} />
              <Equivalents avoided={gaugeItem?.co2?.avoided ?? null} conditional={gaugeItem?.co2?.conditional ?? false} />
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
