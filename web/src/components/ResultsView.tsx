import type { Assessment } from '@leaaf/shared/assessment'
import type { CategoryResult } from '@leaaf/shared/categories'
import type { Mode } from '@leaaf/shared/common'
import type { DeviceScan } from '@leaaf/shared/device'
import type { PartLookup } from '@leaaf/shared/parts'
import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, useApi } from '../api'
import { buildCategoryViews, type OptionView } from '../lib/categoryView'
import { DEFAULT_USE, type ResultTab, type UseTag } from '../lib/labels'
import { useFlip } from '../lib/motion'
import { useStepPlans } from '../lib/useStepPlans'
import { WEB_SEARCH_PHRASE } from '../lib/thinking'
import { buildPathViews, type CardView } from '../lib/pathView'
import { buildPlanView, PLAN_TITLE } from '../lib/planView'
import { explainCategoryModeChange, explainModeChange } from '../lib/modeChange'
import { CategoryTabView } from './CategoryTabView'
import { PlanCard } from './PlanCard'
import { Equivalents } from './Equivalents'
import { Gauge } from './Gauge'
import { PathCard } from './PathCard'
import { CardSkeletons, GaugeSkeleton, ResultSkeleton } from './ResultSkeleton'
import { Thinking } from './Thinking'
import { SpecsCard } from './SpecsCard'
import { Toolbar, type TabItem } from './Toolbar'
import { ErrorCard } from './ui'

type Load<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'error'; error: ApiClientError }

/**
 * The result screen: toolbar, ranked categories or one category's options (left), CO₂e gauge and scan
 * specs (right). While the categories are still being worked out, cards and gauge are placeholders; the five
 * assessed paths only appear when no categories can be had (feature 008 FR-013, feature 006 FR-054).
 */
