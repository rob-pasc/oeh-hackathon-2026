import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { Link } from '../components/Link'
import { PRIMARY_BUTTON } from '../components/ui'

// A malformed device link gets the same wording as an unknown device ID (ResultsView), so both read
// as "scan not found" (feature 001 FR-011).
export function NotFound({ device = false }: { device?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 mx-auto flex max-w-[640px] flex-col items-center gap-6 px-6 pt-16 text-center sm:px-16 sm:pt-24">
        <h1 className="m-0 text-3xl font-extrabold sm:text-4xl">{device ? 'We could not find this scan' : 'Page not found'}</h1>
        <p className="m-0 text-lg text-muted">
          {device
            ? 'The link may be wrong or the result may have expired. Start a new scan from the home page.'
            : 'This link does not lead anywhere. Start a new scan from the home page.'}
        </p>
        <Link to="/" className={`${PRIMARY_BUTTON} py-4 text-lg font-bold`}>
          Back to home
        </Link>
      </main>
      <Footer />
    </div>
  )
}
