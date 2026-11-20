// Ranking weights from config/weights.yaml (feature 003 FR-011, T-006).
// Loading fails loudly so that a bad config stops the server at startup.
import { readFileSync } from 'node:fs'
import { Type } from 'typebox'
import { parse } from 'yaml'
import { checkWeights, createValidator, Weights, type Assessment } from '@leaaf/shared'

export type WeightConfig = Assessment['weights']

const WeightConfigSchema = Type.Object(
  { environment_first: Weights, money_first: Weights },
  { additionalProperties: false },
)
const isWeightConfig = createValidator(WeightConfigSchema)

export function parseWeights(text: string): WeightConfig {
  const shape = isWeightConfig(parse(text))
  if (!shape.ok) throw new Error(`invalid weights config:\n- ${shape.errors.map((e) => `${e.path || '/'}: ${e.message}`).join('\n- ')}`)
  const problems = [
    ...checkWeights(shape.value.environment_first, 'environment_first'),
    ...checkWeights(shape.value.money_first, 'money_first'),
  ]
  if (problems.length > 0) throw new Error(`invalid weights config:\n- ${problems.join('\n- ')}`)
  return shape.value
}

export const DEFAULT_WEIGHTS_PATH = new URL('../../../config/weights.yaml', import.meta.url)

export function loadWeights(path: string | URL = DEFAULT_WEIGHTS_PATH): WeightConfig {
  return parseWeights(readFileSync(path, 'utf8'))
}
