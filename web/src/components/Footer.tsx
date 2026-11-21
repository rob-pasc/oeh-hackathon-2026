import { Link } from './Link'

export const CONTACT_EMAIL = 'contact@leaaf.green'

export function Footer() {
  const legalLink = 'font-semibold text-muted hover:text-ink'
  return (
    <footer className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted">
      <p className="m-0">
        Questions?{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-leaf hover:text-leaf-dark">
          {CONTACT_EMAIL}
        </a>
      </p>
      <nav aria-label="Legal" className="flex gap-4">
        <Link to="/imprint" className={legalLink}>
          Imprint
        </Link>
        <Link to="/privacy" className={legalLink}>
          Privacy
        </Link>
      </nav>
    </footer>
  )
}
