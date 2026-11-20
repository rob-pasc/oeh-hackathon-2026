// Structured device facts extracted from retrieved passages (feature 003 FR-002).
// A fact is only valid with at least one supporting passage ID; the server additionally
// checks that every cited ID was actually retrieved for this device.
import { Type, type Static, type TSchema } from 'typebox'
import { MemoryType, PassageId } from './common.ts'
import { ModelMatch } from './retrieval.ts'

const strict = { additionalProperties: false } as const

const fact = <K extends string, V extends TSchema>(key: K, value: V, description: string) =>
  Type.Object(
    {
      key: Type.Literal(key),
      value,
      source_passage_ids: Type.Array(PassageId, { minItems: 1 }),
    },
    { ...strict, description },
  )

export const StorageSlot = Type.Object(
  {
    form_factor: Type.Enum(['m2_2230', 'm2_2242', 'm2_2260', 'm2_2280', 'sata_2_5', 'other']),
    interface: Type.Enum(['nvme', 'sata', 'nvme_or_sata', 'other']),
  },
  strict,
)

export const Fact = Type.Union(
  [
    // Memory
    fact('ram_soldered', Type.Enum(['none', 'partial', 'all']), 'partial = some RAM soldered plus at least one slot'),
    fact('ram_slots_total', Type.Integer({ minimum: 0 }), 'User-accessible RAM slots'),
    fact('ram_max_gb', Type.Number({ minimum: 0 }), 'Maximum supported RAM in GiB'),
    fact('ram_type', MemoryType, 'Supported memory type'),
    // Storage
    fact('storage_slots', Type.Array(StorageSlot, { minItems: 0 }), 'Internal storage slots and their interfaces'),
    // Battery
    fact('battery_user_replaceable', Type.Boolean(), 'Replaceable without specialist tools or adhesive removal'),
    fact('battery_replacement_part_available', Type.Boolean(), 'A replacement battery is documented as obtainable'),
    // Software support
    fact('windows11_supported_cpu', Type.Boolean(), 'CPU is on Microsoft\'s supported processor list'),
    fact('latest_supported_os', Type.String({ minLength: 1 }), 'Newest OS version the vendor or Microsoft supports'),
    fact('vendor_bios_updates_ended', Type.Boolean(), 'Vendor no longer ships firmware/security updates'),
  ],
)
export type Fact = Static<typeof Fact>
export type FactKey = Fact['key']

export const FACT_KEYS = [
  'ram_soldered',
  'ram_slots_total',
  'ram_max_gb',
  'ram_type',
  'storage_slots',
  'battery_user_replaceable',
  'battery_replacement_part_available',
  'windows11_supported_cpu',
  'latest_supported_os',
  'vendor_bios_updates_ended',
] as const satisfies readonly FactKey[]

/** Cached per normalized model; each key appears at most once (checked in invariants.ts). */
export const FactSet = Type.Object(
  { model: ModelMatch, facts: Type.Array(Fact) },
  { ...strict },
)
export type FactSet = Static<typeof FactSet>
