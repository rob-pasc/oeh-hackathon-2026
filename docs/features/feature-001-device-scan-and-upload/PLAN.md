# Feature 001: Device scan and upload

- **Feature ID:** `feature-001-device-scan-and-upload`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-20

## Summary

A small Windows scanner, written in Go and downloaded from the Second Life Scanner website, reads the hardware facts needed to judge a laptop's next life. It uploads them as a minimal JSON inventory to the central platform. The platform stores one device record per upload and returns an unguessable link. The owner opens that link to see the device page.

This is the first slice of the Second Life Scanner MVP and the data foundation for retrieval (feature 002), ranking (feature 003), and the explained report (feature 004).

## Problem and desired outcome

- **Problem:** Owners rarely know what is in their old laptop (disk type, RAM, battery wear), and checking takes time and know-how. Without that data, no sensible next-life recommendation is possible.
- **Desired outcome:** An owner runs one executable, without installing anything, and within a minute sees their device's key specs on a private web page.
- **Target users / stakeholders:** Individual owners of an old Windows laptop or PC (primary); the hackathon team and judges (live demo).

## Approved scope

### In scope

- Windows scanner as a single Go executable, downloadable from the website.
- Collection of manufacturer, model, CPU, RAM, storage, and (when accessible) disk health, battery health, OS version, and a BIOS date as an age hint.
- Graceful handling of fields that cannot be read.
- Upload to a TypeScript/Node backend; validation and storage of one device record per upload.
- An unguessable device link (no accounts) and a device page in the React website that shows the scanned specs.
- A website landing page with the scanner download.
- Privacy by data minimization: no serial numbers or personal content.

### Out of scope

- macOS, Linux, or bootable-USB scanning; diagnostics for devices that do not boot.
- User accounts, logins, PINs, or a list of all devices.
- Deduplicating repeated scans of the same device (each upload is a new record).
- Manual JSON upload through the website.
- Retrieval, ranking, and explanations (features 002–004).
- Public hosting, seeding of demo devices, and abuse protection for a public endpoint (feature 005).
- Multi-device or fleet dashboard (deferred; to be specified later).

## Functional requirements

- **FR-001:** The scanner is a single Windows executable that runs on Windows 10 and 11 without installation and without administrator rights for its core fields (manufacturer, model, CPU, RAM, storage type and capacity).
- **FR-002:** The scanner collects manufacturer, model, CPU model name, CPU core count, total RAM in GB, and for each internal storage device its type (HDD, SATA SSD, NVMe SSD, or unknown) and capacity in GB.
- **FR-003:** When available, the scanner also collects storage health status, battery design capacity and full-charge capacity (giving a battery health percentage), the Windows version, and the BIOS release date as an age hint.
- **FR-004:** Any field that cannot be read is reported as `null`. The payload's `scan_status` is `partial` when at least one field is `null` and `complete` otherwise. A single unreadable field never aborts the scan.
- **FR-005:** The payload contains no serial numbers, UUIDs, user names, host names, network identifiers (MAC or IP), or file contents.
- **FR-006:** The scanner writes the payload to a local JSON file next to the executable before uploading, and tells the user where that file is.
- **FR-007:** The scanner uploads the payload over HTTPS to a backend URL fixed at build time. The backend accepts payloads that match the versioned device schema and rejects others with an error message naming the invalid fields.
- **FR-008:** For each accepted upload, the backend stores one device record. It returns a device ID made from at least 128 bits of cryptographically secure randomness, together with the device page URL.
- **FR-009:** After a successful upload, the scanner shows the device page URL and opens it in the default browser. If the upload fails, it shows a readable error and the local JSON path, and exits with a non-zero code.
- **FR-010:** The device page at the device URL shows all scanned fields in plain language. Fields that are `null` appear as "Unknown".
- **FR-011:** Requesting a device URL with an unknown or malformed ID shows a "device not found" page. No endpoint lists or enumerates devices.
- **FR-012:** The website landing page explains what the scanner does and what data it collects, and offers the scanner executable for download.

## Non-functional requirements and constraints

- **Privacy:** Collect only the fields above. The device link is the only access control, so the ID must be unguessable; never log full device IDs together with request IPs.
- **Performance:** A scan on typical demo hardware should finish in under 30 seconds, excluding upload time.
- **Compatibility:** Windows 10 and 11, x64. Reading battery or disk health may need data sources that are unavailable without admin rights; the scanner degrades to `null` rather than requesting elevation.
- **Security:** The scanner contains no secrets (in particular, no LLM API key). The backend validates and size-limits input before storing it.
- **Schema:** The device JSON schema is versioned (`schema_version`) so features 002–005 can rely on it.

