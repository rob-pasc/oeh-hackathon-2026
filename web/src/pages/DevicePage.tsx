import { Header } from '../components/Header'
import { ResultsView } from '../components/ResultsView'

export function DevicePage({ deviceId }: { deviceId: string }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-[1312px] px-16 pt-4 pb-16">
        <ResultsView deviceId={deviceId} />
      </main>
    </div>
  )
}
