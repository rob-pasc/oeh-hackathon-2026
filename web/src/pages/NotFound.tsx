import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { Link } from '../components/Link'
import { PRIMARY_BUTTON } from '../components/ui'

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 mx-auto flex max-w-[640px] flex-col items-center gap-6 px-16 pt-24 text-center">
        <h1 className="m-0 text-4xl font-extrabold">Page not found</h1>
        <p className="m-0 text-lg text-muted">This link does not lead anywhere. Start a new scan from the home page.</p>
        <Link to="/" className={`${PRIMARY_BUTTON} py-4 text-lg font-bold`}>
          Back to home
        </Link>
      </main>
      <Footer />
    </div>
  )
}
