# Design: Five-path assessment and ranking

- **Feature ID:** `feature-003-five-path-ranking`
- **Status:** Implemented for T-002, T-004, T-005, T-006 (2026-11-20); the assessment API (T-007) is not built yet.

This document explains the gate rules, the calculator, the scoring rubrics, and the confidence rules, so the team and the judges can check them without reading code. Scope and requirements stay in [`PLAN.md`](./PLAN.md). The code is in [`server/src/assessment/`](../../../server/src/assessment/), the weights in [`config/weights.yaml`](../../../config/weights.yaml), and the figures in [`data/impact.yaml`](../../../data/impact.yaml).

## Pipeline

`assess()` takes the scan, the intended use, the retrieval's `model_evidence`, the extracted facts, the impact table, and the weights, and returns an `Assessment` (`shared/src/assessment.ts`). It is deterministic. Totals and order are not in the payload: the browser computes them with `rankPaths` (`shared/src/ranking.ts`), so the mode toggle needs no request.

1. **Gates** (`gates.ts`) give each path a status, reasons, and a *plan*: which parts the upgrade buys and whether the battery repair is DIY or professional.
2. **Calculator** (`calculator.ts`) prices the plan as low/high ranges from the impact table.
3. **Scoring** (`scoring.ts`) turns the ranges into four criterion scores and a confidence level.

## Gate rules

**Model evidence.** Without model-specific evidence, hardware facts (`ram_*`, `storage_slots`, `battery_*`) are ignored, even if extraction returned them, so they count as unverified (FR-004). Software support facts come from generic sources such as Microsoft's CPU list and stay usable.

**RAM the use needs:** office 8 GB, study 8 GB, development 16 GB, pass on 8 GB.

| Path | Not suitable when | Conditional when | Otherwise |
| --- | --- | --- | --- |
| Upgrade | Nothing needs upgrading (SSD present, enough RAM), or every needed part is ruled out by a fact (`ram_soldered: all`, `ram_max_gb` below target, no SSD slot) | A needed part cannot be verified (no `storage_slots` or `ram_soldered` fact); RAM stays below the use's target; the CPU is not supported by Windows 11 | Viable |
| Repair (battery) | No battery (or a desktop); battery at or above 80% of design capacity; no replacement part documented | Battery presence or wear unreadable; battery not user-replaceable **or replaceability unknown**: then a professional does the repair; part availability unknown; CPU not supported by Windows 11 | Viable, DIY |
| Pass it on | The CPU is not supported by Windows 11 (no security updates for the next owner) | Windows 11 support unknown; a drive reports unhealthy | Viable |
| Salvage | No reusable part identified (no healthy SSD, all RAM soldered) | Reusable parts cannot be verified (laptop without a `ram_soldered` fact); the device can still be used whole (pass it on is not ruled out) | Viable |
| Recycle | Never | Any of upgrade, repair, or pass it on is still possible (reuse comes before recycling) | Viable |

**Upgrade plan.** If there is an HDD, a failing drive, or the drive type is unknown, the upgrade adds a 500 GB SSD: NVMe when the model has an NVMe-capable M.2 slot, otherwise SATA. While the slot is unknown, it is priced as the more expensive SATA SSD. When RAM is below the target, the upgrade adds an 8 GB module (up to 8 GB missing) or a 16 GB one, or replaces a module with a 16 GB one when every slot is taken.

**Safety (FR-006).** A battery that is not documented as user-replaceable is never sent to the owner. The reason text tells them to use a repair shop and not to open or pierce the battery. The scan has no swelling signal yet; a swelling indicator would need a new scan or user-input field.

## Calculator

The baseline is "the owner buys a comparable new laptop now", or a new desktop when the form factor is desktop (`new_laptop.*` or `new_desktop.*`). Each path's CO₂e has three ranges: the path's own emissions, the baseline, and `avoided_vs_baseline`, computed by interval arithmetic:

| Displacement | Credited baseline | Used by |
| --- | --- | --- |
| `assumed` | Whole baseline: `avoided = [B.low − P.high, B.high − P.low]` | Upgrade and repair when the owner keeps the device |
| `conditional` | Only the high end: `avoided = [−P.high, B.high − P.low]` | Pass it on; upgrade and repair when the use is "pass to someone else" |
| `none` | Nothing: `avoided = [−P.high, −P.low]` | Salvage, recycle |

Upgrade emissions are the parts' production emissions (SSD, RAM module), and the cost is their sample prices. A professional battery repair adds `service.battery_replacement.price` (still a placeholder). Salvage and recycle cost the end-of-life processing. Extra useful life comes from `life_extra.<path>.<use>`. Every assumption lists the entries it used, so each figure traces back to `data/impact.yaml`.

## Scoring rubrics (0–100 each)

Each criterion comes from exactly one source, so lifespan is not counted twice: it affects the useful-life score, not the CO₂e credit.

| Criterion | Rubric |
| --- | --- |
| Environment | Midpoint of `avoided_vs_baseline` as a share of the baseline midpoint, clamped to 0–100. Conditional displacement therefore scores about half of an assumed one. |
| Useful life | Midpoint of the extra-life range divided by 4 years (the top of the table's ranges). Halved when the device's RAM stays below what the intended use needs after the plan (upgrade or repair). |
| Economic | `1 − owner's cost / new-device price` (midpoints). If the owner wants to keep using a computer (any use except "pass to someone else") and the path gives this one away (pass it on, salvage, recycle), the price of a new device is added to the cost. |
| Feasibility | Fixed per path: upgrade with one part 70, with two parts 60; DIY battery repair 65, professional 60; pass it on 85; salvage 40; recycle 95. Minus 20 when the path is conditional. |

The total is the weighted sum with the illustrative weights (Environment first 45/25/10/20, Money first 15/20/45/20). The ranked view lists viable paths by total, then conditional ones, then not-suitable ones (`rankPaths`).

**Example (fixture laptop: HDD, 8 GB, battery at 72%, user-replaceable; office use).** Battery repair is viable and leads in both modes (Environment first about 80, Money first about 80), followed by the SSD upgrade (69 and 77). Pass it on scores 0 on economics for an owner who still needs a computer, and recycling is conditional because the laptop can still be used.

## Confidence

Each path starts at high and loses one level per finding (two for missing model evidence): 0 = high, 1 = medium, 2 or more = low. The findings are listed as reasons:

- No model-specific documentation (upgrade, repair, and salvage only, counts twice).
- Unreadable scan fields the path depends on (for example RAM slots for upgrade, battery wear for repair).
- A battery reporting exactly 100% (some firmware reports this regardless of wear).
- A placeholder impact entry is used.
- An impact entry with a wide range (high ≥ 3 × low), for example battery prices.
- Conditional displacement (the saving depends on the recipient).

## Known limitations

- Repair covers the battery only. A failing drive is handled by the upgrade path (replacing it with an SSD).
- RAM is priced as DDR4 for every memory type; other types get an assumption saying so.
- The team's component spreadsheet (v6) was used as a cross-check for the impact table, not as a source; see `data/impact.yaml`.
- The scores are not yet checked on real demo devices (T-009).
