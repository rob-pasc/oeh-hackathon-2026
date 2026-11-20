# corpus

Curated knowledge base for retrieval ([feature 002](../docs/features/feature-002-knowledge-base-retrieval/PLAN.md)): `manifest.yaml`, which holds the source, terms/licence note and model applicability for each document, plus Markdown extracts in `docs/`.

It covers the three demo models (Lenovo ThinkPad T480, Dell XPS 13 9360, HP EliteBook 840 G5) with five documents each, plus 16 generic documents on Windows support, data wiping, repair funding, reuse, e-waste collection, and battery safety, with an Austrian focus. Sources, gaps, and licence notes are summarised in the feature's [RESEARCH.md](../docs/features/feature-002-knowledge-base-retrieval/RESEARCH.md).

Licences: iFixit extracts are CC BY-NC-SA 3.0 and Umweltbundesamt extracts are CC BY-NC-ND 4.0, both non-commercial only; the rest are short quotations with links. Revisit before any commercial use.

Only add documents whose terms allow our use, and record the basis in the `terms` note. Store short verbatim quotations with a link to the source, not whole manuals.

After any change, rebuild the index and run the tests:

```sh
npm run corpus:ingest -w server   # writes server/data/corpus.sqlite; lists coverage gaps
npm test -w server                # includes the manifest and coverage checks
```

## manifest.yaml

```yaml
schema_version: 1
manufacturers:                 # canonical name + other spellings firmware reports
  - name: Dell
    aliases: [Dell Inc.]
models:
  - manufacturer: Dell         # must be a listed manufacturer
    model: XPS 13 9360         # canonical name, used in passages and facts
    aliases: []                # exact Win32 model strings, e.g. Lenovo machine-type codes; no wildcards
    demo: true                 # optional: the coverage check applies (FR-009)
    cpus: [i7-7500U]           # optional: CPUs to find in a generic OS-support list
documents:
  - id: dell-xps-13-9360-service-manual   # kebab-case; the file must be docs/<id>.md
    title: XPS 13 9360 Service Manual
    url: https://...           # the exact page or PDF quoted
    publisher: Dell
    accessed_on: 2026-11-20
    terms: Why storing these quotations is allowed (licence, or short quotation with a link).
    topic: repair-hardware     # repair-hardware | software-support | environmental | circular-economy
    applies_to:                # or: applies_to: generic
      - manufacturer: Dell
        model: XPS 13 9360
    file: docs/dell-xps-13-9360-service-manual.md
```

Ingestion fails, naming the document and field, when a required field is missing or empty, a document applies to an undeclared model, a declared model has no document, or two models share an alias. Matching ignores case and extra whitespace, but is otherwise exact: a near-miss variant (for example `T480s`) must not be listed as an alias of another model.

## Extract format (`docs/<id>.md`)

```markdown
# XPS 13 9360 Service Manual

<!-- page: 21 -->
## Removing the battery

Quoted text, copied exactly from the source. [...] marks an omission.
```

- `##` headings name the source's own sections, so a citation can be followed back.
- `<!-- page: N -->` sets the PDF page for the text after it (1-based page index).
- Editorial notes go in square brackets, e.g. `[Introduction sentence repeated]`; everything else is verbatim.
- A passage never spans a heading or page marker, so it cites one section and page. Passage IDs are `<id>#<section-slug>-<n>`; renaming a heading changes the IDs that cite it.
