# Research: Step-level sources (feature 010)

Research date: 2026-11-21. Result: six documents added in the first round (31 → 37 documents, 197 → 228 passages) and four more in a second round that targeted the gaps (37 → 41 documents, 228 → 245 passages). Every extract was copied from the page text as rendered in a browser or in the search result, not from memory, and keeps the source's own wording; editorial notes are in `[ ]`.

## Audit of the existing corpus (T-001)

"Covered" means a document applicable to the model contains the procedure text, not only a heading.

| Model | Bottom cover | Storage drive | Battery | RAM |
| --- | --- | --- | --- | --- |
| ThinkPad T480 | Covered: `ifixit-t480-ram-replacement` ("loosen the six captive screws", opening tool around the perimeter). The Lenovo HMM names the "Base cover assembly" only as an FRU prerequisite, its steps are images. | **Gap, closed:** the HMM sections 1050 have headings but no step text. Added `ifixit-t480-ssd-replacement`. | Covered: `lenovo-t480-hmm` (disable the built-in battery) and `ifixit-t480-ram-replacement` (external and internal battery). | Covered: `ifixit-t480-ram-replacement` and `lenovo-t480-hmm` 1040. |
| XPS 13 9360 | Covered: `dell-xps13-9360-service-manual` (Removing the base cover, with screw counts and prying). | Covered: service manual and `ifixit-xps13-9360-ssd-replacement`. | Covered: service manual (Removing/Replacing the battery). | Covered as "not possible": `ifixit-xps13-9360-device` states that the memory is soldered to the motherboard. |
| EliteBook 840 G5 | Covered: `hp-elitebook-840-g5-msg` (Bottom cover) and `ifixit-hp-elitebook-840-g5-battery` (Back Cover). | Covered: HP MSG "Solid-state drive (SSD)". | Covered: HP MSG lists it under "Authorized Service Provider parts" (the statement FR-001 asks for), and `ifixit-hp-elitebook-840-g5-battery` has the steps. | Covered: HP MSG "Memory modules" and `ifixit-hp-elitebook-840-g5-ram`. |

Generic, before this feature: reset with all data removed was covered (`ms-reset-your-pc`, "Remove everything", "Clean data"); back-up and installing Windows were not. Austrian: repair funding (`at-geraete-retter-praemie`), donation (`at-pcs-fuer-alle`) and free e-waste drop-off (`at-bmluk-elektroaltgeraete-kostenlose-abgabe`, `-ruecknahmepflicht`) were covered; a battery drop-off statement and a repair-café pointer were not.

## Sources added

| Id | Source | Fills | Terms basis |
| --- | --- | --- | --- |
| `ifixit-t480-ssd-replacement` | iFixit guide 167229, Lenovo ThinkPad T480 SSD Replacement | T480 storage drive steps | CC BY-NC-SA 3.0, short attributed excerpt, like the other iFixit entries |
| `ms-back-up-with-windows-backup` | Microsoft Support, Back up and restore with Windows Backup (Windows 11 tab) | FR-002 back up files | Short verbatim quotations with link (UrhG §42f) |
| `ms-create-installation-media` | Microsoft Support 15088 | FR-002 installing Windows (making the USB stick) | as above |
| `ms-reinstall-windows-with-installation-media` | Microsoft Support, Reinstall Windows with the installation media | FR-002 installing Windows (in-place and clean install, partitions, activation) | as above |
| `at-usp-batterien-ruecknahme` | Unternehmensservice Portal (content by BMLUK), Batterien | FR-003 free battery drop-off (trade take-back and municipal collection centres) | Official Austrian site, no licence stated, short German quotations |
| `at-ak-wien-repair-cafes` | AK Wien, Repair Cafés: Schrauben statt wegwerfen! (2.7.2026) | FR-003 repair offer (free volunteer repair, pointer to `repaircafes.at` and `reparaturfuehrer.at`) | Chamber website, no licence stated, short German quotations |
| `ms-back-up-with-file-history` | Microsoft Support, Backup and restore with File History (applies to Windows 11 and Windows 10) | FR-002 back up to an external drive; also covers Windows 10 | Short verbatim quotations with link (UrhG §42f) |
| `at-repaircafes-plattform` | Re-Use Austria, repaircafes.at start page | FR-003 repair offer (what a Repair Café is, free, volunteer repairers, event platform) | Association website, all rights reserved, short German quotations |
| `at-carla-elektrogeraete-reuse` | carla Vorarlberg (Caritas), Elektrogeräte Re-Use | FR-003 donation in Vorarlberg: states which devices are accepted and that "EDV-/IT-Geräte" are not; lists the drop-off points | Charity website, no licence stated, short German quotations |
| `at-carla-reparaturcafe` | carla Vorarlberg (Caritas), Reparaturcafé | FR-003 repair offer in Vorarlberg (Altach and Bludenz, free, no registration, monthly) | as above |

