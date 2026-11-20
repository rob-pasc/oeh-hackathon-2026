// Corpus coverage check (feature 002 FR-009, AC-008): every demo model needs at least one
// model-specific repair-hardware document and an OS-support source covering its CPU.
import type { IngestedDocument } from './ingest.ts'
import type { CorpusManifest, ManifestDocument } from './manifest.ts'
import { normalizeName } from './normalize.ts'

const appliesTo = (doc: ManifestDocument, manufacturer: string, model: string) =>
  doc.applies_to !== 'generic' && doc.applies_to.some((r) => r.manufacturer === manufacturer && r.model === model)

/** Lower case with hyphens and whitespace collapsed, so "i5-8250U" also finds "i5 8250U". */
const cpuForm = (value: string) => normalizeName(value).replace(/[\s-]+/g, ' ')

/**
 * Problems for demo models; an empty list means coverage is complete. An OS-support source covers
 * the CPU when it is a software-support document for that exact model, or a generic one whose
 * text names every CPU the model shipped with (`cpus` in the manifest).
 */
export function coverageProblems(manifest: CorpusManifest, documents: readonly IngestedDocument[]): string[] {
  const textOf = new Map(documents.map((d) => [d.id, cpuForm(d.chunks.map((c) => c.text).join('\n'))]))
  const problems: string[] = []
  for (const m of manifest.models.filter((x) => x.demo)) {
    const name = `${m.manufacturer} ${m.model}`
    const own = manifest.documents.filter((d) => appliesTo(d, m.manufacturer, m.model))
    if (!own.some((d) => d.topic === 'repair-hardware')) problems.push(`${name}: no model-specific repair-hardware document`)

    if (own.some((d) => d.topic === 'software-support')) continue
    const cpus = m.cpus ?? []
    if (cpus.length === 0) {
      problems.push(`${name}: no model-specific software-support document and no cpus listed to check a generic one`)
      continue
    }
    const generic = manifest.documents.filter((d) => d.applies_to === 'generic' && d.topic === 'software-support')
    const uncovered = cpus.filter((cpu) => !generic.some((d) => textOf.get(d.id)?.includes(cpuForm(cpu))))
    if (uncovered.length > 0) problems.push(`${name}: no software-support document covers CPU ${uncovered.join(', ')}`)
  }
  return problems
}
