# Feature 010: Step-level knowledge base

- **Feature ID:** `feature-010-step-level-knowledge-base`
- **Scope status:** Approved by user
- **Scope approval date:** 2026-11-21

> This file records _scope and intent_, not a claim that a technical design has been accepted. Track progress in `TASKS.md`, not here.

## Summary

The step plans of [feature 009](../feature-009-concrete-step-plans/PLAN.md) only keep technical steps that cite a source, so they are only as good as the knowledge base. This feature researches and adds sources with step-by-step procedures for the three demo models (ThinkPad T480, Dell XPS 13 9360, HP EliteBook 840 G5). It also adds sources for the general steps every plan needs (back up, wipe, reinstall, hand down) and for local Austrian offers (repair, donation, drop-off). All documents go through the existing manifest and `corpus:ingest` flow of [feature 002](../feature-002-knowledge-base-retrieval/PLAN.md).

## Problem and desired outcome

- **Problem:** The corpus has 31 documents, but procedures exist only for some parts (for example T480 RAM, XPS SSD, 840 G5 battery and RAM). Many technical steps would have no source and would be removed.
- **Desired outcome:** For each demo model, the common options (storage, memory where it is not soldered, battery) and the general and local steps have citable procedures.
- **Target users / stakeholders:** The team curating the corpus; owners reading the plans; judges checking the sources.

## Approved scope

### In scope

- Researching and adding step-level procedure sources for the three demo models.
- Adding sources for general steps and for Austrian repair, donation and drop-off offers.
- Recording sources that were considered and rejected (for example because of their terms) and the coverage that remains missing.

### Out of scope

- Changing ingestion, chunking, or retrieval behaviour (feature 002) or the step logic (feature 009).
- Models other than the three demo models.
- Sources that the manifest's terms check does not allow.
- Machine translation of German-language sources; they are added in their original language, as existing Austrian sources are.

## Functional requirements

- **FR-001:** For each demo model, the corpus contains at least one source with step-by-step instructions for each of: removing the bottom cover, replacing the storage drive, and replacing the battery or stating that it is a service part. The T480 and the EliteBook 840 G5 also have a source for adding or replacing RAM. For the XPS 13 9360, a source states that the RAM is soldered.
- **FR-002:** The corpus contains generic sources with steps for backing up files, resetting Windows with all data removed, and installing or reinstalling Windows.
- **FR-003:** The corpus contains Austrian sources with steps or contact details for at least one repair offer (for example a repair café network or the repair bonus), one donation offer for working laptops, and the free drop-off of e-waste and batteries.
- **FR-004:** Every added document has a complete manifest entry under feature 002 FR-001, including the terms/licence note and access date, and `npm run corpus:ingest -w server` accepts the corpus without errors.
- **FR-005:** The coverage check output after ingestion is recorded, together with the remaining gaps per demo model and option kind.
- **FR-006:** A research record lists each source considered, whether it was added or rejected, and why.

## Non-functional requirements and constraints

- **Terms and licensing:** Only sources whose terms allow storing excerpts for retrieval with attribution, as required by feature 002. iFixit content is CC BY-NC-SA; its use must stay consistent with the existing iFixit entries' terms notes.
- **Size:** The corpus stays small enough for keyword retrieval to remain fast (the current index builds in seconds).

## User journeys and edge cases

- **Owner opens "Add 8 GB RAM" on a T480:** the step plan can cite the T480 hardware maintenance manual and the iFixit guide for each step.
- **No suitable source with acceptable terms:** the gap is recorded (FR-005, FR-006), and feature 009 will flag or remove the affected steps.
- **Source only available as PDF:** converted to Markdown as the existing corpus documents are, with the original URL kept.

## Proposed technical approach

Use the existing curation conventions in [`corpus/README.md`](../../../corpus/README.md): one Markdown file per source in `corpus/docs/`, a manifest entry with applicability per demo model, then `corpus:ingest` and its coverage report. Start from the documents already present (`lenovo-t480-hmm.md`, `dell-xps13-9360-service-manual.md`, `hp-elitebook-840-g5-msg.md`, the iFixit guides, `ms-reset-your-pc.md`, the Austrian sources) and fill the gaps they leave. Record findings in a `RESEARCH.md` in this folder.

## Dependencies and risks

- Web access is needed for research; some vendor sites refuse automated fetching (the HP Windows 11 list already failed, see feature 002).
- Terms may rule out the best procedural sources.
- Feature 009 benefits from this feature but does not need it to be built; this feature can run in parallel with 008 and 009.

## Review and integration

Completion boundary: locally verified handoff, with self-review of the added documents and manifest entries. Required checks: `npm run corpus:ingest -w server` and `npm test` (the corpus tests). Pushing, opening a PR, and merging need the user's request.

## Release and recovery (when applicable)

Not applicable: corpus changes take effect after re-running ingestion; no deployment exists yet.

## Assumptions and open questions

- Assumes the existing iFixit terms note covers additional iFixit guides; to be confirmed during research.
- Open: whether the team wants to propose specific sources they already know.

## Scope change log

| Date       | Change                 | User approval                                                                                                                                              |
| ---------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21 | Initial approved scope | User chose "Include a curation task" for extending the knowledge base and replied "accept" to the proposal and the three-feature split, 2026-11-21 |
| 2026-11-21 | Renumbered from feature 009 to feature 010 when merging into `main`, because `feature-007-macos-linux-scanner` already held 007 there and the three features shifted together (docs/workflow/ALLOCATION.md, duplicate numbers). Requirement, acceptance and task IDs, scope and history are unchanged. | User asked to merge the branches into `main`, 2026-11-21 |

## Related and superseded features

- [`feature-002-knowledge-base-retrieval`](../feature-002-knowledge-base-retrieval/PLAN.md): extends the corpus under its manifest rules (FR-001, FR-002) and its coverage check. No requirement of feature 002 is replaced. Feature 002 T-007 (curating the real corpus) remains open for its own gap (the 840 G5 7th-gen CPU).
- [`feature-009-concrete-step-plans`](../feature-009-concrete-step-plans/PLAN.md) cites these sources.

## References

- Acceptance criteria: [`ACCEPTANCE_CRITERIA.md`](./ACCEPTANCE_CRITERIA.md)
- Implementation tasks: [`TASKS.md`](./TASKS.md)
- Related ADRs: [ADR-004](../../adr/adr-004-keyword-retrieval-sqlite-fts5.md) (the corpus format and retrieval this feature extends)
- Corpus conventions: [`corpus/README.md`](../../../corpus/README.md)
