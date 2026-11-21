// Feature 009: the step list in the option card, its load state, and the mock sample plans.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Step, StepPlan } from '@leaaf/shared/steps'
import { createValidator } from '@leaaf/shared/validate'
import { checkStepPlan } from '@leaaf/shared/invariants'
import { MAX_PLAN_STEPS, PLAN_STEPS_ID, PlanStepList as PlanStepListSchema, StepPlan as StepPlanSchema } from '@leaaf/shared/steps'
import { USE_TAGS } from '../lib/labels'
import { ApiContext } from '../api'
import { createMockClient, MOCK_DEVICE_IDS } from '../api/mock'
import { LAPTOP_CATEGORIES } from '../api/mockCategories'
import { LAPTOP_PLAN_IDS, STEPS_UNAVAILABLE } from '../api/mockSteps'
import type { ApiClient } from '../api/types'
import { ResultsView } from '../components/ResultsView'
import { StepList } from '../components/StepList'
import { formatMinutes, NO_VERIFIED_STEPS, type StepState } from '../lib/steps'
import ssdPlanJson from '@leaaf/fixtures/steps.example-laptop-14.office.json'

const ssdPlan = ssdPlanJson as unknown as StepPlan
const ready = (plan: StepPlan): StepState => ({ state: 'ready', plan })

const step = (s: Partial<Step>): Step => ({
  title: 'Do the thing',
  detail: 'Do it like this.',
  tools: [],
  parts: [],
  minutes: null,
  safety: 'none',
  warning: null,
  kind: 'general',
  passage_ids: [],
  ...s,
})

const planWith = (steps: Step[], extra: Partial<StepPlan> = {}): StepPlan => ({ ...ssdPlan, steps, ...extra })

