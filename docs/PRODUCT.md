# Product Context

**leaaf** (Lifecycle Evaluation and Action Finder) is an ÖH Hackathon 2026 project for the theme **AI for Green**. The local result journey covers assessment, ranking, and AI-chosen categories and options with cited reasons (feature 008), including a five-path fallback. See the [README status](../README.md). The scanner has run from the live site on Windows, macOS and Linux (2026-11-21). Some edge paths are still open. Scanners for macOS and Linux ([feature 007](features/feature-007-macos-linux-scanner/PLAN.md)) are implemented, and their live runs worked. This document records the agreed direction from the approved MVP specification (2026-11-20).

## Purpose and users

Most of a laptop's carbon footprint comes from manufacturing, so extending its use avoids emissions, but old devices usually end up in a drawer or as e-waste because checking their options takes time and know-how. leaaf scans an old Windows, Mac or Linux laptop and ranks five possible next lives (upgrade, repair, pass it on, salvage for parts, recycle) with sourced evidence and honest cost and CO₂e ranges. Since [feature 008](features/feature-008-ai-categories-and-options/PLAN.md), an AI groups concrete options for the device into categories (for example "Faster storage" or "Hand it down"), and the five paths remain the basis and the fallback.

- **Primary user:** an individual owner of an old Windows laptop or PC, and since feature 007 of an old Mac or Linux laptop.
- **Other stakeholders:** hackathon judges and demo audience. IT departments and refurbishers are possible future users and are not targeted by the MVP.

## Core journeys (approved; journey 1 built and partly verified on Windows, journey 2 built for six intended uses, journey 3 locally verified)

1. Download and run the scanner, then open the private device link. See [feature 001](features/feature-001-device-scan-and-upload/PLAN.md).
2. Choose an intended use, see five assessed and ranked paths, and switch between Environment first and Money first. See [feature 003](features/feature-003-five-path-ranking/PLAN.md). Since feature 008 (implemented locally 2026-11-21), the result screen shows ranked AI categories with concrete options instead, and falls back to the five paths when the AI is unavailable.
3. Read the explained report with cited evidence and next steps. See [feature 004](features/feature-004-explained-report/PLAN.md). Since feature 008, each option explains why it fits with up to two cited sources; concrete next steps are planned in [feature 009](features/feature-009-concrete-step-plans/PLAN.md).

## Product principles and constraints

- **Evidence over assertion:** technical claims need a cited source; when evidence is missing, the report says so ("cannot verify").
- **Honest impact:** CO₂e is shown as ranges against an explicit baseline and never summed across alternative paths. Weights are illustrative. Figures the AI estimates (feature 008) are always labelled "AI estimate".
- **Safety first:** infeasible or unsafe paths are marked, never scored attractively, and hazardous self-repair is never recommended. *(2026-11-21: for AI-chosen options of feature 008 this rests on the prompt and the demo review, not on server rules; see [ADR-003](adr/adr-003-ai-chosen-options.md). Since feature 011, SSD, RAM and battery options are capped at the rule-based status, see [ADR-007](adr/adr-007-gate-cap-for-ai-part-options.md).)*
- **Data minimization:** only the hardware facts needed are collected, with no accounts, serial numbers, or personal files.
- **Narrow and deep:** 2–3 demo laptop models, supported well. *(2026-11-21: originally also one OS, Windows. [Feature 007](features/feature-007-macos-linux-scanner/PLAN.md) adds macOS 12+ and x64 Linux scanning; the knowledge base still has no Mac sources, so Mac-specific evidence reads "cannot verify".)*

## Deliberate non-goals (MVP)

Scanning on a bootable USB (macOS and Linux scanning moved into scope with feature 007); user accounts; a fleet dashboard (deferred, may be specified later); live price scraping or purchasing; recycler or partner integrations; a full lifecycle assessment.

## Uncertainty and references

- Domain: `leaaf.green` (registered by the team). `v0.5.0` is live there since 2026-11-21, on the team's own server in Vorarlberg.
- Demo laptop models (ThinkPad T480, XPS 13 9360, EliteBook 840 G5) and keyword-only retrieval were chosen on 2026-11-20 ([feature 002](features/feature-002-knowledge-base-retrieval/PLAN.md)).
- Hosting: the team's own server behind an external Caddy ([feature 005](features/feature-005-public-demo-deployment/PLAN.md)). CO₂e sources were chosen on 2026-11-20 (see [`data/README.md`](../data/README.md)).
- Source material: the team's `Idea.md` and `Suggestions.md` (outside this repository).
- Terms: [GLOSSARY.md](GLOSSARY.md). Feature navigation: [features/INDEX.md](features/INDEX.md).

## Maintenance

Update this reference when approved product direction or implemented core journeys change. Feature scope stays in each feature's `PLAN.md`.
