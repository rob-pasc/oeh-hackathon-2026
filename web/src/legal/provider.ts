// Who runs leaaf.green. The Imprint and the Privacy notice take every personal detail from this file.
//
// TODO before publishing: replace every value in [square brackets]. While a value is still in brackets the
// page shows it highlighted, so open gaps cannot go unnoticed.
export const PROVIDER = {
  /** The provider (media owner) of the site. */
  name: 'Yannik Fischer',
  /** Postal address for official service of documents, one entry per line; the country follows from `country`. */
  address: ['c/o Fachhochschule Vorarlberg (FHV), Hochschulstraße 1', '6850 Dornbirn'],
  country: { de: 'Österreich', en: 'Austria' },
  email: 'contact@leaaf.green',
  /** The team member who operates the server (the machine stands in Vorarlberg, Austria). */
  serverOperator: 'Marco Stadelmann',
  /** How many days the web server keeps its access logs (IP address, time, requested path). Write only the number. */
  logRetentionDays: '3',
  /** How many days scan results are kept before they are deleted. The backend deletes them after this time. */
  scanRetentionDays: '30',
  /** Date of the last change to the legal texts, as year-month-day. */
  lastUpdated: '2026-11-22',
} as const
