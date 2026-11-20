# Project Glossary

| Term | Meaning in this project | Notes / related terms |
| ---- | ----------------------- | --------------------- |
| Path | One of the five possible next lives for a device: **upgrade**, **repair**, **pass it on**, **salvage for parts**, **recycle**. | Contract keys: `upgrade`, `repair`, `pass_on`, `salvage`, `recycle`. Also called "action" or "outcome" in early notes. |
| Intended use | The owner's planned use, chosen before ranking: office/browsing, school/university, programming/development, pass to someone else. | Contract keys: `office`, `study`, `development`, `pass_on`. Changes the rubrics and baseline assumptions. |
| Suitability status | The per-path result of the gates: `viable`, `conditional` (possible but unverified or needing professional help), or `not_suitable` (contradicted by a verified fact or unsafe). | Not-suitable paths have no score. |
| Gate | A deterministic feasibility or safety rule applied before scoring. | Feature 003 |
| Fact | A structured device property (for example RAM soldered) extracted from retrieved passages; valid only with a passage citation. | Feature 003 FR-002 |
| Passage | A citable chunk of a curated corpus document, with its title, URL, section or page, applicability, and access date. | Feature 002 |
| Model-specific / generic | Whether a document applies to an exact manufacturer and model, or to devices in general. | `model_evidence: "none"` means no model-specific documents matched. |
| Baseline | The comparison scenario for impact figures: "the owner buys a comparable new laptop now". | All CO₂e and savings are relative to it. |
| Displacement | Whether a path avoids the baseline purchase: `assumed` (fully credited), `conditional` (only if, for example, the recipient would otherwise buy new), or `none`. | Determines `avoided_vs_baseline`; see `shared/README.md`. |
| Impact table | The curated static file of CO₂e ranges, sample prices, and useful-life ranges, each entry with its source. | No live prices. |
| Mode | The weight set used for ranking: **Environment first** or **Money first**. | Contract keys: `environment_first`, `money_first`. Weights are illustrative defaults. |
| Device link | The unguessable URL to a device's page and report; it is the only access control. | No accounts |
| Scan session | The link between one press of Scan now and one scanner run: its random ID is appended to the downloaded scanner, which reports progress to the waiting browser tab. | Feature 006; `shared/src/session.ts`. A bearer secret for progress only, separate from the device ID. |
| Demo device | A pre-scanned device seeded on the public deployment, with cached results. | Feature 005 |
