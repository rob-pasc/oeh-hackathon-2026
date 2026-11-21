import type { ReactNode } from 'react'
import { Link } from './Link'
import { Acronym, Logo } from './Logo'

/** `acronym` puts what the name stands for to the right of the logo (result and loading screens). */
export function Header({ right, acronym = false }: { right?: ReactNode; acronym?: boolean }) {
  return (
    <header className="mx-auto flex w-full max-w-[1312px] items-center justify-between px-4 sm:px-8 xl:px-16 pt-6 pb-4">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <Link to="/" aria-label="leaaf home">
          <Logo variant="header" />
        </Link>
        {acronym ? <Acronym variant="header" /> : null}
      </div>
      {right}
    </header>
  )
}
