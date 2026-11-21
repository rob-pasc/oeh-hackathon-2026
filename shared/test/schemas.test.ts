import { readFileSync } from 'node:fs'
import { Ajv2020 } from 'ajv/dist/2020.js'
import addFormatsModule from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import { renderSchemas } from '../scripts/render-schemas.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// The exported JSON Schema files are what the Go scanner validates against; keep them in sync.
it.each(renderSchemas())('schemas/%s is up to date (run `npm run schemas -w shared`)', (file, expected) => {
  expect(read(`schemas/${file}`)).toBe(expected)
})

// Validate with an independent, standards-based validator (Ajv is also what Fastify uses),
// so the exported files work for consumers other than TypeBox.
describe('exported schemas under strict Ajv (JSON Schema 2020-12)', () => {
  const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => Ajv2020
  const ajv = addFormats(new Ajv2020({ strict: true, allErrors: true }))
  for (const [file] of renderSchemas()) ajv.addSchema(JSON.parse(read(`schemas/${file}`)))

  it.each([
    ['DeviceScan', 'device-scan.laptop-complete.json'],
    ['DeviceScan', 'device-scan.desktop-partial.json'],
    ['DeviceScan', 'device-scan.macos-complete.json'],
    ['DeviceScan', 'device-scan.linux-complete.json'],
    ['RetrievalResult', 'retrieval.example-laptop-14.json'],
    ['FactSet', 'facts.example-laptop-14.json'],
    ['Assessment', 'assessment.example-laptop-14.office.json'],
    ['Assessment', 'assessment.example-desktop-unknown.development.json'],
    ['Report', 'report.example-laptop-14.office.json'],
    ['StepPlan', 'steps.example-laptop-14.office.json'],
  ])('%s accepts fixtures/%s', (schema, file) => {
    const validate = ajv.getSchema(`${schema}.schema.json`)!
    expect(validate(JSON.parse(read(`fixtures/${file}`))), JSON.stringify(validate.errors)).toBe(true)
  })

  it('DeviceScan rejects an added serial number', () => {
    const scan = JSON.parse(read('fixtures/device-scan.laptop-complete.json'))
    scan.identity.serial_number = 'PF1ABC23'
    expect(ajv.getSchema('DeviceScan.schema.json')!(scan)).toBe(false)
  })
})
