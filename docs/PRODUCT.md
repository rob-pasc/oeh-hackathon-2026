# Product Context

**leaaf** (Lifecycle Evaluation and Action Finder) is an ÖH Hackathon 2026 project for the theme **AI for Green**. The local result journey covers assessment, ranking and explained reports, including a template fallback. See the [README status](../README.md). The scanner has completed one elevated scan on a real Windows 11 laptop. The other Windows checks are still open. This document records the agreed direction from the approved MVP specification (2026-11-20).

## Purpose and users

Most of a laptop's carbon footprint comes from manufacturing, so extending its use avoids emissions, but old devices usually end up in a drawer or as e-waste because checking their options takes time and know-how. leaaf scans an old Windows laptop and ranks five possible next lives (upgrade, repair, pass it on, salvage for parts, recycle) with sourced evidence and honest cost and CO₂e ranges.

- **Primary user:** an individual owner of an old Windows laptop or PC.
- **Other stakeholders:** hackathon judges and demo audience. IT departments and refurbishers are possible future users and are not targeted by the MVP.

## Core journeys (approved; journey 1 built and partly verified on Windows, journey 2 built for six intended uses, journey 3 locally verified)

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

- Domain: `leaaf.green` (registered by the team; nothing is deployed yet).
- Demo laptop models (ThinkPad T480, XPS 13 9360, EliteBook 840 G5) and keyword-only retrieval were chosen on 2026-11-20 ([feature 002](features/feature-002-knowledge-base-retrieval/PLAN.md)).
- Unresolved: the VPS provider (the host type, a VPS behind an external Caddy, is decided). These are tracked in the feature plans. CO₂e sources were chosen on 2026-11-20 (see [`data/README.md`](../data/README.md)).
- Source material: the team's `Idea.md` and `Suggestions.md` (outside this repository).
- Terms: [GLOSSARY.md](GLOSSARY.md). Feature navigation: [features/INDEX.md](features/INDEX.md).

## Maintenance

Update this reference when approved product direction or implemented core journeys change. Feature scope stays in each feature's `PLAN.md`.
