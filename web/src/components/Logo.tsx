/** Wordmark "leaaf" with a green ".green". "hero" is the large mark on the landing page, "header" the one on the other screens. */
export function Logo({ variant = 'header' }: { variant?: 'hero' | 'header' }) {
  const size = variant === 'hero' ? 'text-5xl sm:text-[60px]' : 'text-4xl'
  const suffix = variant === 'hero' ? 'text-[32px] sm:text-[40px]' : 'text-2xl'
  return (
    // On the landing page the logo is not a link: arrow cursor and no text selection, like a picture.
    <div className={`font-extrabold tracking-tight text-ink select-none ${variant === 'hero' ? 'cursor-default' : ''} ${size}`}>
      leaaf<span className={`text-leaf ${suffix}`}>.green</span>
    </div>
  )
}

/**
 * What the name stands for: the initials of "Lifecycle Evaluation and Action Finder" in green, which spell leaaf
 * (the "and" supplies the second a). Plain text for screen readers; the capitals come from CSS.
 */
export function Acronym() {
  const initial = 'font-bold text-leaf'
  return (
    <p className="m-0 text-[11px] tracking-[0.06em] text-muted uppercase sm:text-xs sm:tracking-[0.14em] select-none">
      <span className={initial}>L</span>ifecycle <span className={initial}>E</span>valuation <span className={initial}>a</span>nd{' '}
      <span className={initial}>A</span>ction <span className={initial}>F</span>inder
    </p>
  )
}
