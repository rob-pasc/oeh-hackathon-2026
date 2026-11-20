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

// Session and device IDs are 22 base64url characters (128 random bits); anything else is not a valid link.
const ID_ROUTE = /^\/(s|d)\/([A-Za-z0-9_-]{22})$/

export function parseRoute(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || '/'
  if (clean === '/') return { name: 'landing' }
  const match = ID_ROUTE.exec(clean)
  if (match) {
    const id = match[2] as string
    return match[1] === 's' ? { name: 'session', id } : { name: 'device', id }
  }
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
