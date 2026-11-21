// Regenerates shared/fixtures/categories.example-laptop-14.office.json from the sample AI answer in
// test/fixtures/, so the fixture's figures always come from the current calculator (feature 008).
// A test fails when the fixture is stale: run `node scripts/category-fixture.ts` from server/.
import { readFileSync, writeFileSync } from 'node:fs'
import type { Assessment, DeviceScan, FactSet, RetrievalResult } from '@leaaf/shared'
import { buildResult } from '../src/categories/service.ts'
import { loadImpactTable } from '../src/impact/table.ts'

const shared = (name: string) => new URL(`../../shared/fixtures/${name}.json`, import.meta.url)
const read = <T>(url: URL): T => JSON.parse(readFileSync(url, 'utf8')) as T

export function exampleCategories() {
  const scan = read<DeviceScan>(shared('device-scan.laptop-complete'))
  const input = {
    assessment: read<Assessment>(shared('assessment.example-laptop-14.office')),
    facts: read<FactSet>(shared('facts.example-laptop-14')),
    retrieval: read<RetrievalResult>(shared('retrieval.example-laptop-14')),
  }
  const output = read<any>(new URL('../test/fixtures/category-output.example-laptop-14.json', import.meta.url))
  return buildResult(scan, input, output, '2026-11-21T12:00:00Z', loadImpactTable())
}

export const CATEGORY_FIXTURE = shared('categories.example-laptop-14.office')

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(CATEGORY_FIXTURE, JSON.stringify(exampleCategories(), null, 2) + '\n')
  console.log('wrote shared/fixtures/categories.example-laptop-14.office.json')
}
