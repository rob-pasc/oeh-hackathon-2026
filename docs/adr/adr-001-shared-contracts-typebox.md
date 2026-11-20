# ADR-001: Define shared data contracts with TypeBox and export JSON Schema

- **Status:** Accepted
- **Date adopted:** 2026-11-20
- **Related feature(s):** [001](../features/feature-001-device-scan-and-upload/PLAN.md), [002](../features/feature-002-knowledge-base-retrieval/PLAN.md), [003](../features/feature-003-five-path-ranking/PLAN.md), [004](../features/feature-004-explained-report/PLAN.md)
- **Supersedes:** None

## Context

Four parts of the system exchange data: the Go scanner, the TypeScript/Node server, the React web app, and the fixtures that sub-teams use to work in parallel during the hackathon. Each contract needs one source of truth that:

- gives TypeScript types to the server and the web app;
- validates requests in the server (Fastify validates with Ajv and JSON Schema);
- can be checked from Go, without a TypeScript toolchain in the scanner build.

## Decision

The contracts are defined once in `shared/src/` with [TypeBox](https://github.com/sinclairzx81/typebox) (the `typebox` 1.x package). TypeBox schemas are plain JSON Schema objects with static TypeScript types.

- `npm run schemas -w shared` exports every top-level contract to `shared/schemas/<Name>.schema.json` (JSON Schema 2020-12). The files are committed. A test fails when they are stale, and another test validates them with strict Ajv 2020-12.
- Schemas in the source carry no `$id`; the exporter adds it at each file's root only, because embedded duplicates break standard validators.
- Go structs are written by hand in `scanner/`. A contract test there must validate the scanner's output against `DeviceScan.schema.json`.
- Rules that JSON Schema cannot express (weights sum to 100, `low <= high`, status-dependent fields, citation consistency) live in `shared/src/invariants.ts`.
- Ordering logic used on both sides (`rankPaths`) lives in `shared/src/ranking.ts`.
- JSON keys use snake_case. The device payload is versioned with `schema_version`; breaking changes bump it.

## Alternatives considered

| Alternative | Benefits | Why not chosen |
| ----------- | -------- | -------------- |
| Zod | Familiar to many React developers; large ecosystem | Needs a conversion step to JSON Schema for Fastify and Go |
| Hand-written JSON Schema files with generated TS types and Go structs | Most language-neutral | Verbose to edit; Go generator support for draft 2020-12 was not confirmed |
| Separate types per component | No shared tooling | Drift between scanner, server, and web; no single place to agree on changes |

## Consequences

- Server validation and web types come straight from one definition, with no conversion layer.
- The Go side has no generated types. Its correctness depends on the contract test against the exported schema, which must be written with the scanner (feature 001 T-003).
- Changing a contract means editing `shared/src`, re-exporting schemas, updating fixtures, and telling the affected sub-teams. See [`shared/README.md`](../../shared/README.md).
- The project depends on TypeBox 1.x, a young major version. Its `Compile`/`Value` APIs differ from the older `@sinclair/typebox` 0.x.

## Implementation / validation references

- `shared/src/*.ts` (contracts), `shared/scripts/export-schemas.ts`, and `shared/test/` (61 passing tests on 2026-11-20, including the strict Ajv check)
- `scanner/internal/scan/schema_test.go`: the Go contract test from the consequences above, validating scanner output against `DeviceScan.schema.json` with `santhosh-tekuri/jsonschema` (test-only dependency, 2026-11-20)
- Decisions taken with the user on 2026-11-20 when the contracts were defined together

## Supersession notes (if applicable)

None.
