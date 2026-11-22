// Phrases for the thinking line shown while the page waits for the AI (feature 006 FR-045). They describe the
// kind of work the server does (retrieval, extraction, scoring) loosely and playfully; none claims a result.
export const THINKING_PHRASES = [
  'Thinking…',
  'Evaluating…',
  'Pondering…',
  'Weighing the options…',
  'Reading the repair manuals…',
  'Checking the sources…',
  'Counting the CO₂e…',
  'Comparing the five paths…',
  'Consulting the parts list…',
  'Mulling it over…',
  'Crunching the numbers…',
  'Looking for evidence…',
  'Considering a second life…',
  'Sprouting ideas…',
  'Photosynthesizing…',
] as const

/** Shown, without rotating, while the server searches the web for the scanned model (feature 017 FR-013). */
export const WEB_SEARCH_PHRASE = 'Searching the web…'

/** How long one phrase stays before the next one replaces it. */
export const THINKING_INTERVAL_MS = 2400

/**
 * A randomly chosen phrase that differs from `previous` (pass null for the first one). `random` returns a number
 * in [0, 1) like Math.random and is injectable for tests.
 */
export function nextThinkingPhrase(
  previous: string | null,
  random: () => number = Math.random,
  phrases: readonly string[] = THINKING_PHRASES,
): string {
  const candidates = phrases.filter((p) => p !== previous)
  const pool = candidates.length > 0 ? candidates : phrases
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!
}
