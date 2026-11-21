import { useCallback, useRef, useState } from 'react'
import { ApiClientError, useApi } from '../api'
import type { UseTag } from './labels'
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

  const request = useCallback(
    (optionId: string) => {
      const k = key(optionId)
      if (requested.current.has(k)) return
      requested.current.add(k)
      setPlans((p) => ({ ...p, [k]: { state: 'loading' } }))
      api.getSteps(deviceId, use, optionId).then(
        (plan) => setPlans((p) => ({ ...p, [k]: { state: 'ready', plan } })),
        (error: unknown) => {
          requested.current.delete(k)
          const message = error instanceof ApiClientError ? error.message : 'Something went wrong.'
          setPlans((p) => ({ ...p, [k]: { state: 'error', message } }))
        },
      )
    },
    [api, deviceId, use, key],
  )

  const get = useCallback((optionId: string): StepState | undefined => plans[key(optionId)], [plans, key])

  return { get, request }
}
