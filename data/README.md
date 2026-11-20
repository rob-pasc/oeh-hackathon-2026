# data

Curated static data used by the assessment ([feature 003](../docs/features/feature-003-five-path-ranking/PLAN.md)).

## `impact.yaml`

The static impact table (FR-007): CO₂e ranges for a new laptop and desktop (the baseline) and for the parts used by upgrades and repairs, part and device prices, path process emissions, and extra-useful-life ranges per path and intended use. Each entry has a low/high range, a unit (`kg_co2e`, `eur`, `years`), a status, its sources with access dates, and a `derivation` showing how the range follows from the sources.

- **Status:** `sourced` (derived from the sources), `assumption` (a modelling assumption informed by the sources), or `placeholder` (no source yet). Placeholders fail the coverage check.
- **Boundaries:** production emissions are cradle-to-gate plus distribution. End of life carries no recycling credits. Reuse figures follow Fraunhofer IZM's 2022 recommendation to cite ADEME (2022).
- **Scope:** a typical 14-inch Windows laptop, because the demo models are not chosen yet. Model-specific entries (for example the exact battery) are added with the demo models (T-008).
- **Prices:** Austrian and German retail in EUR incl. VAT, checked 2026-11-20. RAM and SSD prices are inflated by the 2025–2026 memory shortage; recheck them before the demo.
- **Team research:** the team's component research (spreadsheet v6) was cross-checked. Where the sources disagreed, the entry was changed and its `notes` record the earlier estimate.

`npm test -w server` validates the file (shape, `low <= high`, known sources, no unused sources) and reports entries that are still placeholders. The server loads it with `loadImpactTable()` from `server/src/impact/table.ts`, which fails on any problem.

**Open:** `service.battery_replacement.price` (professional repair labour) is still a placeholder. Austria's Geräte-Retter-Prämie (50% of repair costs, up to EUR 130, vouchers until the end of 2026) is noted but not modelled.
