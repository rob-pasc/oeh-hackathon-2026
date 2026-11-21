import { useEffect, useState } from 'react'
import type { DetectedPart } from '../api/types'
import { useApi } from '../api'
import { navigate } from '../app/router'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { PartsCard } from '../components/PartsCard'
import { ResultSkeleton, ToolbarSkeleton } from '../components/ResultSkeleton'
import { ScanStatus } from '../components/ScanStatus'
import { ErrorCard } from '../components/ui'
import { motionAllowed } from '../lib/motion'
import { upsertPart } from '../lib/parts'
import { activeZones, createScanPlayer, type ScanView } from '../lib/scanPlayback'

/**
 * Opened in a new tab by "Scan now": live status, the parts the scanner finds, and the result skeleton until the
 * scanner reports completion.
 */
export function ScanSession({ sessionId }: { sessionId: string }) {
  const api = useApi()
  const [view, setView] = useState<ScanView>({ progress: { phase: 'waiting' }, zones: {} })
  const [error, setError] = useState<string | null>(null)
  const [parts, setParts] = useState<DetectedPart[]>([])

  useEffect(() => {
    // Step events go through the player, which paces them for the laptop view (FR-041, FR-042); parts and their
    // lookups are listed as they arrive.
    const player = createScanPlayer({
      paced: motionAllowed(),
      onView: setView,
      // Same tab becomes the result screen; the address changes to the shareable device link.
      onComplete: (deviceId) => navigate(`/d/${deviceId}`, { replace: true }),
      onError: setError,
    })
    const unsubscribe = api.subscribeScanSession(sessionId, (event) => {
      if (event.type === 'part') setParts((current) => upsertPart(current, event.part))
      else player.push(event)
    })
    return () => {
      unsubscribe()
      player.dispose()
    }
  }, [api, sessionId])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 mx-auto flex w-full max-w-[1312px] flex-col gap-6 px-4 sm:px-8 xl:px-16 pt-4 pb-16">
        {error !== null ? (
          <ErrorCard
            title="The scan did not finish"
            message={`${error} Close this tab and start again from the home page.`}
          />
        ) : (
          <>
            <ScanStatus progress={view.progress} />
            <ToolbarSkeleton />
            <ResultSkeleton
              side={<PartsCard parts={parts} zones={view.zones} active={activeZones(view)} />}
            />
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
