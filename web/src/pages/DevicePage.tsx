import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { ResultsView } from '../components/ResultsView'

export function DevicePage({ deviceId }: { deviceId: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-[1312px] px-4 sm:px-8 xl:px-16 pt-4 pb-16">
        <ResultsView deviceId={deviceId} />
      </main>
      <Footer />
    </div>
  )
}
