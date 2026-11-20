import { useEffect, useRef, useState } from 'react'
import { interpolateText, motionAllowed } from '../lib/motion'

const DURATION_MS = 700
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Text whose numbers count up on first show and glide to new values when the text changes, e.g. "€40–70" or
 * "+1.5–2.5 years". Shows the final text right away when motion is not allowed.
 */
export function AnimatedText({ text }: { text: string }) {
  const [shown, setShown] = useState(() => (motionAllowed() ? interpolateText('', text, 0) : text))
  const shownRef = useRef(shown)

  useEffect(() => {
    if (!motionAllowed()) {
      shownRef.current = text
      setShown(text)
      return
    }
    const from = shownRef.current
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const next = interpolateText(from, text, easeOut(t))
      shownRef.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [text])

  return <>{shown}</>
}
