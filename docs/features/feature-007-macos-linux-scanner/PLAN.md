# Feature 007: macOS and Linux scanner

- **Feature ID:** `feature-007-macos-linux-scanner`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-21

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

Today leaaf only scans Windows laptops and PCs: the scanner reads nothing on other systems ([`collect_other.go`](../../../scanner/internal/collect/collect_other.go)), the server serves one `.exe`, and the landing page speaks only of Windows. This feature adds scanners for macOS (Intel and Apple Silicon) and Linux (x64). They use the same Gio window, scan flow, session link, local save, and upload as the Windows scanner, and fill the existing `DeviceScan` fields from each system's own sources.

The landing page detects the visitor's system and offers the matching download with run instructions. The assessment and report stop presenting Windows 11 CPU support as a fact for Macs and Linux machines. This ends the product's Windows-only decision ([`docs/PRODUCT.md`](../../PRODUCT.md), [feature 001](../feature-001-device-scan-and-upload/PLAN.md) out of scope).

## Problem and desired outcome

- **Problem:** Owners of old Macs and Linux laptops cannot use leaaf at all. Old Intel MacBooks and Linux laptops face the same drawer-or-e-waste decision as Windows laptops.
- **Desired outcome:** An owner on macOS or Linux downloads one scanner from the landing page, runs it, and gets the same device page and ranked report as a Windows owner, with unreadable values shown as unknown rather than guessed.
- **Target users / stakeholders:** Owners of old Macs and Linux laptops or PCs; the hackathon team and judges (demo on non-Windows machines).

## Approved scope

### In scope

- A macOS scanner that runs on Intel and Apple Silicon Macs, as one universal download, without administrator rights.
- A Linux x64 scanner with the same Gio window, running as the signed-in user, with an optional `pkexec` helper that reads root-only fields.
- Collection of the existing `DeviceScan` fields from each system's sources; anything the system does not expose is `null`.
- The same scan journey as on Windows: start screen, step progress, completion screen with **Show my results**, error screen with **Try again**, local JSON save, upload, and scan-session progress.
- An optional, additive `os.family` field (`windows`, `macos`, `linux`) in the device schema.
- One download per system, each carrying the scan-session ID; the landing page detects the system, offers the matching download, and shows system-specific run steps and data disclosure.
- OS-aware assessment and report wording: Windows 11 CPU support rules apply only to Windows devices.
- CI builds and tests for all three systems; release artifacts for all three downloads.
- Documentation: `PRODUCT.md`, the README, the scanner README, the deployment guide, and the related feature plans.

### Out of scope

- Code signing or notarization (Apple Developer ID) for any system.
- ARM Linux and other Linux architectures; 32-bit systems.
- Administrator rights on macOS.
- A terminal-only Linux scanner or running the scanner window as root.
- Bootable-USB scanning, Chromebooks, iPhone and iPad.
- New knowledge-base sources for Macs (macOS support lists, Mac repair guides); Mac-specific evidence shows as "cannot verify".
- Changes to the Windows scanner's behavior, other than the new `os.family` value it reports.

## Functional requirements

