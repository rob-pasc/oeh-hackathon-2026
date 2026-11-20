# Research: Curated corpus sources (feature 002)

Findings from curating `corpus/` on 2026-11-20. Every extract was copied from a page or PDF actually fetched that day and checked against the fetched text by script; differences are only joined list or table items and removed footnote digits. This document records what the sources do and do not settle, so the next curator does not repeat the search. Decisions live in [PLAN.md](./PLAN.md).

## Demo models: what the corpus settles

| Fact (feature 003 keys) | ThinkPad T480 | XPS 13 9360 | EliteBook 840 G5 |
|---|---|---|---|
| RAM | 2 SO-DIMM sockets, max 32 GB DDR4-2400 (2133 with 7th gen) (`lenovo-t480-psref`); "none soldered" is implied by slot-only specs, not stated | Onboard LPDDR3, 4/8/16 GB (`dell-xps13-9360-setup-specs`); iFixit: "soldered directly to the motherboard" | "2 SODIMM; Both slots are upgradeable", max 32 GB DDR4-2400 (`hp-elitebook-840-g5-quickspecs`) |
| Storage | 2.5" SATA bay or M.2 2280 NVMe, plus optional M.2 in the WWAN slot (`lenovo-t480-hmm`) | One M.2 SSD, SATA or PCIe/NVMe; length (2280) not stated (`dell-xps13-9360-setup-specs`) | M.2 SSD (`hp-elitebook-840-g5-msg`, QuickSpecs) |
| Battery | Removable battery is a CRU; built-in battery is FRU, technician only (`lenovo-t480-hmm`) | Removal procedure: one cable, screws (`dell-xps13-9360-service-manual`) | "internal and not replaceable by customer" (QuickSpecs); spare part 933321-855 (MSG); iFixit lists SS03XL |
| Windows 11 | Listed by Lenovo (`lenovo-windows11-upgrade-devices`); BIOS readme lists Windows 11 | Dell: "Only with select Intel 8th Generation Processors" (`dell-windows11-tested-computers`) | Only via Microsoft's generation list (8th gen); HP's own list not fetched |
| BIOS updates | Latest found 1.56, 2025-09-30, with CVE fixes (`lenovo-t480-bios-readme`); inferred from later readmes returning 404 | Not found | Not found |
| CPUs shipped | i5-7200U, i5-7300U, i3-8130U, i5-8250U, i5-8350U, i7-8550U, i7-8650U | 7th gen i3/i5/i7 and 8th gen i5/i7 (generations only; exact models not in a fetched source) | i5-7200U, i5-7300U, i5-8250U, i5-8350U, i7-8550U, i7-8650U |

## Gaps and cautions

- **Windows 11 for 7th-gen CPUs:** Microsoft's current "Windows 11 supported Intel processors" list (updated 2025-10-30) names series, not model numbers, and has no 7th-generation row. It has an "Intel Core 7000X Series" row (desktop HEDT chips), which was left out of the extract so 7th-gen laptop CPUs are not matched to it. Microsoft's 2021-08-27 blog post on minimum requirements adds a few 7th-gen parts (e.g. Core 7820HQ) but never states that the others are excluded. So no source decides the 7th-gen 840 G5 (coverage gap, AC-008).
- **Identity strings unconfirmed:** no fetched source shows WMI output. Expected: `LENOVO` / `20L5…` or `20L6…` with product version `ThinkPad T480`; `Dell Inc.` / `XPS 13 9360`; `HP` / `HP EliteBook 840 G5`. Confirm from real scans before adding aliases (T-006).
- **HP sources:** the only HP-hosted service guide is the *Healthcare Edition* 840 G5 / 846 G5 guide; hardware and procedures match the QuickSpecs, page numbers may differ from the standard guide. HP's QuickSpecs link redirects to "page not found", so the PDF is taken from B&H's mirror (noted in the terms). HP's Windows 11 tested-products page timed out repeatedly. Retried 2026-11-20 (later): `support.hp.com/us-en/document/ish_4904293-4904369-16` and `…/ish_5244269-5244314-16` timed out twice each; `h20195.www2.hp.com/v2/GetDocument.aspx?docname=4AA7-9844ENW` failed with a TLS certificate-chain error. Opening them in a browser is the remaining option.
- **Dell Windows 11 page** returned 403 to direct fetches and was read through a summarising fetcher; verify its two list entries in a browser before release.
- **Not found for any model:** a quotable end-of-service date; a swollen-battery warning in the vendor manuals (the generic UBA page covers it).
- **Lenovo HMM page numbers** are 1-based PDF pages; printed page numbers are 6 lower.
- **Source inconsistencies quoted as-is:** Dell's manual gives different screw sizes for removal and replacement; HP's guide and iFixit describe the bottom-cover screws differently.

## Generic sources

- **Repair funding:** reparaturbonus.at now redirects to the Geräte-Retter-Prämie: 50 % up to EUR 130 per repair plus up to EUR 30 for a quote, vouchers until 31.12.2026. Laptops qualify, but battery-only swaps and software-only work do not, which matters for battery advice (feature 003/004).
- **EU repair directive 2024/1799:** laptops are not on the Annex II list of products manufacturers must repair. The EUR-Lex summary was empty; the Commission page is used.
- **Windows 10 ESU (Austrian page):** free while signed in with a Microsoft account, or USD 30 one-time, until 12 Oct 2027 (EEA terms differ from the US page).
- **Reset your PC:** includes "Clean data" and Microsoft's note that it does not meet government or industry erasure standards.
- **Emissions share:** Umweltbundesamt says manufacturing causes the largest share of a computer's emissions, "über 80%" depending on lifetime and device type. The underlying study was not fetched.
- **E-waste in Austria:** the EAK site has no consumer guidance and oesterreich.gv.at returned 404, so the environment ministry (BMLUK) pages are used.

## Licences and terms

- iFixit: CC BY-NC-SA 3.0 (non-commercial, share-alike). Its licensing page also says using iFixit data to train ML/AI models violates its terms; retrieval with quotation is not training, but this is a reason to keep iFixit extracts short and attributed.
- Umweltbundesamt (DE): CC BY-NC-ND 4.0; extracts are unmodified.
- US EPA: US federal public domain.
- European Commission: reuse policy (Decision 2011/833/EU) assumed; the legal notice of each page was not checked.
- Lenovo, Dell, HP, Microsoft, ITU, BMLUK, Geräte-Retter-Prämie, PCs für alle: no open licence; short verbatim quotations with a link under the quotation right (Austrian UrhG §42f).
- The non-commercial licences must be revisited before any commercial use of leaaf.