## Sources considered and rejected

| Source | Reason |
| --- | --- |
| iFixit T480s SSD Replacement (144026, 133886) | Different model; the manifest rule is that `T480s` must not be treated as a `T480`. |
| iFixit T480 Hard Drive Replacement (139961) | 2.5-inch drive guide, not the M.2 SSD; the SSD guide above is the match. |
| iFixit HP EliteBook 840 G5 SSD Storage Replacement (109947) | Read in full; redundant, because the HP MSG already has bottom cover, SSD and battery cable steps and the iFixit battery guide has the cover steps. Can be added if more detail is wanted. |
| iFixit Dell XPS 13 9360 Battery Replacement (148431) | States that its text comes from the Dell service manual, which is already in the corpus. |
| iFixit Dell XPS 13 (older 9333) battery and back cover guides; XPS 13 9300 and 9310 lower case guides | Other models. |
| parts-people.com XPS 9360 bottom base | Commercial third-party page, no licence; the Dell manual covers it. |
| Microsoft Learn Q&A "File History" answer; Acronis, Yahoo Tech and O'Reilly back-up articles | Community or commercial pages, not primary sources. |
| Dell KB 000130375 and HP support page on back-up | Vendor pages that mostly repeat Microsoft's tools. The HP page has the File History steps for an external drive (see gaps). |
| Microsoft "Windows Backup" tips page | Marketing page without steps. |
| wien.gv.at repair pages, Reparaturnetzwerk Wien programme PDFs, NÖ Leitfaden Repair-Café | City or event specific, or written for people who run a repair café. |
| tirol.gv.at and Steiermark AWV battery flyers, WKO pages | State-specific or aimed at traders; the national page is the better fit. |
| MediaMarkt take-back pages | Commercial retailer. |
| Labdoo, Computertruhe, Close the Gap, Katholisches Sozialzentrum Viernheim, utopia.de, pctipp.ch | Germany or Switzerland, or secondary articles. |
| News reports on company laptop donations (tips.at, derStandard, Raiffeisen, vol.at) | Corporate donations, not an offer for private people. |
| futurezone.at "verkaufen, spenden, recyclen" | News article; it names Carla shops but only for screens, TVs and consoles, not laptops. |
| Volkshilfe Vorarlberg school-start campaign (meinbezirk.at, 20.8.2026) and PCs für alle news page | Only say that Volkshilfe Vorarlberg hands out refurbished PCs and laptops received from PCs für alle; neither names a place where private people can hand in a laptop. The PCs für alle donation locations listed are Wien/NÖ/Burgenland, Steiermark and Oberösterreich. News and a partner announcement, not an offer. |
| ORF Vorarlberg and DiWi reports on the 2020 "School kids online" computer collection | A one-off campaign from 2020; no longer an offer. |
| Re-Use Vorarlberg municipal collection (Langenegg notice, Re-Use folder) | The Langenegg notice says screens, computers and smartphones are not accepted; the folder was only seen as a search snippet, so nothing is added. |
| Reparaturcafé Feldkirch (reparaturcafe-feldkirch.at), Repair Café Nenzing best-practice sheet, kath-kirche-vorarlberg.at | Local pages; the Feldkirch page names "defekte Kleingeräte" and does not say whether laptops are taken, so a laptop claim would be unsupported. Dates change monthly. `repaircafes.at` is the maintained directory. |
| Helvetia press release and leadersnet.at on the launch of repaircafes.at | Press coverage of the platform that is now cited directly. |
| WKO "Elektroaltgeräte … Sammelstellen für den Versandhandel", Lustenau ASZ brochure, Abfallhandbuch Vorarlberg | Trade or municipal documents that repeat the free drop-off already covered by the BMLUK pages, or were seen only as snippets. |

