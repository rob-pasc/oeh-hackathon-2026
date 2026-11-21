// Device scan payload and device API shapes (feature 001).
//
// Privacy (feature 001 FR-005): every object sets additionalProperties: false, so a payload
// carrying serial numbers, UUIDs, host/user names, or network identifiers fails validation.
// Do not add such fields here.
//
// Every field the scanner might fail to read is present and nullable rather than optional,
// so "unknown" is always explicit (FR-004). Source hints name the Windows data source the
// scanner team is expected to use; they are guidance, not part of the contract. The macOS and
// Linux sources are listed in docs/features/feature-007-macos-linux-scanner/RESEARCH.md.
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

/** Operating system family the scan ran on (feature 007 FR-010). */
export const OS_FAMILIES = ['windows', 'macos', 'linux'] as const
export const OsFamily = Type.Enum(OS_FAMILIES)
export type OsFamily = Static<typeof OsFamily>

export const Os = Type.Object(
  {
    // Optional rather than nullable: scans from before feature 007 have no family and stay valid.
    family: Type.Optional(OsFamily),
    caption: Nullable(
      Type.String({
        description:
          'Win32_OperatingSystem.Caption ("Microsoft Windows 11 Pro"); sw_vers ProductName and ProductVersion ("macOS 14.5"); os-release PRETTY_NAME ("Fedora Linux 43 (Workstation Edition)")',
      }),
    ),
    build: Nullable(
      Type.String({
        description: 'Win32_OperatingSystem.Version ("10.0.22631"); sw_vers BuildVersion ("23F79"); os-release VERSION_ID ("43")',
      }),
    ),
    display_version: Nullable(
      Type.String({ description: 'Registry DisplayVersion ("23H2"); Windows only, not applicable on macOS and Linux' }),
    ),
  },
  strict,
)

export const Firmware = Type.Object(
  {
    bios_release_date: Nullable(IsoDate),
    firmware_type: Nullable(
      Type.Enum(['uefi', 'legacy_bios', 'apple'], { description: 'apple: Apple Silicon boot firmware, neither UEFI nor BIOS' }),
    ),
    secure_boot_enabled: Nullable(Type.Boolean()),
  },
  { ...strict, description: 'BIOS date is an age hint only; it changes with BIOS updates' },
)

export const Tpm = Type.Object(
  {
    present: Nullable(Type.Boolean()),
    spec_version: Nullable(Type.String({ description: 'Highest supported TPM spec version, e.g. "2.0"' })),
  },
  { ...strict, description: 'Win32_Tpm or /sys/class/tpm; Macs have no TPM (not applicable). Report null when unreadable' },
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

/**
 * Fields that do not exist on the scanned system (feature 007 FR-018), as dotted paths. They are
 * always null there and do not make a scan partial. Windows scans and scans without
 * `os.family` have none, so feature 001 FR-004 is unchanged for them. The Go scanner mirrors
 * this list in internal/payload; a shared fixture test keeps the two in agreement.
 */
export function notApplicableFields(scan: Pick<DeviceScan, 'os' | 'firmware'>): readonly string[] {
  switch (scan.os.family) {
    case 'macos': {
      const fields = ['tpm.present', 'tpm.spec_version', 'firmware.bios_release_date', 'firmware.secure_boot_enabled', 'os.display_version']
      // Apple Silicon memory is part of the chip, so there are no slots to count.
      if (scan.firmware.firmware_type === 'apple') fields.push('memory.slots_total', 'memory.slots_used')
      return fields
    }
    case 'linux':
      return ['os.display_version']
    default:
      return []
  }
}

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
