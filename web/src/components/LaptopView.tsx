import type { DetectedPart, PartKind } from '../api/types'

interface Zone {
  kind: PartKind
  label: string
  x: number
  y: number
  w: number
  h: number
}

// A laptop seen from below with the cover open: board parts at the top, battery along the bottom.
const ZONES: readonly Zone[] = [
  { kind: 'cpu', label: 'CPU', x: 34, y: 22, w: 54, h: 46 },
  { kind: 'gpu', label: 'GPU', x: 98, y: 22, w: 42, h: 46 },
  { kind: 'memory', label: 'RAM', x: 150, y: 22, w: 54, h: 46 },
  { kind: 'storage', label: 'Drive', x: 214, y: 22, w: 72, h: 46 },
  { kind: 'battery', label: 'Battery', x: 34, y: 80, w: 252, h: 34 },
]

interface Props {
  parts: readonly DetectedPart[]
  /** Kinds the scanner is reading right now; they pulse. */
  active: readonly PartKind[]
}

/** Small schematic laptop whose zones turn green as the scanner finds the parts. Optional, shown on request. */
export function LaptopView({ parts, active }: Props) {
  const found = new Set(parts.map((p) => p.kind))
  return (
    <svg viewBox="0 0 320 136" role="img" aria-label={`Laptop view: ${found.size} of ${ZONES.length} areas found`} className="fade-up w-full">
      <rect x="18" y="8" width="284" height="120" rx="16" fill="var(--color-page)" stroke="var(--color-line)" strokeWidth="2" />
      {ZONES.map((zone) => {
        const isFound = found.has(zone.kind)
        const isActive = active.includes(zone.kind)
        return (
          <g key={zone.kind} className={isActive ? 'zone-active' : undefined}>
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.w}
              height={zone.h}
              rx="8"
              fill={isFound ? 'var(--color-leaf-tint)' : 'white'}
              stroke={isFound || isActive ? 'var(--color-leaf)' : 'var(--color-line)'}
              strokeWidth="2"
              strokeDasharray={isFound ? undefined : '4 4'}
              style={{ transition: 'fill 300ms ease, stroke 300ms ease' }}
            />
            <text
              x={zone.x + zone.w / 2}
              y={zone.y + zone.h / 2 + 4}
              fontSize="11"
              fontWeight="700"
              textAnchor="middle"
              fill={isFound ? 'var(--color-leaf-deep)' : 'var(--color-muted)'}
            >
              {zone.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
