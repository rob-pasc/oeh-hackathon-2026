// Device scan payload and device API shapes (feature 001).
//
// Privacy (feature 001 FR-005): every object sets additionalProperties: false, so a payload
// carrying serial numbers, UUIDs, host/user names, or network identifiers fails validation.
// Do not add such fields here.
//
// Every field the scanner might fail to read is present and nullable rather than optional,
// so "unknown" is always explicit (FR-004). Source hints name the Windows data source the
// scanner team is expected to use; they are guidance, not part of the contract.
import { Type, type Static } from 'typebox'
import { DeviceId, IsoDate, IsoDateTime, MemoryType, Nullable } from './common.ts'
import { SessionId } from './session.ts'

export const DEVICE_SCAN_SCHEMA_VERSION = 1 as const

const strict = { additionalProperties: false } as const

export const FormFactor = Type.Enum(['laptop', 'desktop', 'other'], {
  description: 'Derived from Win32_SystemEnclosure.ChassisTypes',
})

export const Identity = Type.Object(
  {
    manufacturer: Nullable(Type.String({ description: 'Win32_ComputerSystem.Manufacturer' })),
    model: Nullable(
      Type.String({
        description: 'Win32_ComputerSystem.Model; on Lenovo this is a machine-type code such as 20L5CTO1WW',
      }),
    ),
    product_version: Nullable(
      Type.String({
        description: 'Win32_ComputerSystemProduct.Version; on Lenovo the readable name such as "ThinkPad T480"',
      }),
    ),
    system_family: Nullable(Type.String({ description: 'Win32_ComputerSystem.SystemFamily' })),
    system_sku: Nullable(
      Type.String({ description: 'Win32_ComputerSystem.SystemSKUNumber (a product SKU, not a serial number)' }),
    ),
    form_factor: Nullable(FormFactor),
  },
  {
    ...strict,
    description:
      'Raw identity strings as reported by firmware. Placeholder text such as "To be filled by O.E.M." must be reported as null. Model matching and aliases are feature 002.',
  },
)

export const Os = Type.Object(
  {
    caption: Nullable(Type.String({ description: 'Win32_OperatingSystem.Caption, e.g. "Microsoft Windows 11 Pro"' })),
    build: Nullable(Type.String({ description: 'Win32_OperatingSystem.Version, e.g. "10.0.22631"' })),
    display_version: Nullable(Type.String({ description: 'Registry DisplayVersion, e.g. "23H2"' })),
  },
  strict,
)

export const Firmware = Type.Object(
  {
    bios_release_date: Nullable(IsoDate),
    firmware_type: Nullable(Type.Enum(['uefi', 'legacy_bios'])),
    secure_boot_enabled: Nullable(Type.Boolean()),
  },
  { ...strict, description: 'BIOS date is an age hint only; it changes with BIOS updates' },
)

export const Tpm = Type.Object(
  {
    present: Nullable(Type.Boolean()),
    spec_version: Nullable(Type.String({ description: 'Highest supported TPM spec version, e.g. "2.0"' })),
  },
  { ...strict, description: 'Win32_Tpm may need admin rights; report null when unreadable' },
)

export const Cpu = Type.Object(
  {
    name: Nullable(Type.String({ description: 'Win32_Processor.Name' })),
    cores: Nullable(Type.Integer({ minimum: 1 })),
    threads: Nullable(Type.Integer({ minimum: 1 })),
  },
  strict,
)

export const Memory = Type.Object(
  {
    total_gb: Nullable(Type.Number({ minimum: 0, description: 'Installed RAM in GiB, rounded to one decimal' })),
    type: Nullable(MemoryType),
    speed_mts: Nullable(Type.Integer({ minimum: 0, description: 'Configured speed in MT/s' })),
    slots_total: Nullable(Type.Integer({ minimum: 0, description: 'Win32_PhysicalMemoryArray.MemoryDevices' })),
    slots_used: Nullable(Type.Integer({ minimum: 0, description: 'Count of Win32_PhysicalMemory entries' })),
  },
  {
    ...strict,
    description:
      'Slot counts from SMBIOS are unreliable for soldered RAM; soldering is a retrieved fact (feature 003), not a scan field',
  },
)

