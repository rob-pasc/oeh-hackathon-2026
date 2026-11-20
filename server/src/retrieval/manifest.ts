// Corpus manifest (feature 002 FR-001, FR-002, FR-004): one entry per document with its source,
// terms note, topic, and model applicability, plus the canonical models and their alias lists.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Type, type Static } from 'typebox'
import { parse } from 'yaml'
import { createValidator, IsoDate, Topic } from '@leaaf/shared'
import { normalizeName } from './normalize.ts'

const strict = { additionalProperties: false } as const
const NonEmpty = Type.String({ minLength: 1 })

export const ModelRef = Type.Object({ manufacturer: NonEmpty, model: NonEmpty }, strict)
export type ModelRef = Static<typeof ModelRef>

export const ManifestManufacturer = Type.Object(
  {
    name: NonEmpty,
    /** Other spellings firmware reports, e.g. "Dell Inc." for Dell. Case and whitespace are normalized anyway. */
    aliases: Type.Array(NonEmpty),
  },
  strict,
)

export const ManifestModel = Type.Object(
  {
    manufacturer: NonEmpty,
    model: NonEmpty,
    /** Exact model strings firmware reports for this model (e.g. Lenovo machine-type codes). No wildcards. */
    aliases: Type.Array(NonEmpty),
    /** A chosen demo model; the coverage check applies to it (FR-009). */
    demo: Type.Optional(Type.Boolean()),
    /** CPUs the model shipped with, as written in OS-support lists (e.g. "i5-8250U"); used by the coverage check. */
    cpus: Type.Optional(Type.Array(NonEmpty)),
  },
  strict,
)
export type ManifestModel = Static<typeof ManifestModel>

/** The required document fields (FR-001), checked one by one so ingestion can name what is missing (FR-002). */
export const REQUIRED_DOCUMENT_FIELDS = ['id', 'title', 'url', 'publisher', 'accessed_on', 'terms', 'topic', 'applies_to', 'file'] as const

export const ManifestDocument = Type.Object(
  {
    id: Type.String({ pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' }),
    title: NonEmpty,
    url: Type.String({ format: 'uri' }),
    publisher: NonEmpty,
    accessed_on: IsoDate,
    /** Licence or terms basis for storing the extract (legal constraint in the plan). */
    terms: NonEmpty,
    topic: Topic,
    applies_to: Type.Union([Type.Literal('generic'), Type.Array(ModelRef, { minItems: 1 })]),
    /** Markdown extract, relative to the corpus directory. */
    file: Type.String({ pattern: '^docs/[a-z0-9-]+\\.md$' }),
  },
  strict,
)
export type ManifestDocument = Static<typeof ManifestDocument>

export const Manifest = Type.Object(
  {
    schema_version: Type.Literal(1),
    manufacturers: Type.Array(ManifestManufacturer),
    models: Type.Array(ManifestModel),
    documents: Type.Array(Type.Unknown()),
  },
  strict,
)

export interface CorpusManifest {
  schema_version: 1
  manufacturers: Static<typeof ManifestManufacturer>[]
  models: ManifestModel[]
  documents: ManifestDocument[]
}

export class ManifestError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`invalid corpus manifest:\n- ${problems.join('\n- ')}`)
    this.name = 'ManifestError'
    this.problems = problems
  }
}

const isManifest = createValidator(Manifest)
const isDocument = createValidator(ManifestDocument)

const modelKey = (manufacturer: string, model: string) => `${normalizeName(manufacturer)}\u001f${normalizeName(model)}`

function documentLabel(doc: unknown, index: number): string {
  const id = doc && typeof doc === 'object' && 'id' in doc && typeof doc.id === 'string' && doc.id ? doc.id : null
  return id ? `document ${id}` : `document #${index + 1} (no id)`
}

