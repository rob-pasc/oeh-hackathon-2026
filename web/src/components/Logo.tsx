export function LeafMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z" />
      <path d="M5 19c3-5 6-8 10-10" />
    </svg>
  )
}

/** "hero" is the large mark on the landing page, "header" the compact one on the other screens. */
export function Logo({ variant = 'header' }: { variant?: 'hero' | 'header' }) {
  if (variant === 'hero') {
    return (
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-leaf-tint text-leaf">
          <LeafMark className="h-[34px] w-[34px]" />
        </div>
        <span className="text-[60px] leading-none font-extrabold tracking-[-0.04em]">leaaf</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-leaf-tint text-leaf">
        <LeafMark className="h-5 w-5" />
      </div>
      <span className="text-2xl leading-none font-extrabold tracking-[0.04em] uppercase">leaaf</span>
    </div>
  )
}