export const StorageDevice = Type.Object(
  {
    media: Type.Enum(['hdd', 'ssd', 'scm', 'unknown'], { description: 'MSFT_PhysicalDisk.MediaType 3/4/5, else unknown' }),
    bus: Type.Enum(['nvme', 'sata', 'other', 'unknown'], { description: 'MSFT_PhysicalDisk.BusType 17/11, else other/unknown' }),
    capacity_gb: Nullable(Type.Number({ minimum: 0, description: 'Decimal GB (10^9 bytes), as printed on drives' })),
    health: Type.Enum(['healthy', 'warning', 'unhealthy', 'unknown'], { description: 'MSFT_PhysicalDisk.HealthStatus' }),
  },
  { ...strict, description: 'Internal drives only; USB and virtual disks are excluded by the scanner' },
)

export const Battery = Type.Object(
  {
    present: Nullable(Type.Boolean()),
    design_capacity_mwh: Nullable(Type.Integer({ minimum: 0, description: 'root\\WMI BatteryStaticData.DesignedCapacity' })),
    full_charge_capacity_mwh: Nullable(
      Type.Integer({ minimum: 0, description: 'root\\WMI BatteryFullChargedCapacity.FullChargedCapacity' }),
    ),
    health_percent: Nullable(
      Type.Number({
        minimum: 0,
        maximum: 200,
        description: 'full_charge / design * 100. Some firmware reports identical values for both; consumers should treat exactly 100 with low confidence',
      }),
    ),
    cycle_count: Nullable(Type.Integer({ minimum: 0, description: 'From powercfg /batteryreport when available' })),
  },
  {
    ...strict,
    description: 'present=false means no battery was detected (e.g. desktop); null means it could not be determined',
  },
)

export const DeviceScan = Type.Object(
  {
    schema_version: Type.Literal(DEVICE_SCAN_SCHEMA_VERSION),
    scanner_version: Type.String({ minLength: 1 }),
    scanned_at: IsoDateTime,
    scan_status: Type.Enum(['complete', 'partial'], {
      description: 'partial when at least one nullable field is null (feature 001 FR-004)',
    }),
    identity: Identity,
    os: Os,
    firmware: Firmware,
    tpm: Tpm,
    cpu: Cpu,
    memory: Memory,
    storage: Nullable(Type.Array(StorageDevice, { description: 'null when storage could not be enumerated' })),
    battery: Battery,
    gpus: Nullable(Type.Array(Type.String({ minLength: 1 }), { description: 'Win32_VideoController.Name values' })),
    // Scan session read from the downloaded executable (feature 006). Optional rather than
    // nullable, so a plain build does not make the scan partial. The server removes it before
    // storing, so no device route ever returns it.
    session_id: Type.Optional(SessionId),
  },
  { ...strict, title: 'Device scan payload (v1)' },
)
export type DeviceScan = Static<typeof DeviceScan>

/** Response of POST /api/devices. */
export const UploadResponse = Type.Object(
  { device_id: DeviceId, device_url: Type.String({ format: 'uri' }) },
  { ...strict },
)
export type UploadResponse = Static<typeof UploadResponse>

/** Response of GET /api/devices/:id. */
export const DeviceRecord = Type.Object(
  { device_id: DeviceId, created_at: IsoDateTime, scan: DeviceScan },
  { ...strict },
)
export type DeviceRecord = Static<typeof DeviceRecord>

/** Error body for every non-2xx JSON response. */
export const ApiError = Type.Object(
  {
    error: Type.Enum(['invalid_payload', 'not_found', 'payload_too_large', 'rate_limited', 'internal']),
    message: Type.String(),
    fields: Type.Optional(
      Type.Array(
        Type.Object({ path: Type.String({ description: 'JSON Pointer, e.g. /memory/total_gb' }), message: Type.String() }, strict),
        { description: 'Present for invalid_payload: names each invalid field (feature 001 FR-007)' },
      ),
    ),
  },
  { ...strict },
)
export type ApiError = Static<typeof ApiError>
