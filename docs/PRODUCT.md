# Product Context

Second Life Scanner is an ÖH Hackathon 2026 project for the theme **AI for Green**. No capabilities are implemented yet; this document records the agreed direction from the approved MVP specification (2026-11-20).

## Purpose and users

Most of a laptop's carbon footprint comes from manufacturing, so extending its use avoids emissions, but old devices usually end up in a drawer or as e-waste because checking their options takes time and know-how. Second Life Scanner scans an old Windows laptop and ranks five possible next lives (upgrade, repair, pass it on, salvage for parts, recycle) with sourced evidence and honest cost and CO₂e ranges.

- **Primary user:** an individual owner of an old Windows laptop or PC.
- **Other stakeholders:** hackathon judges and demo audience. IT departments and refurbishers are possible future users and are not targeted by the MVP.

## Core journeys (approved, not yet implemented)

1. Download and run the scanner, then open the private device link. See [feature 001](features/feature-001-device-scan-and-upload/PLAN.md).
2. Choose an intended use, see five assessed and ranked paths, and switch between Environment first and Money first. See [feature 003](features/feature-003-five-path-ranking/PLAN.md).
3. Read the explained report with cited evidence and next steps. See [feature 004](features/feature-004-explained-report/PLAN.md).

## Product principles and constraints

- **Evidence over assertion:** technical claims need a cited source; when evidence is missing, the report says so ("cannot verify").
- **Honest impact:** CO₂e is shown as ranges against an explicit baseline and never summed across alternative paths. Weights are illustrative.
- **Safety first:** infeasible or unsafe paths are marked, never scored attractively, and hazardous self-repair is never recommended.
- **Data minimization:** only the hardware facts needed are collected, with no accounts, serial numbers, or personal files.
- **Narrow and deep:** one OS (Windows) and 2–3 demo laptop models, supported well.

## Deliberate non-goals (MVP)

Scanning on macOS, Linux, or a bootable USB; user accounts; a fleet dashboard (deferred, may be specified later); live price scraping or purchasing; recycler or partner integrations; a full lifecycle assessment.

## Uncertainty and references

- Unresolved: demo laptop models, hosting provider, CO₂e sources. These are tracked in the feature plans.
- Source material: the team's `Idea.md` and `Suggestions.md` (outside this repository).
- Terms: [GLOSSARY.md](GLOSSARY.md). Feature navigation: [features/INDEX.md](features/INDEX.md).

## Maintenance

Update this reference when approved product direction or implemented core journeys change. Feature scope stays in each feature's `PLAN.md`.
