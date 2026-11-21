// Regenerates shared/fixtures/steps.example-laptop-14.office.json from the sample AI answer in
// test/fixtures/, through the same server checks as a live answer (feature 009).
// A test fails when the fixture is stale: run `node scripts/step-fixture.ts` from server/.
import { readFileSync, writeFileSync } from 'node:fs'
import type { DeviceScan, RetrievalResult, StepPlan } from '@leaaf/shared'
import { retrievedPassages } from '../src/facts/extract.ts'
import { checkSteps } from '../src/steps/service.ts'

const shared = (name: string) => new URL(`../../shared/fixtures/${name}.json`, import.meta.url)
const read = <T>(url: URL): T => JSON.parse(readFileSync(url, 'utf8')) as T

export const STEP_OUTPUT = new URL('../test/fixtures/step-output.example-laptop-14.json', import.meta.url)

export function exampleSteps(): StepPlan {
  const scan = read<DeviceScan>(shared('device-scan.laptop-complete'))
  const passages = retrievedPassages(read<RetrievalResult>(shared('retrieval.example-laptop-14')))
  const { steps, cited } = checkSteps(read(STEP_OUTPUT), passages, scan)
  return {
    device_id: 'q3Xk9vT2mB7pLw0cZr1sEa',
    intended_use: 'office',
    option_id: 'ssd-swap',
    generated_at: '2026-11-21T12:00:00Z',
    source: 'llm',
    notice: null,
    steps,
    passages: cited,
  }
}

export const STEP_FIXTURE = shared('steps.example-laptop-14.office')

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(STEP_FIXTURE, JSON.stringify(exampleSteps(), null, 2) + '\n')
  console.log('wrote shared/fixtures/steps.example-laptop-14.office.json')
}