- **FR-001** *(corrected 2026-11-21)*: A macOS scanner download runs on Intel and Apple Silicon Macs with macOS 12 (Monterey) or later, from one file, without installation and without asking for administrator rights. *(Originally macOS 11: Go 1.24 and later, which the scanner uses, need macOS 12.)*
- **FR-002:** A Linux scanner download runs on x64 desktop distributions with an X11 or Wayland session, without installation, as the signed-in user.
- **FR-003:** The macOS and Linux scanners show the same window and journey as the Windows scanner (feature-001-device-scan-and-upload / FR-009, FR-014, FR-015): nothing is read or sent before **Start scan**, the window shows the step and "Step n of 5", and it ends on the completion or error screen. **Show my results** opens the device page in the default browser as the signed-in user.
- **FR-004:** The macOS scanner collects, when the system provides them: manufacturer, model, product family, form factor, CPU name, cores and threads, RAM total, type and speed, RAM slots where the Mac has socketed memory, each internal drive's type, bus, capacity and health, battery presence, design capacity, full-charge capacity, health percentage and cycle count, GPU names, the macOS name and version, and the firmware type: `uefi` on Intel Macs, `apple` on Apple Silicon. The TPM fields are `null`. *(Firmware values decided 2026-11-21.)*
- **FR-005:** The Linux scanner collects without root, when the system provides them: manufacturer, model, product family, form factor, BIOS release date, CPU name, cores and threads, RAM total, each internal drive's type, bus and capacity, battery presence, design capacity, full-charge capacity, health percentage and cycle count, GPU names, the distribution name and version, firmware type, Secure Boot state, and TPM presence and version.
- **FR-006:** After **Start scan**, the Linux scanner asks for root once through `pkexec`, which shows the system's password dialog. With root granted, a helper reads RAM type, speed and slot counts and each internal drive's health. If the user cancels, `pkexec` is missing, or the helper fails, the scan continues and those fields are `null`. The window and the browser never run as root.
- **FR-007:** Any value that cannot be read is `null`, and `scan_status` follows feature-001-device-scan-and-upload / FR-004. A single unreadable source never aborts the scan.
- **FR-008:** The macOS and Linux payloads, including everything the Linux root helper returns, contain no serial numbers, UUIDs, user names, host names, network identifiers, or file contents (as in feature-001-device-scan-and-upload / FR-005). Values that the system tools return alongside allowed fields, such as the Mac serial number and hardware UUID or memory module serial numbers, are discarded.
- **FR-009:** Drives on USB, SD, Thunderbolt-external, network, or virtual buses, and disk images, are not reported as internal storage.
- **FR-010:** Every payload carries `os.family`: `windows`, `macos`, or `linux`. The field is optional in the schema, so existing records and older scanners stay valid without a `schema_version` change.
- **FR-011:** The macOS and Linux scanners save the payload as a local JSON file before uploading and show its location. On macOS the location is one that needs no extra privacy permission prompt.
- **FR-012:** The server serves a download for each system, and each download carries the scan-session ID when started from a session. The existing Windows download URL keeps working.
- **FR-013:** The landing page detects whether the visitor uses Windows, macOS, or Linux and starts the matching download with **Download and Scan now**. Links to the other two downloads are always available. On a system it cannot detect (for example a phone), it offers all three downloads.
- **FR-014:** Next to the download, the landing page shows how to run the scanner on the detected system (macOS: allow the unsigned app in System Settings; Linux: make the file executable and run it) and discloses what that scanner reads, including the optional Linux password prompt.
- **FR-015:** For a device whose `os.family` is `macos` or `linux`, the assessment does not use Windows 11 CPU support to cap or rule out a path, and no report text says the CPU is or is not supported by Windows 11. Whether the system still gets security updates is shown as a point that could not be verified.
- **FR-016:** A device without `os.family` (records created before this feature) and a `windows` device are assessed exactly as before.
- **FR-017:** CI vets, tests and builds the scanner for Windows, macOS and Linux. A release publishes all three downloads, built against the public URL as in feature-005-public-demo-deployment / FR-002.
- **FR-018** *(added 2026-11-21)*: Fields that do not exist on a system do not make a scan `partial`. They stay `null`, and `scan_status` ignores them. For `macos`: `tpm.present`, `tpm.spec_version`, `firmware.bios_release_date`, `firmware.secure_boot_enabled` and `os.display_version`; on Apple Silicon (`firmware_type` `apple`) also `memory.slots_total` and `memory.slots_used`, because the memory is part of the chip. For `linux`: `os.display_version`. Windows payloads and payloads without `os.family` keep feature-001-device-scan-and-upload / FR-004 unchanged. Any other `null` still makes a scan `partial`.
- **FR-019** *(added 2026-11-21)*: On the scan specs card, the security chip of a `macos` device reads "Not applicable" instead of "Unknown".

