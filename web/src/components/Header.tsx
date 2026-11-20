import type { ReactNode } from 'react'
import { Link } from './Link'
import { Logo } from './Logo'

export function Header({ right }: { right?: ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-[1312px] items-center justify-between px-4 sm:px-8 xl:px-16 pt-6 pb-4">
      <Link to="/" aria-label="leaaf home">
        <Logo variant="header" />
      </Link>
      {right}
    </header>
  )
}
