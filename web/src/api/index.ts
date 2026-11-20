import { createContext, useContext } from 'react'
import { liveClient } from './live'
import { mockClient } from './mock'
import type { ApiClient } from './types'

/** `VITE_API_MODE=live` selects the real backend; everything else uses the mock (see web/.env.example). */
export const defaultClient: ApiClient = import.meta.env.VITE_API_MODE === 'live' ? liveClient : mockClient

export const ApiContext = createContext<ApiClient>(defaultClient)

export function useApi(): ApiClient {
  return useContext(ApiContext)
}

export * from './types'
