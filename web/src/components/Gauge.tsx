import { GAUGE, TRACK_PATH, arcPath, needleAngle, polar } from '../lib/gauge'
import type { GaugeValue } from '../lib/impact'
import { AnimatedText } from './AnimatedText'

interface Props {
  value: GaugeValue | null
  /** Title of the selected path, shown under the number. */
  pathTitle: string
}

const TICKS = [0, 25, 50, 75, 100]

export function Gauge({ value, pathTitle }: Props) {
  const range = value ? arcPath(value.low, value.high) : null
  const mid = value?.mid ?? 0
  const center = `${GAUGE.cx}px ${GAUGE.cy}px`

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 175" role="img" aria-label={`CO₂e gauge: ${value ? `${mid} percent` : 'no figure'}`} className="w-full max-w-[340px]">
        <path d={TRACK_PATH} fill="none" stroke="var(--color-track)" strokeWidth="22" strokeLinecap="round" />
        {range ? (
          <path d={range} fill="none" stroke="var(--color-leaf-soft)" strokeWidth="22" strokeLinecap="round" />
        ) : null}
        {value ? (
          <path
            d={arcPath(0, Math.max(mid, 1)) ?? ''}
            fill="none"
            stroke="var(--color-leaf)"
            strokeWidth="22"
            strokeLinecap="round"
          />
        ) : null}
        {TICKS.map((t) => {
          const outer = polar(t, GAUGE.r + 20)
          const inner = polar(t, GAUGE.r + 13)
          return (
            <line
              key={t}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#9aa6a0"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )
        })}
        {value ? (
          <g
            data-testid="gauge-needle"
            className="gauge-needle"
            style={{ transform: `rotate(${needleAngle(mid)}deg)`, transformOrigin: center }}
          >
            <line x1={GAUGE.cx} y1={GAUGE.cy} x2={GAUGE.cx} y2={GAUGE.cy - 88} stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
          </g>
        ) : null}
        <circle cx={GAUGE.cx} cy={GAUGE.cy} r="8" fill="var(--color-ink)" />
        <text x="22" y="172" fontSize="11" fill="var(--color-muted)" textAnchor="middle">
          0%
        </text>
        <text x="278" y="172" fontSize="11" fill="var(--color-muted)" textAnchor="middle">
          100%
        </text>
      </svg>
      <div className="-mt-1 text-center">
        <div className="text-5xl leading-none font-extrabold tracking-tight">{value ? <AnimatedText text={`${mid}%`} /> : '—'}</div>
        <div className="mt-1.5 text-sm text-muted">
          {value ? `of a new laptop’s production CO₂e avoided` : 'No CO₂e figure for this path'}
        </div>
        <div className="mt-0.5 text-[13px] font-semibold text-leaf">{pathTitle}</div>
        {value && value.high - value.low >= 2 ? (
          <div className="mt-0.5 text-xs text-muted">
            Likely {value.low}–{value.high}%
          </div>
        ) : null}
      </div>
    </div>
  )
}
