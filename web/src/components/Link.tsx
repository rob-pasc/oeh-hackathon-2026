import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navigate } from '../app/router'

type Props = { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>

/** In-app link: plain left clicks navigate without a page load, everything else keeps browser behaviour. */
export function Link({ to, onClick, ...rest }: Props) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={handleClick} {...rest} />
}