## User journeys and edge cases

1. **Happy path:** The owner opens the website, reads what is collected, downloads the exe, and runs it. A console window shows progress and then the link, and the browser opens the device page.
2. **Partial scan:** On a desktop PC there is no battery, so battery fields are `null`, `scan_status` is `partial`, and the page shows "Unknown" for battery.
3. **Offline / backend down:** The upload fails. The scanner prints the error and the path of the saved JSON and exits non-zero; the owner can rerun it later.
4. **Rescan:** Running the scanner again creates a new record and a new link; the old link keeps working.
5. **Link guessing:** A visitor changes characters in a device URL and gets "device not found", with no hint that other IDs exist.
6. **SmartScreen:** An unsigned exe may trigger a Windows SmartScreen warning. The landing page explains how to proceed. Code signing is out of scope.

## Proposed technical approach

Not yet adopted; to be confirmed during implementation.

- **Repository layout (folders created 2026-11-20 at the user's request):** `scanner/` (Go), `server/` (TypeScript, Node), `web/` (React + TypeScript, proposed Vite build), and `shared/` for the device JSON schema, which both the server and the web app use. `corpus/`, `data/`, and `demo/` hold data for features 002, 003, and 005.
- **Scanner:** Go querying WMI/CIM (`Win32_ComputerSystem`, `Win32_Processor`, `Win32_PhysicalMemory`, `MSFT_PhysicalDisk` for media and bus type and health, `Win32_Battery` / `BatteryFullChargedCapacity` / `BatteryStaticData` for capacities, `Win32_BIOS` for the release date), with `powercfg /batteryreport` as a fallback for battery capacity. Each collector is isolated so a failure yields `null`. Parsing and normalization are pure functions with unit tests on recorded WMI output fixtures. The backend URL is injected via `-ldflags` at build time.
- **Backend:** A Node HTTP framework (e.g. Fastify) with JSON Schema validation (e.g. Ajv) of the shared schema, and SQLite storage (e.g. `better-sqlite3`). Device IDs are 22-character base64url strings from `crypto.randomBytes(16)`. Upload body limit around 32 KB.
- **Web:** React routes `/` (landing and download) and `/d/:id` (device page) fetching `GET /api/devices/:id`.
- **Tests:** Go unit tests for the parsers and the privacy filter; backend integration tests for upload, validation, ID format, and not-found; a component test for the device page's rendering of "Unknown".

## Dependencies and risks

- **Dependency:** Access to at least one Windows laptop for manual verification (demo models are still undecided; see feature 002).
- **Risk:** WMI battery and disk-health classes vary by vendor and may need admin rights, so those fields may often be `null`. Mitigation: graceful `null` handling, and the ranking in feature 003 treats unknowns as lower confidence.
- **Risk:** Antivirus or SmartScreen may flag an unsigned Go exe. Mitigation: guidance on the landing page; signing deferred.
- **Risk:** The schema may need fields that features 002–003 discover later. Mitigation: `schema_version` and additive changes.

## Review and integration

- **Completion boundary:** Locally verified handoff with self-review. Public deployment of this functionality is owned by feature 005.
- **Review:** Self-review of the final diff against this plan (privacy fields in particular), recorded in `ACCEPTANCE_CRITERIA.md`. No independent reviewer is required by repository policy; the team may review informally.
- **CI/merge:** No CI exists yet. The required local checks are Go tests, server tests, web tests, and type checks. Pushing and merging need user authorization.

## Release and recovery (when applicable)

Not applicable to this feature: release and hosting are owned by feature 005 (`feature-005-public-demo-deployment`).

## Assumptions and open questions

- The scanner only needs to support x64 Windows 10/11; ARM Windows is out of scope.
- **Open:** Exact WMI sources for battery and disk health on the demo models; decided during implementation and recorded here.
- **Open:** Whether the scanner shows a console UI only or a minimal GUI. Default: console UI.
- Demo model choice (blocking for feature 002, not for this feature).

## Scope change log

| Date       | Change                 | User approval                                                                                     |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Initial approved scope | User replied "accept" to the five-feature MVP proposal in the specification conversation, 2026-11-20 |

## Related and superseded features

None. This is the first feature. Features 002–005 depend on its device schema and device page.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: None yet
- Product context: [`docs/PRODUCT.md`](../../PRODUCT.md); terms: [`docs/GLOSSARY.md`](../../GLOSSARY.md)
- Next features: [002](../feature-002-knowledge-base-retrieval/PLAN.md), [003](../feature-003-five-path-ranking/PLAN.md), [004](../feature-004-explained-report/PLAN.md), [005](../feature-005-public-demo-deployment/PLAN.md)