export function ResultsView({ deviceId }: { deviceId: string }) {
  const api = useApi()
  const [use, setUse] = useState<UseTag>(DEFAULT_USE)
  const [mode, setMode] = useState<Mode>('environment_first')
  const [change, setChange] = useState<string[]>([])
  const [scan, setScan] = useState<Load<DeviceScan>>({ state: 'loading' })
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [categories, setCategories] = useState<CategoryResult | null>(null)
  const [streamError, setStreamError] = useState<ApiClientError | null>(null)
  const [streamEnded, setStreamEnded] = useState(false)
  /** The server is searching the web for this model before assessing it (feature 017 FR-013). */
  const [searching, setSearching] = useState(false)
  const [tab, setTab] = useState<ResultTab>('overview')
  /** Key of the option last opened in each category tab; the gauge follows it (feature 011 FR-001, FR-002). */
  const [openedInTab, setOpenedInTab] = useState<Record<string, string>>({})
  const [openOption, setOpenOption] = useState<string | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const plans = useStepPlans(deviceId, use)
  /** Part lookups for the scan specs (feature 018): null while loading; they never hold up the rest. */
  const [parts, setParts] = useState<readonly PartLookup[] | null>(null)

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

  // Part lookups: once per device, independent of the report stream (feature 018 FR-005). A failed request
  // leaves the specs as they were before the lookup existed.
  useEffect(() => {
    let cancelled = false
    setParts(null)
    api
      .getParts(deviceId)
      .then((result) => {
        if (!cancelled) setParts(result.parts)
      })
      .catch(() => {
        if (!cancelled) setParts([])
      })
    return () => {
      cancelled = true
    }
  }, [api, deviceId])

  // Assessment then categories: restarted whenever the use tag changes. The previous ranking stays on
  // screen until the new assessment arrives, so switching tags does not flash the skeleton.
  useEffect(() => {
    setCategories(null)
    setStreamError(null)
    setStreamEnded(false)
    setSearching(false)
    // A new use has its own plan and step list, so the plan card starts closed again (feature 014).
    setPlanOpen(false)
    return api.streamReport(deviceId, use, {
      onStatus: () => setSearching(true),
      onAssessment: value => { setSearching(false); setAssessment(value); setChange([]) },
      onCategories: value => { setCategories(value); setChange([]) },
      onEnd: () => setStreamEnded(true),
      onError: setStreamError,
    })
  }, [api, deviceId, use])

  const categoryViews = useMemo(
    () => (categories && assessment ? buildCategoryViews(categories, assessment, mode) : []),
    [categories, assessment, mode],
  )
  const pathViews = useMemo(() => (assessment && !categories ? buildPathViews(assessment, mode) : []), [assessment, categories, mode])
  const planView = useMemo(() => (categories && assessment ? buildPlanView(categories, assessment.baseline) : null), [categories, assessment])
  const categoriesPending = categories === null && streamError === null && !streamEnded

  // A category tab that no longer exists (new use, new categories) falls back to the Overview.
  const activeCategory = tab === 'overview' ? null : (categoryViews.find(c => c.id === tab) ?? null)
  const activeTab: ResultTab = activeCategory ? activeCategory.id : 'overview'
  const tabs: TabItem[] = [{ id: 'overview', label: 'Overview' }, ...categoryViews.map(c => ({ id: c.id, label: c.title }))]

  const allOptions = categoryViews.flatMap(c => c.options)
  // The gauge follows the selected tab (feature 011, replacing 008 FR-011): in a category tab the option last
  // opened there, else the category's best option. On the Overview, whose cards only switch tabs, it shows the
  // plan when there is one (feature 013 FR-008), else the best option of the first category.
  const selectedOption = activeCategory ? (openedInTab[activeCategory.id] ?? null) : null
  const tabOption = activeCategory ? (activeCategory.options.find(o => o.key === selectedOption) ?? activeCategory.best) : null
  const overviewPlan = activeCategory ? null : planView
  const gaugeOption: OptionView | null = tabOption ?? (overviewPlan ? null : (categoryViews[0]?.best ?? null))
  const gaugeCategory = gaugeOption ? categoryViews.find(c => c.options.includes(gaugeOption)) : undefined
  const gaugeItem: CardView | null = overviewPlan ?? gaugeOption ?? pathViews.find(v => v.isRecommended) ?? pathViews[0] ?? null
  // "Category · option", or just the name when a fallback category and its only option share it.
  const gaugeTitle = overviewPlan
    ? PLAN_TITLE
    : gaugeOption && gaugeCategory
      ? gaugeOption.title !== gaugeCategory.title ? `${gaugeCategory.title} · ${gaugeOption.title}` : gaugeOption.title
      : (gaugeItem?.title ?? '')

  // Cards slide to their new places when the ranking changes (priority toggle or use tag).
  const registerCard = useFlip((categories ? categoryViews : pathViews).map(v => v.key))

  function changeTab(next: ResultTab) {
    setTab(next)
    setOpenOption(null)
  }

  function toggleOption(key: string) {
    setOpenedInTab(current => ({ ...current, [activeTab]: key }))
    setOpenOption(current => (current === key ? null : key))
    // Opening an option for the first time requests its step plan (feature 009 FR-001).
    const option = allOptions.find(o => o.key === key)
    if (option && openOption !== key) plans.request(option.id)
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
        tabs={tabs}
        tab={activeTab}
        onUseChange={setUse}
        onModeChange={next => {
          if (next === mode) return
          setChange(
            assessment && categories ? explainCategoryModeChange(categories, assessment, mode, next)
              : assessment ? explainModeChange(assessment, mode, next) : [],
          )
          setMode(next)
        }}
        onTabChange={changeTab}
      />
      {change.length > 0 && <div role="status" className="text-sm text-muted">{change.map(t => <p key={t}>{t}</p>)}</div>}
      {streamError && !assessment ? (
        <ErrorCard title="We could not load your results" message={streamError.message} />
      ) : !assessment || scan.state === 'loading' ? (
        <div className="flex flex-col gap-3.5">
          {searching ? (
            <Thinking key="web" phrase={WEB_SEARCH_PHRASE} label="Searching the web for this model…" className="px-1" />
          ) : (
            <Thinking label="Assessing your computer…" className="px-1" />
          )}
          <ResultSkeleton />
        </div>
      ) : (
        <div className="fade-up grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] items-start gap-7">
          <div className="relative flex flex-col gap-3.5">
            {activeCategory ? (
              <CategoryTabView
                key={activeCategory.id}
                category={activeCategory}
                selectedKey={selectedOption}
                openKey={openOption}
                onToggle={toggleOption}
                planOf={plans.get}
              />
            ) : categories ? (
              <>
                {planView ? (
                  <PlanCard
                    view={planView}
                    selected={overviewPlan !== null}
                    open={planOpen}
                    steps={plans.getPlan()}
                    onToggle={() => {
                      // Opening the card for the first time requests the plan's step list (feature 014 FR-001).
                      if (!planOpen) plans.requestPlan()
                      setPlanOpen(!planOpen)
                    }}
                  />
                ) : null}
                {categoryViews.map(view => (
                  <div key={view.key} ref={registerCard(view.key)}>
                    <PathCard
                      view={view}
                      selected={gaugeCategory?.id === view.id}
                      open={false}
                      pending={false}
                      navigates
                      onToggle={() => changeTab(view.id)}
                    />
                  </div>
                ))}
              </>
            ) : (
              categoriesPending ? (
                // The five assessed paths are only a fallback; showing them first and swapping them for the
                // categories made the screen jump and the numbers change (feature 006 FR-054).
                <>
                  <Thinking label="Finding options for this computer…" className="px-1" />
                  <CardSkeletons />
                </>
              ) : (
                pathViews.map(view => (
                  <div key={view.key} ref={registerCard(view.key)}>
                    <PathCard
                      view={view}
                      selected={gaugeItem?.key === view.key}
                      open={openOption === view.key}
                      pending={false}
                      onToggle={() => setOpenOption(current => (current === view.key ? null : view.key))}
                    />
                  </div>
                ))
              )
            )}
            {categories && categories.source === 'template' && categories.notice ? (
              <p className="m-0 rounded-[10px] bg-amber-tint px-3 py-2 text-[13px] text-amber-ink">{categories.notice}</p>
            ) : null}
          </div>
          <div className="xl:sticky top-6 flex flex-col gap-5">
            <section aria-label="CO₂e gauge" className="rounded-[20px] bg-white p-6 shadow-card">
              {categoriesPending ? (
                <GaugeSkeleton />
              ) : (
                <>
                  <Gauge value={gaugeItem?.gauge ?? null} pathTitle={gaugeTitle} estimate={gaugeItem?.aiEstimate ?? false} />
                  <Equivalents avoided={gaugeItem?.co2?.avoided ?? null} conditional={gaugeItem?.co2?.conditional ?? false} />
                </>
              )}
            </section>
            <SpecsCard scan={scan.value} parts={parts} />
          </div>
        </div>
      )}
    </div>
  )
}

function toClientError(error: unknown): ApiClientError {
  return error instanceof ApiClientError ? error : new ApiClientError('internal', 'Something went wrong.')
}
