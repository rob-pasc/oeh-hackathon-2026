# Acceptance Criteria: Device scan and upload

- **Feature ID:** `feature-001-device-scan-and-upload`
- **Verification status:** Not started

Defines the feature's acceptance criteria and records how each criterion was verified, including results and evidence.

| ID     | Requirement    | Scenario / expected outcome | Verification method | Result  | Evidence |
| ------ | -------------- | --------------------------- | ------------------- | ------- | -------- |
| AC-001 | FR-001         | Given a Windows 10 or 11 x64 laptop and a standard (non-admin) user, when the downloaded exe is run, then it completes without an installer or elevation prompt and reports manufacturer, model, CPU, RAM, and storage. | Manual run on a real Windows laptop as a non-admin user | Not run | |
| AC-002 | FR-002, FR-003 | Given recorded WMI outputs from a laptop with an SSD and a battery, when they are normalized, then the payload contains the correct manufacturer, model, CPU name and cores, RAM GB, storage type and capacity, storage health, battery health %, Windows version, and BIOS date. | Automated scanner unit tests on fixtures | Not run | |
| AC-003 | FR-004         | Given fixture output where the battery and disk-health sources fail or are absent, when normalized, then those fields are `null`, `scan_status` is `partial`, and the remaining fields are still populated. | Automated scanner unit test | Not run | |
| AC-004 | FR-005         | Given fixture output that includes serial numbers, a UUID, a host name, a user name, and a MAC address, when the payload is built, then none of those values appear anywhere in the serialized JSON. | Automated scanner unit test searching the output for the planted values | Not run | |
| AC-005 | FR-006, FR-009 | Given the backend is unreachable, when the scanner runs, then it writes the JSON file next to the exe, prints its path and a readable error, and exits with a non-zero code. | Automated scanner test against an unreachable URL, plus one manual run | Not run | |
| AC-006 | FR-007         | Given a payload with a missing `model` and a string for `ram_gb`, when it is posted to the upload endpoint, then the response is a 4xx naming both fields and no record is stored. | Automated server integration test | Not run | |
| AC-007 | FR-008         | Given two valid uploads, when stored, then each returns a distinct ID of at least 22 base64url characters (≥128 random bits) and a device URL containing that ID. | Automated server integration test, plus code review of the ID source | Not run | |
| AC-008 | FR-009         | Given a reachable backend, when the scanner completes on a real laptop, then it prints the device URL and the default browser opens that page. | Manual run on a real Windows laptop | Not run | |
| AC-009 | FR-010         | Given a stored device with `battery_health_percent: null`, when its device page is opened, then all scanned fields are shown in plain language and battery health reads "Unknown". | Automated web component test, plus manual check in a browser | Not run | |
| AC-010 | FR-011         | Given an unknown ID and a malformed ID, when their device URLs are requested, then both show "device not found", and no API route returns a list of devices. | Automated server and web tests, plus a route inventory review | Not run | |
| AC-011 | FR-012         | Given the landing page, when opened, then it lists the collected data, states what is not collected, and the download link returns the scanner exe. | Manual browser check, plus an automated test that the download route serves the file | Not run | |
| AC-012 | Review         | The final diff is self-reviewed against this plan, with findings and their resolution recorded below. | Self-review | Not run | |

## Result legend

- **Not run:** Not verified yet.
- **Pass:** Verified with evidence recorded above.
- **Fail:** Verified behavior does not meet the criterion.
- **Blocked:** Verification cannot proceed; explain why.

If the user approves changing or waiving a criterion, update the approved scope in `PLAN.md` and document that decision explicitly. Do not silently convert a failing criterion into a pass.

## Review and integration evidence

Completion boundary: locally verified handoff with self-review (see [PLAN.md § Review and integration](./PLAN.md#review-and-integration)). No CI exists; local Go, server, and web tests and type checks are required. Not yet reviewed.

## Verification notes

Not yet verified.
