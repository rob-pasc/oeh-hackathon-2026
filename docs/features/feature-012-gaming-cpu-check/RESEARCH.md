# Research: Processor threshold for gaming

- **Feature ID:** `feature-012-gaming-cpu-check`
- **Date:** 2026-11-21

Findings behind the processor rule of [feature 012](./PLAN.md). Decisions live in the plan; this records the evidence and its limits.

## Sources checked

| Source | What it says | How checked |
| --- | --- | --- |
| Valve, Counter-Strike 2 store listing ([store.steampowered.com/app/730](https://store.steampowered.com/app/730/)) | Minimum processor: "4 hardware CPU threads - Intel® Core™ i5 750 or higher" | Valve's public store API (`/api/appdetails?appids=730`), 2026-11-21 |
| Epic Games, "What are the system requirements for Fortnite on PC?" ([epicgames.com help](https://www.epicgames.com/help/c-202300000001636/a202300000012731)) | Minimum processor: Core i3-3225 3.3 GHz; at the minimum the game runs, "probably not on the highest settings" | Web search of Epic's help centre, 2026-11-21 |
| Intel, Core i3-3225 ([intel.com SKU 65692](https://www.intel.com/content/www/us/en/products/sku/65692.html)) | 2 cores, 4 threads, 3.30 GHz base, no turbo listed, 55 W desktop | Web search of Intel's product page; third-party databases agree |
| Intel, Core i3-5005U ([intel.com SKU 84695](https://www.intel.com/content/www/us/en/products/sku/84695.html)) | 2 cores, 4 threads, 2.00 GHz base; no turbo (third-party databases) | Web search of Intel's product page |
| Steam Hardware & Software Survey, July 2026 (via [Tom's Hardware](https://www.tomshardware.com/pc-components/16gb-gpus-and-8-core-cpus-officially-become-the-most-popular-configs-on-steam-latest-hardware-survey-shows-modern-gamings-growing-hunger-for-more-resources)) | 8 cores 27.85 %, 6 cores 27.52 %, 4 cores 13.12 % of surveyed machines | Secondary press coverage; Valve's page was not readable in the search. Context only, not used in the rule |

## Findings

- A plain "fewer than 4 cores" rule would contradict Fortnite's official minimum, which is a dual-core (i3-3225).
- Two widely played games set comparable floors: 4 hardware threads (Counter-Strike 2), and a 2-core, 4-thread desktop chip at 3.3 GHz (Fortnite).
- The scanner reports `cpu.name` (on Intel usually ending in "@ X.XXGHz", the base clock), `cores` and `threads`. It reports no turbo clock or generation.

## Limits

- The clock in an Intel name is the base clock. Newer dual-core laptop chips with a high turbo clock (for example 10th or 11th generation U chips) can be faster than the i3-3225 in short bursts, but count as too weak under rule (b). AMD and Apple names usually carry no clock, so only rule (a) applies to them.
- Architecture improvements per clock are not considered; no benchmarks are used (feature 003 exclusion).
