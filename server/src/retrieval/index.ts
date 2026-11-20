import { fileURLToPath } from 'node:url'

export * from './chunk.ts'
export * from './coverage.ts'
export * from './ingest.ts'
export * from './manifest.ts'
export * from './normalize.ts'
export * from './retrieve.ts'

/** Index file used when `CORPUS_INDEX_PATH` is not set (gitignored `server/data/`). */
export const DEFAULT_CORPUS_INDEX_PATH = fileURLToPath(new URL('../../data/corpus.sqlite', import.meta.url))
