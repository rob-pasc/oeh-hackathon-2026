// Builds the corpus search index (feature 002 FR-003): `npm run corpus:ingest -w server`.
// Reads CORPUS_DIR (default: the repository's corpus/) and writes CORPUS_INDEX_PATH
// (default: server/data/corpus.sqlite). Exits non-zero, naming each problem, on an invalid manifest.
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { coverageProblems, DEFAULT_CORPUS_DIR, DEFAULT_CORPUS_INDEX_PATH, ingestCorpus, ManifestError, readCorpus } from '../src/retrieval/index.ts'

const corpusDir = resolve(process.env.CORPUS_DIR ?? DEFAULT_CORPUS_DIR)
const indexPath = resolve(process.env.CORPUS_INDEX_PATH ?? DEFAULT_CORPUS_INDEX_PATH)

try {
  mkdirSync(dirname(indexPath), { recursive: true })
  const stats = ingestCorpus(corpusDir, indexPath)
  console.log(`indexed ${stats.documents} documents, ${stats.passages} passages -> ${indexPath}`)
  console.log(`corpus hash ${stats.corpus_hash}`)
  // Coverage gaps are reported but do not fail ingestion; the coverage test enforces them.
  const { manifest, documents } = readCorpus(corpusDir)
  for (const problem of coverageProblems(manifest, documents)) console.warn(`coverage: ${problem}`)
} catch (error) {
  if (error instanceof ManifestError) {
    console.error(error.message)
    process.exitCode = 1
  } else throw error
}