## Non-functional requirements and constraints

- **Privacy:** The allowlist principle from feature 001 holds on every system: collectors parse only named keys or files, and recorded fixtures containing planted identifiers (serials, UUIDs, host names) are tested to never reach the payload. The root helper returns only allowlisted fields and the window process re-validates them.
- **Security:** The Linux helper runs only the read-only collection for the root-only fields, takes no input besides its flag, and is the same binary as the window. The scanner contains no secrets. Running the downloaded file through `pkexec` requires the user's administrator password, so it grants nothing an administrator could not already do.
- **Performance:** A scan finishes in under 30 seconds on typical hardware, excluding upload time and the time the password dialog is open. Each source has a timeout, as on Windows.
- **Compatibility:** macOS 12 or later on Intel and Apple Silicon (the Go toolchain's minimum since Go 1.24), so Macs from before about 2015 cannot run it. Linux x64 with glibc and an X11 or Wayland desktop session; the build targets an older glibc so that current and recent distributions can run it. Systems missing the graphics libraries the window needs are a known limitation (see risks).
- **Design:** The window matches the Windows scanner (feature-001-device-scan-and-upload / FR-014, FR-016), including the leaf icon where the system shows one.
- **Schema:** Changes to `shared/src/device.ts` are additive (ADR-001): the optional `os.family` and the `apple` value of `firmware.firmware_type`. Field descriptions name the source on each system. The server and the scanner downloads ship together, so no deployed server meets an `apple` value it rejects.

## User journeys and edge cases

1. **Mac happy path:** The owner opens leaaf.green on a Mac and presses **Download and Scan now**. The browser downloads the macOS scanner and opens the session tab. The owner opens the download. macOS blocks the unsigned app; the landing page's steps explain how to allow it under System Settings → Privacy & Security → Open Anyway. The scanner window opens, the owner presses **Start scan**, and the session tab becomes the result screen.
2. **Linux happy path:** The owner downloads the Linux scanner, makes it executable (`chmod +x`, or the file manager's "Allow executing" setting), and runs it. After **Start scan** the system password dialog appears; the owner enters the password and the scan completes with RAM slots and disk health.
3. **Linux without root:** The owner cancels the password dialog, or the system has no `pkexec`. The scan continues; RAM type, speed and slots and disk health are "Unknown", and `scan_status` is `partial`.
4. **Apple Silicon Mac:** RAM is part of the chip, so slot counts are `null`; TPM fields are `null`; neither makes the scan partial (FR-018). The specs card shows the security chip as "Not applicable", and the report does not mention Windows 11.
5. **Linux without graphics libraries:** The window cannot open. The scanner prints a readable message to the terminal naming the missing library, and the landing page's Linux steps mention the requirement.
6. **External drives:** A USB stick or an external Thunderbolt drive is attached during the scan; it does not appear in the storage list.
7. **Undetected system:** A visitor on a phone sees all three downloads and the note that the scanner runs on the computer to be assessed.
8. **Old record:** A device scanned before this feature has no `os.family`; its report is unchanged.

## Proposed technical approach

Proposal based on repository inspection on 2026-11-21; none of it is adopted yet. Findings behind it are in [`RESEARCH.md`](./RESEARCH.md).

- **Collectors:** `scanner/internal/collect` gains `collect_darwin.go` and `collect_linux.go`; `collect_other.go` stays for unsupported systems. `scan.Raw` stays the Windows allowlist; each new system gets its own raw struct (`scan.RawDarwin`, `scan.RawLinux`) with pure, fixture-tested normalization into the same `payload.DeviceScan`. The existing step labels and progress callback are reused.
- **macOS sources:** `system_profiler -json` for hardware, memory, NVMe/SATA storage, power and displays, `ioreg -a -r -c AppleSmartBattery` for design and raw maximum capacity, `sw_vers` for the version, and `sysctl` for cores and threads. The JSON is decoded into structs that name only allowed keys, so the serial number and hardware UUID that `system_profiler` returns are never stored.
- **Linux sources (no root):** `/sys/class/dmi/id` (vendor, product name, version, family, SKU, chassis type, BIOS date; never `product_serial` or `product_uuid`), `/proc/cpuinfo` and `/sys/devices/system/cpu`, `/proc/meminfo`, `/sys/block` with each device's sysfs path for bus and removability, `/sys/class/power_supply/BAT*`, PCI display-class devices named through the system's `pci.ids`, `/etc/os-release`, `/sys/firmware/efi` and the `SecureBoot` EFI variable, and `/sys/class/tpm`.
- **Linux root helper:** the window process runs `pkexec <own executable> --privileged-helper`. The helper parses SMBIOS types 16 and 17 from `/sys/firmware/dmi/tables/DMI` (type, speed, size, slot counts only) and reads drive health through the NVMe SMART log and ATA SMART RETURN STATUS ioctls. It writes a small JSON object to stdout, which the window process decodes into an allowlist struct. *(Decided 2026-11-21, user choice:)* drive health comes from `smartctl --json -H` when smartmontools is installed. Without it, NVMe drives fall back to the NVMe SMART log ioctl and SATA drives report `null`.
- **Builds:** Gio needs cgo on macOS and Linux. *(Decided 2026-11-21, user choice:)* a `macos-latest` CI job builds `darwin/amd64` and `darwin/arm64` with cgo, joins them into a universal binary, wraps it in a `.app` bundle with `Info.plist` and the leaf icon, and zips it. The image job takes that zip as a build input, and `server/Dockerfile` copies it in; Windows and Linux keep building in the Dockerfile's Go stage, Linux with the X11/Wayland development packages on an older Debian glibc. A local `docker build` without the zip has no Mac download (404), and a script builds the zip on a Mac for local use.
- **Session ID on macOS** *(implemented 2026-11-21, to be confirmed on the MacBook in T-002)*: the CI build signs the whole `.app` ad hoc, so nothing inside it may change afterwards: appending to the Mach-O or adding a session file would invalidate the signature, and macOS then calls the app damaged without offering Open Anyway. The server instead renames the bundle inside the zip to `leaaf-scanner-<session>.app`; a signature does not cover the bundle folder's own name, and App Translocation keeps it. The scanner reads the session from that name (`run.SessionFromBundle`). *(Originally proposed: a session file inside the bundle, or the appended trailer.)*
- **Session ID on Linux:** the existing trailer appended after the ELF file works unchanged.
- **Local save** *(implemented 2026-11-21)*: Linux saves next to the executable, as on Windows. On macOS an unsigned app opened from Downloads runs from a read-only translocated path, and writing to Downloads triggers a permission prompt, so the scanner saves to the home folder and shows the path.
- **Downloads and sessions:** `shared/src/api.ts` gains a download route per system; `POST /api/sessions` takes the system and returns the matching `download_url`. The current `/downloads/leaaf-scanner.exe` stays as the Windows route. The server gets one path setting per artifact, each 404 until a build exists.
- **Web:** the landing page detects the system from `navigator.userAgentData.platform` with a `navigator.userAgent` fallback, and shows the steps and disclosure for it. Copy goes through the UX copy conventions already used on the landing page.
- **Scan status (FR-018):** `checkDeviceScan` in `shared/src/invariants.ts` gets one list of not-applicable field paths per `os.family`, which the Go normalizers mirror when they set `scan_status`; a shared fixture test keeps both sides in agreement.
- **Assessment:** `osSupport` in `server/src/assessment/gates.ts` returns "not applicable" for `macos` and `linux`; Pass it on then reports a "cannot verify security updates" reason instead of the Windows 11 ones, and the own-use cap is not applied. Retrieval skips the Windows 11 queries for those devices. Template and LLM explanation prompts receive `os.family`.
- **Tests:** normalization tests on recorded `system_profiler`/`ioreg` output and on captured sysfs trees, including planted identifiers; schema validation of every fixture against `DeviceScan.schema.json`; tests for the helper's decoding and the cancel path; server tests for each download route and session download URL; web tests for system detection and the per-system steps; assessment tests for each `os.family`.

## Dependencies and risks

- **Dependency:** A real Mac (ideally one Intel and one Apple Silicon) for verification of FR-001, FR-004, FR-011 and the session-ID approach. The developer machine is Fedora Linux, which covers the Linux checks.
- **Dependency:** A macOS runner in GitHub Actions for the macOS build.
- **Risk:** Unsigned apps make the first launch on a Mac awkward; macOS 15 removed the right-click → Open shortcut, so users must go through System Settings. Mitigation: clear landing-page steps. Signing is out of scope.
- **Risk:** The Linux window may not start on distributions without the needed graphics libraries, or on very old glibc. Mitigation: readable terminal error and documented requirements.
- **Risk:** `pkexec` runs a file from the user's Downloads folder as root. It needs the administrator password, but the dialog shows an unfamiliar path. Mitigation: the landing page explains the prompt; the helper does read-only work.
- **Risk:** The session-ID trailer may not work on macOS (see the technical approach); the fallback changes the download format to a zip.
- **Risk:** Battery and SMART values vary by vendor and firmware; some will be `null`, as on Windows.
- **Risk:** Reports for Macs carry more "cannot verify" points, because the knowledge base has no Mac sources.

## Review and integration

- **Completion boundary:** Locally verified handoff with self-review, plus a real scan on a Mac and on a Linux laptop. Public release of the new downloads follows feature 005's deployment guide.
- **Review:** Self-review of the final diff against this plan, with the privacy allowlist and the root helper reviewed specifically, recorded in `ACCEPTANCE_CRITERIA.md`. No independent reviewer is required by repository policy; because the helper runs as root, an informal review by a team member is recommended.
- **CI/merge:** CI ([`.github/workflows/ci.yaml`](../../../.github/workflows/ci.yaml)) must pass with the new scanner jobs. Required local checks: Go tests and vet for each system the machine can build, server and web tests, and type checks. Pushing and merging need user authorization.

## Release and recovery (when applicable)

- **Rollout order:** shared schema and server first (the optional `os.family` and the new download routes are backward compatible), then the web app's per-system downloads, then the release artifacts. See [`docs/DEPLOYMENT.md`](../../DEPLOYMENT.md).
- **Compatibility:** Existing device records and the Windows download URL are unchanged. Older scanners that do not send `os.family` stay valid (FR-010, FR-016).
- **Migrations:** None; the schema change is an optional field in JSON payloads.
- **Recovery:** Reverting the release removes the new downloads; device records created by Mac or Linux scans stay readable because the field is optional.
- **Post-release checks:** each download URL returns its artifact on the public site; one real scan from a Mac and one from Linux against the public site creates a device record and report. Release execution needs the user's authorization and follows feature 005.

## Assumptions and open questions

- Corrected 2026-11-21: the minimum is macOS 12, not 11. Go 1.24 dropped macOS 11, and `scanner/go.mod` uses Go 1.26. Building with an older Go to reach macOS 11 was not pursued.
- Open: the session-ID mechanism on macOS (zip with a session file inside the bundle, or the appended trailer); decided on a real Mac in T-002.
- Decided 2026-11-21: the Linux helper uses `smartctl` when installed (see the technical approach).
- Decided 2026-11-21: the security chip on a Mac reads "Not applicable" (FR-019).
- Decided 2026-11-21: Apple Silicon reports the firmware type `apple`, Intel Macs `uefi` (FR-004).
- Decided 2026-11-21: the macOS build comes from a macOS CI job and is copied into the server image (see the technical approach).
- Test hardware: the team has one Apple Silicon MacBook. The user tests the Mac build on it and reports back; Intel Macs are verified only through fixtures unless one becomes available.

## Scope change log

| Date       | Change                 | User approval                                                                                                                                                                                                                                                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21 | Initial approved scope | User asked for Apple and Linux support, chose Intel + Apple Silicon, unsigned Mac download with instructions, a Gio window on Linux, OS-aware assessment wording, an optional `pkexec` helper on Linux and no admin on macOS, and replied "lets go" to the revised scope in the conversation, 2026-11-21 |
| 2026-11-21 | Revision before implementation: added FR-018 (fields that do not exist on a system do not make a scan partial) and FR-019 ("Not applicable" security chip on a Mac); FR-004 now names the firmware values (`apple` on Apple Silicon, a new schema enum value). Decided `smartctl` and the macOS CI build. AC-024 and AC-025 added; AC-005 revised. Nothing was implemented yet. | User chose "Add an 'apple' value", "Ignore N/A fields", "macOS CI job → image", confirmed `smartctl` and "Not applicable", and chose "Apple Silicon, start now", 2026-11-21 |
| 2026-11-21 | Correction during implementation: FR-001's macOS minimum is 12 (Monterey), not 11, because Go 1.24 and later need macOS 12. AC-001 follows. The session mechanism on macOS (bundle name) and the save location (home folder) were settled within the approach. | Factual correction of the toolchain constraint; reported to the user with the implementation summary, 2026-11-21 |

## Related and superseded features

All replacements below were **implemented on `main` on 2026-11-21** (commits from "feat(shared): add os.family and system-aware scan status" to "ci(scanner): build and ship the macOS and Linux scanners"), with reciprocal notes in the earlier plans. They are effective in the code; real-hardware verification (T-011) and a public release are still open.

- [`feature-001-device-scan-and-upload`](../feature-001-device-scan-and-upload/PLAN.md): its out-of-scope entry "macOS, Linux, or bootable-USB scanning" and the deferral note under "Assumptions and open questions" are replaced for macOS and Linux scanning (bootable USB stays excluded). FR-001 to FR-016 stay in force for the Windows scanner. FR-004, FR-005 and FR-014 to FR-016 are reused here for the new systems by reference. The schema gains `os.family`, which the Windows scanner also reports (FR-010 here).
- `feature-001-device-scan-and-upload` / FR-012 (landing page download and disclosure): extended by FR-013 and FR-014 here with per-system downloads and disclosures; the Windows disclosure is unchanged.
- [`feature-003-five-path-ranking`](../feature-003-five-path-ranking/PLAN.md): the Windows 11 CPU support rules in its [DESIGN](../feature-003-five-path-ranking/DESIGN.md) (Upgrade, Repair and Pass it on rows) are limited to Windows devices and devices without `os.family` by FR-015 and FR-016 here. Other rules are unchanged.
- [`feature-005-public-demo-deployment`](../feature-005-public-demo-deployment/PLAN.md) / FR-002 and its adopted scanner build: extended from one Windows executable to three downloads (FR-012, FR-017 here). The Windows build and its URL are unchanged.
- [`feature-006-web-app`](../feature-006-web-app/PLAN.md) / FR-002 and FR-014: **Download and Scan now** downloads the scanner for the detected system instead of always the Windows scanner (FR-013 here). The session flow (FR-002 to FR-004) is unchanged.
- [`docs/PRODUCT.md`](../../PRODUCT.md): "one OS (Windows)" and the macOS/Linux non-goal change when this feature is implemented.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: [ADR-001](../../adr/adr-001-shared-contracts-typebox.md) governs the schema change; [ADR-005](../../adr/adr-005-scan-session-in-download.md) (session in the download, including the macOS bundle name)
- Research: [`RESEARCH.md`](./RESEARCH.md)
