// Writes every top-level contract to shared/schemas/<name>.schema.json (JSON Schema 2020-12).
// The Go scanner's contract test validates its output against DeviceScan.schema.json.
// Run `npm run schemas -w shared` after changing a contract; a test fails if files are stale.
import { mkdirSync, writeFileSync } from 'node:fs'
import { renderSchemas } from './render-schemas.ts'

const outDir = new URL('../schemas/', import.meta.url)
mkdirSync(outDir, { recursive: true })
for (const [file, content] of renderSchemas()) {
  writeFileSync(new URL(file, outDir), content)
  console.log(`wrote schemas/${file}`)
}
