export const CONTACT_EMAIL = 'contact@leaaf.green'

export function Footer() {
  return (
    <footer className="flex flex-col items-center gap-1 px-4 py-6 text-center text-sm text-muted sm:flex-row sm:justify-center sm:gap-3">
      <span>
        <span className="font-semibold text-ink">leaaf</span> = Lifecycle Evaluation and Action Finder
      </span>
      <span aria-hidden="true" className="hidden sm:inline">
        ·
      </span>
      <span>
        Questions?{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-leaf hover:text-leaf-dark">
          {CONTACT_EMAIL}
        </a>
      </span>
    </footer>
  )
}