describe('StepList', () => {
  it('shows each step as a numbered block with its title and detail (AC-002)', () => {
    const steps = ['One', 'Two', 'Three', 'Four'].map((title) => step({ title, detail: `${title} detail.` }))
    render(<StepList state={ready(planWith(steps))} />)
    const items = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    items.forEach((item, i) => {
      expect(item).toHaveTextContent(`${i + 1}`)
      expect(item).toHaveTextContent(`${steps[i]!.title}${steps[i]!.title} detail.`)
    })
  })

  it('shows tools, parts and time when given, and none of these lines otherwise (AC-003)', () => {
    const full = step({ title: 'Full', tools: ['Phillips #0 screwdriver'], parts: ['8 GB DDR4-2400 SO-DIMM'], minutes: { low: 10, high: 15 } })
    render(<StepList state={ready(planWith([full, step({ title: 'Bare' })]))} />)
    const [first, second] = screen.getAllByRole('listitem')
    expect(first).toHaveTextContent('ToolsPhillips #0 screwdriver')
    expect(first).toHaveTextContent('Parts8 GB DDR4-2400 SO-DIMM')
    expect(first).toHaveTextContent('Time10–15 min')
    for (const label of ['Tools', 'Parts', 'Time']) expect(within(second!).queryByText(label)).toBeNull()
  })

  it('shows the warning of a caution step and "Professional only" on a professional step, as text (AC-004)', () => {
    const caution = step({ title: 'Open it', safety: 'caution', warning: 'Unplug the charger first.' })
    const pro = step({ title: 'Swap the battery', safety: 'professional', detail: 'Have a service provider do this step.' })
    render(<StepList state={ready(planWith([caution, pro]))} />)
    const [first, second] = screen.getAllByRole('listitem')
    expect(first).toHaveTextContent('Caution')
    expect(first).toHaveTextContent('Warning: Unplug the charger first.')
    expect(second).toHaveTextContent('Professional only')
    expect(second).toHaveTextContent(/service provider/)
  })

  it('says no verified steps exist when the server removed every step (AC-006)', () => {
    render(<StepList state={ready(planWith([], { passages: [] }))} />)
    expect(screen.getByText(NO_VERIFIED_STEPS)).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('links each cited document by its title, opening in a new tab (AC-007)', () => {
    render(<StepList state={ready(ssdPlan)} />)
    const cited = ssdPlan.steps.findIndex((s) => s.passage_ids.length > 0)
    const item = screen.getAllByRole('listitem')[cited]!
    const link = within(item).getByRole('link')
    const passage = ssdPlan.passages.find((p) => p.passage_id === ssdPlan.steps[cited]!.passage_ids[0])!
    expect(link).toHaveTextContent(`Source: ${passage.title}`)
    expect(link).toHaveAttribute('href', passage.url)
    expect(link).toHaveAttribute('target', '_blank')
    // General steps without citations show no link.
    expect(within(screen.getAllByRole('listitem')[0]!).queryByRole('link')).toBeNull()
  })

  it('shows the thinking line and step placeholders while the plan loads (AC-010)', () => {
    const { rerender } = render(<StepList state={{ state: 'loading' }} />)
    expect(screen.getByTestId('steps-loading')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Writing the steps…')
    rerender(<StepList state={ready(ssdPlan)} />)
    expect(screen.queryByTestId('steps-loading')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows the notice above a template plan (AC-011)', () => {
    render(<StepList state={ready(planWith([step({})], { source: 'template', notice: STEPS_UNAVAILABLE, passages: [] }))} />)
    expect(screen.getByText(STEPS_UNAVAILABLE)).toBeInTheDocument()
  })
})

describe('formatMinutes', () => {
  it.each([
    [{ low: 10, high: 15 }, '10–15 min'],
    [{ low: 5, high: 5 }, '5 min'],
    [{ low: 60, high: 120 }, '1–2 h'],
    [{ low: 60, high: 90 }, '60–90 min'],
    [{ low: 120, high: 120 }, '2 h'],
  ])('formats %o as %s', (range, text) => expect(formatMinutes(range)).toBe(text))
})

describe('mock step plans (AC-013)', () => {
  const api = createMockClient({ stepsMs: 0 })
  const validate = createValidator(StepPlanSchema)
  const laptopIds = LAPTOP_CATEGORIES.categories.flatMap((c) => c.options.map((o) => o.option_id))
  const desktopIds = ['upgrade', 'repair', 'pass_on', 'salvage', 'recycle']

  it('has a valid plan for every sample option of both devices', async () => {
    expect([...LAPTOP_PLAN_IDS].sort()).toEqual([...laptopIds].sort())
    for (const [deviceId, ids] of [[MOCK_DEVICE_IDS.laptop, laptopIds], [MOCK_DEVICE_IDS.desktop, desktopIds]] as const) {
      for (const id of ids) {
        const plan = await api.getSteps(deviceId, 'office', id)
        expect(validate(plan).ok, `${deviceId} ${id}`).toBe(true)
        expect(checkStepPlan(plan), `${deviceId} ${id}`).toEqual([])
        expect(plan.steps.length).toBeGreaterThan(0)
        expect(plan.source).toBe(deviceId === MOCK_DEVICE_IDS.desktop ? 'template' : 'llm')
      }
    }
  })

  it('uses tools, parts, time, all three safety flags and source links across the laptop samples', async () => {
    const plans = await Promise.all(laptopIds.map((id) => api.getSteps(MOCK_DEVICE_IDS.laptop, 'office', id)))
    const steps = plans.flatMap((p) => p.steps)
    expect(steps.some((s) => s.tools.length > 0)).toBe(true)
    expect(steps.some((s) => s.parts.length > 0)).toBe(true)
    expect(steps.some((s) => s.minutes !== null)).toBe(true)
    expect(new Set(steps.map((s) => s.safety))).toEqual(new Set(['none', 'caution', 'professional']))
    expect(plans.some((p) => p.steps.some((s) => s.passage_ids.length > 0) && p.passages.length > 0)).toBe(true)
  })

  it('answers an unknown option with not_found', async () => {
    await expect(api.getSteps(MOCK_DEVICE_IDS.laptop, USE_TAGS[0]!, 'no-such-option')).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('ResultsView step plans', () => {
  const counting = (stepsMs = 5) => {
    const base = createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 5, stepsMs })
    const getSteps = vi.fn(base.getSteps)
    return { api: { ...base, getSteps } satisfies ApiClient, getSteps }
  }
  const renderWith = (api: ApiClient, deviceId: string = MOCK_DEVICE_IDS.laptop) =>
    render(
      <ApiContext.Provider value={api}>
        <ResultsView deviceId={deviceId} />
      </ApiContext.Provider>,
    )
  const openTab = async (name: string) => {
    const group = await screen.findByRole('group', { name: 'Show options for' })
    await screen.findByRole('region', { name })
    await userEvent.click(within(group).getByRole('button', { name }))
  }

  it('requests a plan once per option: reopening and switching the mode do not ask again (AC-001, AC-010)', async () => {
    const { api, getSteps } = counting(400)
    renderWith(api)
    await openTab('Faster storage')
    const ssd = await screen.findByRole('region', { name: 'Swap the hard disk for a 500 GB SSD' })
    const toggle = within(ssd).getAllByRole('button')[0]!
    await userEvent.click(toggle)
    expect(within(ssd).getByTestId('steps-loading')).toBeInTheDocument()
    const list = await within(ssd).findByRole('list', { name: 'Steps' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(ssdPlan.steps.length)
    expect(within(ssd).queryByTestId('steps-loading')).toBeNull()

    await userEvent.click(toggle)
    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('button', { name: /money first/i }))
    expect(await within(ssd).findByRole('list', { name: 'Steps' })).toBeInTheDocument()
    expect(getSteps).toHaveBeenCalledTimes(1)
    expect(getSteps).toHaveBeenCalledWith(MOCK_DEVICE_IDS.laptop, 'general', 'ssd-swap')
  })

  it('shows the template plan with its notice for a fallback option (AC-011, AC-012)', async () => {
    const { api } = counting()
    renderWith(api, MOCK_DEVICE_IDS.desktop)
    await openTab('Recycle')
    const view = await screen.findByTestId('category-tab-view')
    const option = within(view).getAllByRole('region')[1]!
    await userEvent.click(within(option).getAllByRole('button')[0]!)
    expect(await within(option).findByText(STEPS_UNAVAILABLE)).toBeInTheDocument()
    expect(within(option).getByRole('list', { name: 'Steps' })).toBeInTheDocument()
  })

  it('tries again when a failed plan request is reopened', async () => {
    const { api, getSteps } = counting()
    getSteps.mockRejectedValueOnce(new Error('offline'))
    renderWith(api)
    await openTab('Faster storage')
    const ssd = await screen.findByRole('region', { name: 'Swap the hard disk for a 500 GB SSD' })
    const toggle = within(ssd).getAllByRole('button')[0]!
    await userEvent.click(toggle)
    expect(await within(ssd).findByText(/could not be loaded/)).toBeInTheDocument()
    await userEvent.click(toggle)
    await userEvent.click(toggle)
    await waitFor(() => expect(within(ssd).getByRole('list', { name: 'Steps' })).toBeInTheDocument())
    expect(getSteps).toHaveBeenCalledTimes(2)
  })
})

describe('the plan’s step list (feature 014)', () => {
  const counting = (stepsMs = 5) => {
    const base = createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 5, stepsMs })
    const getPlanSteps = vi.fn(base.getPlanSteps)
    return { api: { ...base, getPlanSteps } satisfies ApiClient, getPlanSteps }
  }
  const renderWith = (api: ApiClient) =>
    render(
      <ApiContext.Provider value={api}>
        <ResultsView deviceId={MOCK_DEVICE_IDS.laptop} />
      </ApiContext.Provider>,
    )

  it('requests the list once when the plan card is opened, and shows it numbered with tools, parts and time (AC-001, AC-002, AC-007)', async () => {
    const { api, getPlanSteps } = counting()
    renderWith(api)
    const card = await screen.findByRole('region', { name: 'Your plan' })
    const toggle = within(card).getAllByRole('button')[0]!
    expect(getPlanSteps).not.toHaveBeenCalled()
    await userEvent.click(toggle)
    const list = await within(card).findByRole('list', { name: 'Steps' })
    const items = within(list).getAllByRole('listitem')
    const sample = (await createMockClient({ stepsMs: 0 }).getPlanSteps(MOCK_DEVICE_IDS.laptop, 'general'))
    expect(items).toHaveLength(sample.steps.length)
    expect(card).toHaveTextContent('Tools')
    expect(card).toHaveTextContent('Time')
    // Closing and reopening, or switching tabs, does not ask again.
    await userEvent.click(toggle)
    await userEvent.click(toggle)
    expect(await within(card).findByRole('list', { name: 'Steps' })).toBeInTheDocument()
    expect(getPlanSteps).toHaveBeenCalledTimes(1)
  })

  it('closes the plan card when the intended use changes, and loads the new use’s list when reopened (AC-001)', async () => {
    const { api, getPlanSteps } = counting()
    renderWith(api)
    let card = await screen.findByRole('region', { name: 'Your plan' })
    await userEvent.click(within(card).getAllByRole('button')[0]!)
    await within(card).findByRole('list', { name: 'Steps' })
    await userEvent.selectOptions(screen.getByRole('combobox'), 'office')
    card = await screen.findByRole('region', { name: 'Your plan' })
    await waitFor(() => expect(within(card).getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'false'))
    await userEvent.click(within(card).getAllByRole('button')[0]!)
    expect(await within(card).findByRole('list', { name: 'Steps' })).toBeInTheDocument()
    expect(getPlanSteps.mock.calls.map((c) => c[1])).toEqual(['general', 'office'])
  })

  it('shows the thinking line while the list loads (AC-005)', async () => {
    const { api } = counting(400)
    renderWith(api)
    const card = await screen.findByRole('region', { name: 'Your plan' })
    await userEvent.click(within(card).getAllByRole('button')[0]!)
    expect(within(card).getByRole('status')).toBeInTheDocument()
    expect(await within(card).findByRole('list', { name: 'Steps' }, { timeout: 2000 })).toBeInTheDocument()
  })

  it('has a valid mock list for the laptop’s sample plan with shared steps named once, and none for the desktop (AC-007)', async () => {
    const api = createMockClient({ stepsMs: 0 })
    const list = await api.getPlanSteps(MOCK_DEVICE_IDS.laptop, 'office')
    expect(createValidator(PlanStepListSchema)(list).ok).toBe(true)
    expect(checkStepPlan(list as StepPlan)).toEqual([])
    expect(list.option_id).toBe(PLAN_STEPS_ID)
    expect(list.steps.length).toBeLessThanOrEqual(MAX_PLAN_STEPS)
    const titles = list.steps.map((s) => s.title)
    expect(new Set(titles).size).toBe(titles.length)
    expect(titles.filter((t) => t === 'Back up your files')).toHaveLength(1)
    await expect(api.getPlanSteps(MOCK_DEVICE_IDS.desktop, 'office')).rejects.toThrow(/no plan/)
  })
})
