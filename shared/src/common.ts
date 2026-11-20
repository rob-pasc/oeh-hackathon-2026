// Vocabulary shared by every contract. Terms follow docs/GLOSSARY.md.
import { Type, type Static, type TSchema } from 'typebox'

/** Nullable helper: the scanner reports unreadable fields as `null`, never omits them. */
export const Nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()])

/** Opaque device ID: base64url of 16 random bytes (feature 001 FR-008). */
export const DeviceId = Type.String({
  pattern: '^[A-Za-z0-9_-]{22}$',
  description: '22-character base64url string encoding 128 random bits',
})
export type DeviceId = Static<typeof DeviceId>

export const PATHS = ['upgrade', 'repair', 'pass_on', 'salvage', 'recycle'] as const
export const Path = Type.Enum(PATHS, { description: 'One of the five next lives for a device' })
export type Path = Static<typeof Path>

// general and gaming were added on 2026-11-20 (feature 003 FR-015); appended, so earlier values keep their order.
export const INTENDED_USES = ['office', 'study', 'development', 'pass_on', 'general', 'gaming'] as const
export const IntendedUse = Type.Enum(INTENDED_USES, {
  description:
    'office = office/browsing, study = school/university, development = programming, pass_on = pass to someone else, general = everyday use without a specific purpose, gaming = games',
})
export type IntendedUse = Static<typeof IntendedUse>

export const MODES = ['environment_first', 'money_first'] as const
export const Mode = Type.Enum(MODES)
export type Mode = Static<typeof Mode>

export const SUITABILITIES = ['viable', 'conditional', 'not_suitable'] as const
export const Suitability = Type.Enum(SUITABILITIES)
export type Suitability = Static<typeof Suitability>

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const
export const ConfidenceLevel = Type.Enum(CONFIDENCE_LEVELS)
export type ConfidenceLevel = Static<typeof ConfidenceLevel>

export const MEMORY_TYPES = [
  'ddr3',
  'ddr4',
  'ddr5',
  'lpddr3',
  'lpddr4',
  'lpddr4x',
  'lpddr5',
  'lpddr5x',
  'other',
] as const
export const MemoryType = Type.Enum(MEMORY_TYPES)
export type MemoryType = Static<typeof MemoryType>

/**
 * Closed numeric range. Units are carried by the field name (`_kg`, `_eur`, `_years`).
 * `low <= high` is a cross-field rule checked in invariants.ts, not expressible in JSON Schema.
 */
export const Range = Type.Object(
  { low: Type.Number(), high: Type.Number() },
  { additionalProperties: false },
)
export type Range = Static<typeof Range>

/** Opaque passage ID issued by retrieval (feature 002); used for every citation. */
export const PassageId = Type.String({ minLength: 1 })

/** Key of an entry in data/impact.yaml (feature 003 FR-007). */
export const ImpactRef = Type.String({ minLength: 1 })

/** Calendar date, YYYY-MM-DD. */
export const IsoDate = Type.String({ format: 'date' })

/** Timestamp in UTC, RFC 3339. */
export const IsoDateTime = Type.String({ format: 'date-time' })
