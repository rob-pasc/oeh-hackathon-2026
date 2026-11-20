import { TOP_LEVEL_SCHEMAS } from '../src/index.ts'

/**
 * Returns [fileName, fileContent] pairs; shared by the export script and the staleness test.
 * `$id` is added only here, at the root of each file: schemas embedded in other schemas
 * (e.g. Passage inside Report) must not carry their own `$id`, or standard validators such
 * as Ajv reject the duplicate reference.
 */
export function renderSchemas(): [string, string][] {
  return Object.entries(TOP_LEVEL_SCHEMAS).map(([name, schema]) => [
    `${name}.schema.json`,
    JSON.stringify(
      { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `${name}.schema.json`, title: name, ...schema },
      null,
      2,
    ) + '\n',
  ])
}