function documentProblems(doc: unknown, index: number): string[] {
  const label = documentLabel(doc, index)
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return [`${label}: must be a mapping`]
  const record = doc as Record<string, unknown>
  const missing = REQUIRED_DOCUMENT_FIELDS.filter((f) => record[f] === undefined || record[f] === null || record[f] === '')
  if (missing.length > 0) return [`${label}: missing ${missing.join(', ')}`]
  const shape = isDocument(doc)
  return shape.ok ? [] : shape.errors.map((e) => `${label}: ${e.path || '/'} ${e.message}`)
}

/**
 * Shape and cross-reference problems; an empty list means the manifest is valid.
 * When `corpusDir` is given, each document's extract file must also exist.
 */
export function checkManifest(value: unknown, corpusDir?: string): string[] {
  const shape = isManifest(value)
  if (!shape.ok) return shape.errors.map((e) => `manifest ${e.path || '/'}: ${e.message}`)
  const { manufacturers, models, documents } = shape.value
  const problems = documents.flatMap(documentProblems)
  if (problems.length > 0) return problems

  // Manufacturer names and aliases must not collide after normalization.
  const manufacturerOf = new Map<string, string>()
  for (const m of manufacturers)
    for (const spelling of [m.name, ...m.aliases]) {
      const norm = normalizeName(spelling)
      const owner = manufacturerOf.get(norm)
      if (owner && owner !== m.name) problems.push(`manufacturer alias "${spelling}" is used by both ${owner} and ${m.name}`)
      manufacturerOf.set(norm, m.name)
    }

  // Model names and aliases must be unique per manufacturer, so a device matches at most one model.
  const declared = new Set<string>()
  const modelOf = new Map<string, string>()
  for (const m of models) {
    if (!manufacturers.some((x) => x.name === m.manufacturer))
      problems.push(`model ${m.manufacturer} ${m.model}: manufacturer is not listed under manufacturers`)
    const key = modelKey(m.manufacturer, m.model)
    if (declared.has(key)) problems.push(`model ${m.manufacturer} ${m.model}: declared twice`)
    declared.add(key)
    for (const spelling of [m.model, ...m.aliases]) {
      const aliasKey = modelKey(m.manufacturer, spelling)
      const owner = modelOf.get(aliasKey)
      if (owner && owner !== m.model) problems.push(`model alias "${spelling}" is used by both ${owner} and ${m.model}`)
      modelOf.set(aliasKey, m.model)
    }
  }

  const docs = documents as ManifestDocument[]
  const ids = new Set<string>()
  const covered = new Set<string>()
  for (const doc of docs) {
    if (ids.has(doc.id)) problems.push(`document ${doc.id}: duplicate id`)
    ids.add(doc.id)
    if (doc.file !== `docs/${doc.id}.md`) problems.push(`document ${doc.id}: file must be docs/${doc.id}.md`)
    if (corpusDir && !existsSync(join(corpusDir, doc.file))) problems.push(`document ${doc.id}: file ${doc.file} does not exist`)
    if (doc.applies_to === 'generic') continue
    for (const ref of doc.applies_to) {
      // Canonical names only: aliases belong in the models list, so applicability is never ambiguous.
      const model = models.find((m) => m.manufacturer === ref.manufacturer && m.model === ref.model)
      if (!model) problems.push(`document ${doc.id}: applies to undeclared model ${ref.manufacturer} ${ref.model}`)
      else covered.add(modelKey(model.manufacturer, model.model))
    }
  }
  for (const m of models)
    if (!covered.has(modelKey(m.manufacturer, m.model))) problems.push(`model ${m.manufacturer} ${m.model}: no document applies to it`)
  return problems
}

export function parseManifest(text: string, corpusDir?: string): CorpusManifest {
  const value: unknown = parse(text)
  const problems = checkManifest(value, corpusDir)
  if (problems.length > 0) throw new ManifestError(problems)
  return value as CorpusManifest
}

export const DEFAULT_CORPUS_DIR = fileURLToPath(new URL('../../../corpus/', import.meta.url))

export function loadManifest(corpusDir: string = DEFAULT_CORPUS_DIR): CorpusManifest {
  return parseManifest(readFileSync(join(corpusDir, 'manifest.yaml'), 'utf8'), corpusDir)
}
