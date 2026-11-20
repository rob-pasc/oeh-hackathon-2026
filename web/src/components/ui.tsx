import type { ReactNode } from 'react'

/** Grey shimmering placeholder block; size it with Tailwind classes. */
export function Sk({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`sk ${className}`} />
}

export function Spinner() {
  return <div aria-hidden="true" className="spinner flex-none" />
}

export function ErrorCard({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[20px] bg-white p-7 shadow-card">
      <span className="text-lg font-bold">{title}</span>
      <span className="text-[15px] leading-relaxed text-muted">{message}</span>
      {action ? <div>{action}</div> : null}
    </div>
  )
}

/** Primary pill button style, shared by <button> and <a> call sites. */
export const PRIMARY_BUTTON =
  'inline-flex cursor-pointer items-center gap-3.5 rounded-full border-0 bg-leaf px-12 text-white no-underline shadow-button transition-colors hover:bg-leaf-dark'
