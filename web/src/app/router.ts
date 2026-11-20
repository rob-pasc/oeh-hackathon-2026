// A tiny History-API router: the app has three screens, so a routing library is not worth the dependency.
//   /            landing page
//   /s/:id       scan session (skeleton + live status from the scanner)
//   /d/:id       device page (results)
import { useMemo, useSyncExternalStore } from 'react'

export type Route =
  | { name: 'landing' }
  | { name: 'session'; id: string }
  | { name: 'device'; id: string }
  | { name: 'not_found' }

// Device IDs are 22 base64url characters (128 bits); session IDs are 26 Crockford base32 characters
// (130 bits, shared/src/session.ts). Anything else is not a valid link.
const DEVICE_ROUTE = /^\/d\/([A-Za-z0-9_-]{22})$/
const SESSION_ROUTE = /^\/s\/([0-9A-HJKMNP-TV-Z]{26})$/

export function parseRoute(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || '/'
  if (clean === '/') return { name: 'landing' }
  const device = DEVICE_ROUTE.exec(clean)
  if (device) return { name: 'device', id: device[1] as string }
  const session = SESSION_ROUTE.exec(clean)
  if (session) return { name: 'session', id: session[1] as string }
  return { name: 'not_found' }
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (options.replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname)
  return useMemo(() => parseRoute(pathname), [pathname])
}
