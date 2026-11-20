import { useEffect, useState } from 'react'
import type { DetectedPart } from '../api/types'
import { useApi } from '../api'
import { navigate } from '../app/router'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { PartsCard } from '../components/PartsCard'
import { ResultSkeleton, ToolbarSkeleton } from '../components/ResultSkeleton'
import { ScanStatus, type ScanProgress } from '../components/ScanStatus'
import { ErrorCard } from '../components/ui'
import { STEP_KINDS, upsertPart } from '../lib/parts'

/**
 * Opened in a new tab by "Scan now": live status, the parts the scanner finds, and the result skeleton until the
 * scanner reports completion.
 */
export function ScanSession({ sessionId }: { sessionId: string }) {
  const api = useApi()
  const [progress, setProgress] = useState<ScanProgress>({ phase: 'waiting' })
  const [parts, setParts] = useState<DetectedPart[]>([])

  useEffect(() => {
    return api.subscribeScanSession(sessionId, (event) => {
      switch (event.type) {
        case 'step':
          if (event.state === 'running') setProgress({ phase: 'running', step: event.step })
          break
        case 'part':
          setParts((current) => upsertPart(current, event.part))
          break
        case 'complete':
          setProgress({ phase: 'done' })
          // Same tab becomes the result screen; the address changes to the shareable device link.
          navigate(`/d/${event.device_id}`, { replace: true })
          break
        case 'error':
          setProgress({ phase: 'failed', message: event.message })
          break
      }
    })
  }, [api, sessionId])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 mx-auto flex w-full max-w-[1312px] flex-col gap-6 px-4 sm:px-8 xl:px-16 pt-4 pb-16">
        {progress.phase === 'failed' ? (
          <ErrorCard
            title="The scan did not finish"
            message={`${progress.message} Close this tab and start again from the home page.`}
          />
        ) : (
          <>
            <ScanStatus progress={progress} />
            <ToolbarSkeleton />
            <ResultSkeleton
              side={<PartsCard parts={parts} active={progress.phase === 'running' ? STEP_KINDS[progress.step] : []} />}
            />
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
