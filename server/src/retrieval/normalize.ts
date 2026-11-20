// Model normalization and matching (feature 002 FR-004). Only exact matches after normalization
// count: there is deliberately no fuzzy or prefix matching, so a near-miss variant such as
// "T480s" never borrows evidence from "T480".
import type { DeviceScan, ModelMatch } from '@leaaf/shared'

/** Unicode compatibility form, lower case, trimmed, inner whitespace collapsed to one space. */
export function normalizeName(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export interface ModelNames {
  manufacturers: readonly { name: string; aliases: readonly string[] }[]
  models: readonly { manufacturer: string; model: string; aliases: readonly string[] }[]
}

export type ModelMatcher = (identity: DeviceScan['identity']) => ModelMatch | null

/**
 * Builds a matcher from the manifest's canonical names and alias lists. A device matches when its
 * manufacturer and either its model or its product version (Lenovo reports the readable name
 * there and a machine-type code in `model`) equal a canonical name or alias after normalization.
 */
export function createModelMatcher(names: ModelNames): ModelMatcher {
  const manufacturerOf = new Map<string, string>()
  for (const m of names.manufacturers) for (const s of [m.name, ...m.aliases]) manufacturerOf.set(normalizeName(s), m.name)
  const modelOf = new Map<string, ModelMatch>()
  for (const m of names.models)
    for (const s of [m.model, ...m.aliases])
      modelOf.set(`${m.manufacturer}\u001f${normalizeName(s)}`, { manufacturer: m.manufacturer, model: m.model })

  return (identity) => {
    if (!identity.manufacturer) return null
    const manufacturer = manufacturerOf.get(normalizeName(identity.manufacturer))
    if (!manufacturer) return null
    for (const candidate of [identity.model, identity.product_version]) {
      if (!candidate) continue
      const match = modelOf.get(`${manufacturer}\u001f${normalizeName(candidate)}`)
      if (match) return match
    }
    return null
  }
}
