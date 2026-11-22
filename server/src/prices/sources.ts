// Allowlist of price sites from config/price-sources.yaml (feature 019 FR-003).
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { isHttpUrl } from '../search/types.ts'

export const DEFAULT_PRICE_SOURCES_PATH = new URL('../../../config/price-sources.yaml', import.meta.url)

const DOMAIN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/** Reads and checks the allowlist; an invalid file stops the server at startup. */
export function loadPriceSources(path: string | URL = DEFAULT_PRICE_SOURCES_PATH): string[] {
  const doc = parse(readFileSync(path, 'utf8')) as { domains?: unknown } | null
  const domains = doc?.domains
  if (!Array.isArray(domains) || domains.length === 0) throw new Error('price-sources.yaml: `domains` must be a non-empty list')
  return domains.map((d, i) => {
    if (typeof d !== 'string' || !DOMAIN.test(d.trim().toLowerCase())) throw new Error(`price-sources.yaml: domains[${i}] is not a domain name`)
    return d.trim().toLowerCase()
  })
}

/** Host of a page as shown to the owner, without "www.". */
export const publisherOf = (url: string): string => new URL(url).hostname.toLowerCase().replace(/^www\./, '')

/** Whether the URL is an http(s) page on one of the domains or a subdomain of one. */
export function onDomains(url: string, domains: readonly string[]): boolean {
  if (!isHttpUrl(url)) return false
  const host = new URL(url).hostname.toLowerCase()
  return domains.some((d) => host === d || host.endsWith(`.${d}`))
}
