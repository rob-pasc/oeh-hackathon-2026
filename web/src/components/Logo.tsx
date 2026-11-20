/** Wordmark "leaaf" with a green ".green". "hero" is the large mark on the landing page, "header" the one on the other screens. */
export function Logo({ variant = 'header' }: { variant?: 'hero' | 'header' }) {
  const size = variant === 'hero' ? 'text-[60px]' : 'text-4xl'
  const suffix = variant === 'hero' ? 'text-[40px]' : 'text-2xl'
  return (
    // On the landing page the logo is not a link: arrow cursor and no text selection, like a picture.
    <div className={`font-extrabold tracking-tight text-ink select-none ${variant === 'hero' ? 'cursor-default' : ''} ${size}`}>
      leaaf<span className={`text-leaf ${suffix}`}>.green</span>
    </div>
  )
}
