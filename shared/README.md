# shared

The data contracts between the scanner, server, and web app. They are defined with TypeBox and exported as JSON Schema 2020-12 ([ADR-001](../docs/adr/adr-001-shared-contracts-typebox.md)). Keys are snake_case.

## Contracts

| Contract | File | Producer → consumer | Feature |
|---|---|---|---|
| `DeviceScan` (v1) | `src/device.ts` | scanner → server | 001 |
| `UploadResponse`, `DeviceRecord`, `ApiError` | `src/device.ts` | server → scanner and web | 001 |
| `Passage`, `RetrievalResult` | `src/retrieval.ts` | retrieval → assessment and report (server-internal) | 002 |
| `Fact`, `FactSet` | `src/facts.ts` | fact extraction → gates (server-internal) | 003 |
| `Assessment` | `src/assessment.ts` | server → web | 003 |
| `Report`, `StreamEnd`, SSE events | `src/report.ts` | server → web | 004 |
| `ScanSession`, `ScannerEvent`, `ScanSessionEvent`, `SessionId` | `src/session.ts` | server ↔ web and scanner | 006 |
| Routes | `src/api.ts` | all | 001–004, 006 |

Helpers:

- `src/invariants.ts`: cross-field checks that JSON Schema cannot express.
- `src/ranking.ts`: `rankPaths`, `totalScore` and `recommendedPath`, so that the server and the browser's mode toggle agree on the order.
- `src/validate.ts`: `createValidator(schema)` for code outside Fastify.

### Key rules

- **Unknown is `null`, never omitted.** Every scan field the scanner may fail to read is required and nullable.
- **No identifying data.** Every object rejects extra properties, so serial numbers, UUIDs, host or user names, and MAC addresses fail validation. Don't add such fields.
- **Not-suitable paths have `scores: null` and `impact: null`.** Viable and conditional paths have both.
- **Totals are not sent.** The web app computes them with `rankPaths(assessment.paths, assessment.weights[mode])`.
- **CO₂e per path:** `path` (emissions this path causes), `baseline` (buying new), and `avoided_vs_baseline` (the credited baseline minus `path`). `displacement` says how much of the baseline is credited:
  - `assumed`: credited in full;
  - `conditional`: credited only at the high end, so `low <= 0`;
  - `none`: not credited, so `high <= 0`.
- **Scan sessions:** `session_id` in `DeviceScan` is optional (absent, never `null`), so it does not affect `scan_status`. The server removes it before storing. The downloaded scanner ends with `SCANNER_SESSION_MARKER` + the session ID (37 bytes).
- **The report stream** is `GET /api/devices/:id/report?intended_use=…`. It sends the events `assessment`, `report` and `end`, or `error` instead.

## Fixtures

`fixtures/` holds **fictional** examples ("Example Laptop 14", `example.org` sources) that are valid under the schemas and invariants. Use them as mocks until the real endpoints exist. They are not real data and must never be shown as such.

| Fixture | Shows |
|---|---|
| `device-scan.laptop-complete.json` | A complete laptop scan |
| `device-scan.desktop-partial.json` | A desktop with no battery, unreadable fields, and a disk warning |
| `passages.json`, `retrieval.example-laptop-14.json`, `facts.example-laptop-14.json` | Retrieval and extracted facts |
| `assessment.example-laptop-14.office.json` | All paths assessed; the order changes between modes |
| `assessment.example-desktop-unknown.development.json` | Unknown model: conditional and not-suitable paths |
| `report.example-laptop-14.office.json` | An explained report with citations |

## Commands

Run from the repository root:

```sh
npm install                 # once
npm test -w shared          # schema, invariant, ranking, and exported-schema tests
npm run typecheck -w shared
npm run build -w shared     # emits dist/ for the server and web app
npm run schemas -w shared   # re-export schemas/*.schema.json after changing src/
```

## Changing a contract

1. Agree on the change with the sub-teams that produce and consume it. Then edit `src/`.
2. Run `npm run schemas -w shared`, update the fixtures and tests, and run `npm test -w shared`.
3. Additive changes (a new nullable field, a new fact key) keep the version. Removing or renaming a field, or changing its meaning, bumps `DEVICE_SCAN_SCHEMA_VERSION` for the scan payload. For server ↔ web contracts, change both sides in the same change.
4. If the change alters a feature's observable behavior, update that feature's plan.
