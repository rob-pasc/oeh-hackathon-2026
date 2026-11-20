// Upload validation that names each invalid field (feature 001 FR-007).
//
// TypeBox reports a missing property on its parent object and a wrong type on a nullable field
// three times (once per anyOf branch plus the anyOf itself). This collapses the raw errors into
// one entry per field path, so the response reads "/identity/model: is required".
import { Compile } from 'typebox/compile'
import { DeviceScan } from '@leaaf/shared'

export interface FieldProblem {
  path: string
  message: string
}

const compiled = Compile(DeviceScan)

export type ScanCheck = { ok: true; scan: DeviceScan } | { ok: false; fields: FieldProblem[] }

export function checkScan(body: unknown): ScanCheck {
  if (compiled.Check(body)) return { ok: true, scan: body as DeviceScan }
  const byPath = new Map<string, string>()
  const add = (path: string, message: string) => {
    if (!byPath.has(path)) byPath.set(path, message)
  }
  for (const e of compiled.Errors(body)) {
    const params = e.params as { requiredProperties?: string[] }
    if (e.keyword === 'required' && params.requiredProperties) {
      for (const p of params.requiredProperties) add(`${e.instancePath}/${p}`, 'is required')
    } else if (e.message === 'schema is false') {
      // additionalProperties: false; reported per extra property.
      add(e.instancePath, 'is not allowed')
    } else if (e.keyword === 'anyOf' || e.keyword === 'additionalProperties' || e.message === 'must be null') {
      // Summary errors and the null branch of Nullable() add nothing beyond the specific error.
      continue
    } else {
      add(e.instancePath || '/', e.message)
    }
  }
  if (byPath.size === 0) add('/', 'does not match the device scan schema')
  return { ok: false, fields: [...byPath].map(([path, message]) => ({ path, message })) }
}
