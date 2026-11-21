import { useCallback, useRef, useState } from 'react'
import { ApiClientError, useApi } from '../api'
import type { UseTag } from './labels'
import { PLAN_STEPS_ID, type StepPlan } from '@leaaf/shared/steps'
import type { StepState } from './steps'

/**
 * Step plans of the opened options, requested the first time an option is opened (feature 009
 * FR-001). Plans are kept per intended use and option, so reopening a card, switching the mode or
 * coming back to a use tag shows the plan already loaded; only a failed request is tried again.
 */
export function useStepPlans(deviceId: string, use: UseTag) {
  const api = useApi()
  const [plans, setPlans] = useState<Record<string, StepState>>({})
  // Requests already made, so two quick opens never ask twice; errors are removed to allow a retry.
  const requested = useRef(new Set<string>())

  const key = useCallback((optionId: string) => `${use}\0${optionId}`, [use])

  /** Loads one list once per key; a failed request is removed so that reopening tries again. */
  const load = useCallback((k: string, fetchList: () => Promise<StepPlan>) => {
    if (requested.current.has(k)) return
    requested.current.add(k)
    setPlans((p) => ({ ...p, [k]: { state: 'loading' } }))
    fetchList().then(
      (plan) => setPlans((p) => ({ ...p, [k]: { state: 'ready', plan } })),
      (error: unknown) => {
        requested.current.delete(k)
        const message = error instanceof ApiClientError ? error.message : 'Something went wrong.'
        setPlans((p) => ({ ...p, [k]: { state: 'error', message } }))
      },
    )
  }, [])

  const request = useCallback(
    (optionId: string) => load(key(optionId), () => api.getSteps(deviceId, use, optionId)),
    [api, deviceId, use, key, load],
  )
  const get = useCallback((optionId: string): StepState | undefined => plans[key(optionId)], [plans, key])

  // The plan's single list (feature 014) is kept like an option's plan, under an ID no option can have.
  const requestPlan = useCallback(() => load(key(PLAN_STEPS_ID), () => api.getPlanSteps(deviceId, use)), [api, deviceId, use, key, load])
  const getPlan = useCallback((): StepState | undefined => plans[key(PLAN_STEPS_ID)], [plans, key])

  return { get, request, getPlan, requestPlan }
}
