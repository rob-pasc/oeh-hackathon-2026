// Live fact extraction over the shared fixtures: `npm run facts:smoke -w server`.
// Reads server/.env. Prints the extracted facts, dropped facts, and call metadata, and compares
// against shared/fixtures/facts.example-laptop-14.json. Never prints the API key.
import { readFileSync } from 'node:fs'
import type { DeviceScan, FactSet, RetrievalResult } from '@leaaf/shared'
import { createFactExtractor, createMemoryFactCache } from '../src/facts/index.ts'
import { createOpenAiCompatibleClient, LlmError, loadLlmConfig } from '../src/llm/index.ts'

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`../../shared/fixtures/${name}.json`, import.meta.url), 'utf8')) as T

try {
  const config = loadLlmConfig()
  const extractor = createFactExtractor({ llm: createOpenAiCompatibleClient(config), cache: createMemoryFactCache() })
  const result = await extractor.extract({
    scan: fixture<DeviceScan>('device-scan.laptop-complete'),
    retrieval: fixture<RetrievalResult>('retrieval.example-laptop-14'),
  })
  const expected = fixture<FactSet>('facts.example-laptop-14')

  console.log(`model ${result.llm?.model}, thinking ${config.thinking.fact_extraction}, attempts ${result.llm?.attempts}, ` +
    `${result.llm?.latency_ms} ms, tokens in/out ${result.llm?.usage.prompt_tokens}/${result.llm?.usage.completion_tokens}`)
  for (const f of result.facts.facts) console.log(`  kept    ${f.key} = ${JSON.stringify(f.value)}  [${f.source_passage_ids.join(', ')}]`)
  for (const d of result.dropped) console.log(`  dropped ${d.fact.key}: ${d.reason}`)

  const got = new Map(result.facts.facts.map((f) => [f.key, JSON.stringify(f.value)]))
  const mismatches = expected.facts.filter((f) => got.get(f.key) !== JSON.stringify(f.value))
  const extra = result.facts.facts.filter((f) => !expected.facts.some((e) => e.key === f.key))
  for (const f of mismatches) console.log(`  differs from fixture: ${f.key} (expected ${JSON.stringify(f.value)}, got ${got.get(f.key) ?? 'nothing'})`)
  for (const f of extra) console.log(`  not in fixture: ${f.key}`)
  console.log(mismatches.length + extra.length === 0 ? 'facts smoke test passed: matches fixture' : 'facts smoke test finished with differences (review above)')
  if (mismatches.length + extra.length > 0) process.exitCode = 1
} catch (error) {
  if (error instanceof LlmError) {
    console.error(`facts smoke test failed: ${error.kind}: ${error.message}`)
    for (const d of error.details) console.error(`  ${d}`)
  } else console.error('facts smoke test failed:', error)
  process.exitCode = 1
}
