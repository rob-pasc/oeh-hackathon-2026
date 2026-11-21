export const CONTACT_EMAIL = 'contact@leaaf.green'

export function Footer() {
  return (
    <footer className="py-6 text-center text-sm text-muted">
      Questions?{' '}
      <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-leaf hover:text-leaf-dark">
        {CONTACT_EMAIL}
      </a>
    </footer>
  )
}
