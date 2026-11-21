# Research: macOS and Linux scanner

- **Feature ID:** `feature-007-macos-linux-scanner`
- **Recorded:** 2026-11-21, from the scope discussion and repository inspection

Findings that shaped the [plan](./PLAN.md). They come from documentation and experience, not from runs on this project's hardware yet. Confirm each one during implementation and correct this file where it turns out wrong.

## Repository state (verified 2026-11-21 @ a576671)

- `scanner/internal/collect/collect_other.go` returns no readings outside Windows, so the payload is all `null`. The run flow, session trailer, retry and Gio window already build on Linux (`go run -tags gui`, feature 001).
- `scan.Raw` mirrors WMI classes and is the Windows privacy allowlist; the new systems need their own raw structs.
- The server serves one file at `/downloads/leaaf-scanner.exe` with the content type for a PE file and appends `LEAAFSCAN1:<session>` (`server/src/app.ts`).
- Windows 11 support enters the assessment through the `windows11_supported_cpu` fact (`server/src/assessment/gates.ts`, `osSupport`) and the Windows 11 retrieval terms (`server/src/retrieval/retrieve.ts`).

## macOS sources (no administrator rights needed)

| Field | Source | Notes |
|---|---|---|
| Model, family, CPU, RAM total | `system_profiler -json SPHardwareDataType` | Also returns `serial_number`, `platform_UUID` and `provisioning_UDID`: decode only allowed keys. |
| Cores, threads | `sysctl hw.physicalcpu hw.logicalcpu` | |
| RAM type, speed, slots | `system_profiler -json SPMemoryDataType` | Apple Silicon reports one unified memory entry without slots. Intel entries may include module serials. |
| Internal drives | `system_profiler -json SPNVMeDataType SPSerialATADataType` | `smart_status` gives health; entries include device serials. External drives appear under USB/Thunderbolt types and are skipped. |
| Battery | `ioreg -a -r -c AppleSmartBattery`, `system_profiler -json SPPowerDataType` | Capacities are in mAh; converting to mWh needs the voltage. The battery serial is in the same output. |
| GPUs | `system_profiler -json SPDisplaysDataType` | |
| OS | `sw_vers` | |

- macOS has no TPM; Intel Macs with a T2 chip and Apple Silicon use Apple's own secure boot.
- An unsigned app downloaded through a browser is quarantined. Since macOS 15 the right-click → Open shortcut no longer bypasses Gatekeeper; users go to System Settings → Privacy & Security → Open Anyway.
- A quarantined app opened from Downloads runs from a randomized read-only path (App Translocation), so "next to the executable" is not writable, and writing to `~/Downloads` triggers a privacy permission prompt.
- Apple Silicon only runs code with at least an ad-hoc signature; Go's linker adds one for `darwin/arm64`. Appending bytes to a signed Mach-O may break that signature: to be tested.
- Gio on macOS needs cgo and the macOS SDK, so it builds on a macOS machine or runner.

## Linux sources

| Field | Source | Root? |
|---|---|---|
| Vendor, product, version, family, SKU, chassis, BIOS date | `/sys/class/dmi/id/*` | No. `product_serial`, `product_uuid`, `board_serial` and `chassis_serial` are root-only and must never be read. |
| CPU | `/proc/cpuinfo`, `/sys/devices/system/cpu` | No |
| RAM total | `/proc/meminfo` `MemTotal` | No; slightly below the installed size because of reserved memory. |
| RAM type, speed, slots | SMBIOS types 16 and 17 in `/sys/firmware/dmi/tables/DMI` | Yes. Type 17 also holds serial number, asset tag and part number. |
| Drives | `/sys/block/*` (`queue/rotational`, `size`, `removable`, the device path for the bus) | No |
| Drive health | NVMe SMART log, ATA SMART RETURN STATUS (ioctls) or `smartctl` | Yes |
| Battery | `/sys/class/power_supply/BAT*` (`energy_full_design`, `energy_full` or `charge_*`, `cycle_count`) | No |
| GPUs | PCI devices with class `0x03`, names from `pci.ids` | No |
| OS | `/etc/os-release` | No |
| Firmware, Secure Boot | `/sys/firmware/efi`, `SecureBoot-8be4df61-…` EFI variable | No |
| TPM | `/sys/class/tpm/tpm0/tpm_version_major` | No |

- `sudo` drops `WAYLAND_DISPLAY` and `XDG_RUNTIME_DIR`, and a root process cannot reach the user's Wayland compositor, so the window cannot run as root. A browser started as root is refused by some browsers and is unsafe anyway. Hence a separate helper through `pkexec`, whose polkit agent shows a graphical password dialog on GNOME, KDE and most desktops.
- The ELF loader ignores bytes after the file's segments, so the Windows-style trailer works on Linux.
- Gio on Linux needs cgo and the X11, Wayland, xkbcommon, EGL and Vulkan development headers at build time, and the matching libraries at run time.
