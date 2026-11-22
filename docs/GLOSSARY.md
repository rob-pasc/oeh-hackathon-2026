# Project Glossary

| Term | Meaning in this project | Notes / related terms |
| ---- | ----------------------- | --------------------- |
| Path | One of the five possible next lives for a device: **upgrade**, **repair**, **pass it on**, **salvage for parts**, **recycle**. | Contract keys: `upgrade`, `repair`, `pass_on`, `salvage`, `recycle`. Also called "action" or "outcome" in early notes. |
| Category | A device-specific group of options chosen by the AI for one device and intended use, for example "Faster storage" or "Hand it down"; 3 to 6 per device. Shown as Overview cards and toolbar tabs. | Feature 008. `CategoryResult.categories`. The five-path fallback shows each path as a category. |
| Option | One concrete action inside a category, for example "Swap the hard disk for a 500 GB SSD", with a status, reason, kind, difficulty, figures and scores. | Feature 008. Replaces the proposed per-path options of feature 006. |
| Option kind | What an option does as far as the impact table can price it: `ssd`, `ram`, `battery`, `hand_down`, `salvage`, `recycle`, or `other`. | Priced kinds use the calculator; `other` uses an AI estimate. |
| Difficulty | Who does an option and how: `diy_easy` (no tools, device stays closed), `diy_moderate` (owner opens it with common tools), `professional` (a service provider). | Sets the option's feasibility score (feature 003 design). |
| AI estimate | Figures supplied by the AI for an option of kind `other`, accepted only after range checks and always labelled "AI estimate". | `impact_source: "ai_estimate"`; at most medium confidence. |
| Step plan | The ordered "do x, then y" instructions for one option, 1 to 12 steps, each with a title, detail, tools, parts, time, safety flag and cited passages. Requested when an option card is first opened. | Feature 009. `StepPlan`. Not the one-line `next_steps` of feature 004. |
| Technical step | A step that opens or reassembles the device, handles internal parts, names a part specification, or checks compatibility. It must cite a passage or the server removes it, unless it is flagged professional. | Feature 009 `kind: "technical"`. A **general step** (backing up, resetting, finding an offer) needs no citation. |
| Safety flag | How careful a step needs to be: `none`; `caution`, shown with a warning sentence; or `professional`, shown as "Professional only", meaning a service provider should do it. | Feature 009 `Step.safety`. Differs from an option's difficulty, which describes the whole option. |
| Template plan | A generic step plan for an option kind, shown with "AI steps unavailable" when the step call fails and always for the five-path fallback. Its technical steps cite a matching passage or become professional. | Feature 009 `source: "template"`; `server/src/steps/templates.ts`. |
| Intended use | The owner’s planned use. The first ranking uses General. Changing the selection recomputes the ranking. | Contract keys: `general`, `office`, `study`, `development`, `gaming`, `pass_on`. Changes the rubrics and baseline assumptions. |
| Suitability status | The per-path result of the gates: `viable`, `conditional` (possible but unverified or needing professional help), or `not_suitable` (contradicted by a verified fact or unsafe). | Not-suitable paths have no score. |
| Gate | A deterministic feasibility or safety rule applied before scoring. | Feature 003 |
| Fact | A structured device property (for example RAM soldered) extracted from retrieved passages; valid only with a passage citation. | Feature 003 FR-002 |
| Passage | A citable chunk of a curated corpus document, with its title, URL, section or page, applicability, and access date. | Feature 002 |
| Model-specific / generic | Whether a document applies to an exact manufacturer and model, or to devices in general. | `model_evidence: "none"` means no model-specific documents matched; `"web"` means only web pages about the exact model did (feature 017). |
| Web source | A public web page found by web search for the device's exact model when the corpus has nothing on a topic (feature 017). It can support facts like a corpus passage, except a user-replaceable battery, and is always shown with the label "Web source", its site and retrieval date. | `Passage.source: "web"`; `server/src/search/`; not part of the curated corpus. |
| Baseline | The comparison scenario for impact figures: "the owner buys a comparable new laptop now". | All CO₂e and savings are relative to it. |
| Displacement | Whether a path avoids the baseline purchase: `assumed` (fully credited), `conditional` (only if, for example, the recipient would otherwise buy new), or `none`. | Determines `avoided_vs_baseline`; see `shared/README.md`. |
| Impact table | The curated static file of CO₂e ranges, sample prices, and useful-life ranges, each entry with its source. | No live prices. |
| Mode | The weight set used for ranking: **Environment first** or **Money first**. | Contract keys: `environment_first`, `money_first`. Weights are illustrative defaults. |
| Device link | The unguessable URL to a device's page and report; it is the only access control. | No accounts |
| Scan session | The link between one press of Scan now and one scanner run: its random ID is appended to the downloaded scanner, which reports progress to the waiting browser tab. | Feature 006; `shared/src/session.ts`. A bearer secret for progress only, separate from the device ID. |
| Demo device | A pre-scanned device seeded on the public deployment, with cached results. | Feature 005 |
