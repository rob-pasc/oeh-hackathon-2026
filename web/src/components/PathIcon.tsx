import type { IconKind } from '../lib/labels'

const SHAPES: Record<IconKind, string[]> = {
  upgrade: ['M12 19V5M5 12l7-7 7 7'],
  repair: ['M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z'],
  pass_on: ['M4 12v7h16v-7M12 3v12M8 7l4-4 4 4'],
  salvage: ['M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8'],
  recycle: ['M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2M18 2v4h-4M6 22v-4h4'],
  // A spark: options outside the five paths, such as reinstalling the operating system.
  other: ['M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8'],
}

export function PathIcon({ path, className = '' }: { path: IconKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {SHAPES[path].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