## Coverage output (FR-005)

`npm run corpus:ingest -w server` and `npm test -w server` could **not** be run in this session: the sandbox has Node 22 (the server needs 24 for `.ts` execution and a stable `node:sqlite`) and no `typebox` package. The ingestion rules were therefore checked with a substitute script that applies the same manifest rules (required fields, id and file patterns, ISO date, topic enum, undeclared models, models without documents, duplicate ids) and runs the repository's real `chunkMarkdown` on every extract:

```
documents: 41, passages: 245
lenovo|thinkpad t480 -> 6 docs
dell|xps 13 9360 -> 5 docs
hp|elitebook 840 g5 -> 4 docs
no problems
```

The substitute output above is the result after the second round. The new model document (`ifixit-t480-ssd-replacement`) is a repair-hardware document of a model that already had one; the OS-support and CPU coverage per model is unchanged. The user has to run `npm run corpus:ingest -w server` and `npm test -w server` before merging; the expected warning about the 840 G5 7th-generation CPUs is the one recorded in feature 002.

## Remaining gaps (FR-005)

- **T480, storage drive and bottom cover:** the Lenovo HMM keeps its step text in images, so the steps come from a community iFixit guide (CC BY-NC-SA). The guide's step 3 says "Remove all Phillip-head screws shown", so the screw positions are only in the photo and not in the extract.
- **EliteBook 840 G5, battery:** HP treats it as an Authorized Service Provider part; the steps come from iFixit.
- **EliteBook 840 G5, CPUs:** the 7th-generation gap from feature 002 remains.
- **Windows 10:** `ms-back-up-with-file-history` applies to Windows 10 and 11. The other added Microsoft pages (Windows Backup, installation media, reinstall) describe Windows 11 only; no Windows 10 variants were added. Windows 10 reached end of support on 2025-10-14.
- **Linux and macOS laptops:** no reinstall or back-up sources; the demo models run Windows. Not researched in the second round.
- **Donation:** no primary-source offer by which a private person in Vorarlberg can hand in a working laptop was found. `at-pcs-fuer-alle` has pick-up in the Vienna area only. carla Vorarlberg (`at-carla-elektrogeraete-reuse`) accepts working appliances but not "EDV-/IT-Geräte", so the corpus records that carla is not an option for laptops. Volkshilfe Vorarlberg hands out refurbished PCs but does not publish an intake. If the app suggests donation to a user in Vorarlberg it can only cite PCs für alle for Vienna or say that no local offer is known.
- **Repair café directory:** `repaircafes.at` (Re-Use Austria, launched 2026) is now in the corpus. It lists events through a map that loads dynamically, so no individual café is in the corpus; `at-carla-reparaturcafe` names the Altach and Bludenz cafés in Vorarlberg, but neither the carla page nor `repaircafes.at` says that laptops are repaired, only "Elektrogeräte".
- **Battery drop-off in Vorarlberg specifically:** the corpus has the federal statement (`at-usp-batterien-ruecknahme`) and the carla list of Vorarlberg collection centres, but no Vorarlberg-specific battery page.

## Terms notes

All new extracts are short verbatim quotations with link and access date (2026-11-21). The iFixit entry follows the existing iFixit decision from feature 002: retrieval with attribution is allowed, AI training is not (the corpus is not used for training). German sources stay German; nothing was machine-translated.
