// Corpus ingestion (feature 002 FR-002, FR-003): validates the manifest, chunks every extract, and
// rebuilds the search index in one transaction. The index is a separate SQLite file built ahead
// of time (`npm run corpus:ingest -w server`), never at request time.
import { createHash } from 'node:crypto'
import { readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { chunkMarkdown, type Chunk } from './chunk.ts'
import { loadManifest, type CorpusManifest } from './manifest.ts'
import { normalizeName } from './normalize.ts'

/** Bump when the index tables change; the retriever refuses an index with another version. */
export const INDEX_SCHEMA_VERSION = '1'

const SCHEMA = `
DROP TABLE IF EXISTS passages_fts;
DROP TABLE IF EXISTS passages;
DROP TABLE IF EXISTS document_models;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS model_names;
DROP TABLE IF EXISTS manufacturer_names;
DROP TABLE IF EXISTS meta;
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE manufacturer_names (spelling TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE model_names (
  manufacturer TEXT NOT NULL, spelling TEXT NOT NULL, model TEXT NOT NULL,
  PRIMARY KEY (manufacturer, spelling)
);
CREATE TABLE documents (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, publisher TEXT NOT NULL,
  topic TEXT NOT NULL, accessed_on TEXT NOT NULL, terms TEXT NOT NULL, generic INTEGER NOT NULL
);
CREATE TABLE document_models (
  document_id TEXT NOT NULL REFERENCES documents(id), manufacturer TEXT NOT NULL, model TEXT NOT NULL,
  PRIMARY KEY (document_id, manufacturer, model)
);
CREATE TABLE passages (
  rowid INTEGER PRIMARY KEY, passage_id TEXT NOT NULL UNIQUE, document_id TEXT NOT NULL REFERENCES documents(id),
  ord INTEGER NOT NULL, section TEXT, page INTEGER, text TEXT NOT NULL
);
-- Porter stemming so "soldered" matches "solder"; unicode61 also folds diacritics in German sources.
CREATE VIRTUAL TABLE passages_fts USING fts5(
  section, text, content='passages', content_rowid='rowid', tokenize='porter unicode61'
);
`

export interface IngestedDocument {
  id: string
  chunks: Chunk[]
}

export interface IngestStats {
  documents: number
  passages: number
  /** SHA-256 over the manifest and all extracts; equal hashes mean an unchanged corpus. */
  corpus_hash: string
}

/** Reads and chunks every document. Throws `ManifestError` naming each invalid entry. */
export function readCorpus(corpusDir: string, maxChars?: number): { manifest: CorpusManifest; documents: IngestedDocument[]; hash: string } {
  const manifestText = readFileSync(join(corpusDir, 'manifest.yaml'), 'utf8')
  const manifest = loadManifest(corpusDir)
  const hash = createHash('sha256').update(manifestText)
  const documents = manifest.documents.map((doc) => {
    const text = readFileSync(join(corpusDir, doc.file), 'utf8')
    hash.update('\0').update(doc.id).update('\0').update(text)
    const chunks = chunkMarkdown(doc.id, text, { fallbackSection: doc.title, ...(maxChars ? { maxChars } : {}) })
    if (chunks.length === 0) throw new Error(`document ${doc.id}: ${doc.file} contains no text`)
    return { id: doc.id, chunks }
  })
  return { manifest, documents, hash: hash.digest('hex') }
}

/** Replaces the whole index in `db` with the given corpus. */
export function writeIndex(db: DatabaseSync, corpus: ReturnType<typeof readCorpus>): IngestStats {
  const { manifest, documents, hash } = corpus
  db.exec('BEGIN')
  try {
    db.exec(SCHEMA)
    const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)')
    meta.run('schema_version', INDEX_SCHEMA_VERSION)
    meta.run('corpus_hash', hash)

    const manufacturer = db.prepare('INSERT OR REPLACE INTO manufacturer_names (spelling, name) VALUES (?, ?)')
    for (const m of manifest.manufacturers) for (const s of [m.name, ...m.aliases]) manufacturer.run(normalizeName(s), m.name)
    const model = db.prepare('INSERT OR REPLACE INTO model_names (manufacturer, spelling, model) VALUES (?, ?, ?)')
    for (const m of manifest.models) for (const s of [m.model, ...m.aliases]) model.run(m.manufacturer, normalizeName(s), m.model)

    const doc = db.prepare(
      'INSERT INTO documents (id, title, url, publisher, topic, accessed_on, terms, generic) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    const docModel = db.prepare('INSERT INTO document_models (document_id, manufacturer, model) VALUES (?, ?, ?)')
    const passage = db.prepare('INSERT INTO passages (passage_id, document_id, ord, section, page, text) VALUES (?, ?, ?, ?, ?, ?)')
    let passages = 0
    for (const [i, d] of manifest.documents.entries()) {
      const generic = d.applies_to === 'generic'
      doc.run(d.id, d.title, d.url, d.publisher, d.topic, d.accessed_on, d.terms, generic ? 1 : 0)
      if (d.applies_to !== 'generic') for (const ref of d.applies_to) docModel.run(d.id, ref.manufacturer, ref.model)
      for (const c of documents[i]!.chunks) {
        passage.run(c.passage_id, d.id, c.ord, c.section, c.page, c.text)
        passages++
      }
    }
    db.exec("INSERT INTO passages_fts (passages_fts) VALUES ('rebuild')")
    db.exec('COMMIT')
    return { documents: manifest.documents.length, passages, corpus_hash: hash }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/**
 * Builds the index file at `indexPath`. Writes to a temporary file first and renames it, so a
 * failed ingestion leaves the previous index untouched.
 */
export function ingestCorpus(corpusDir: string, indexPath: string): IngestStats {
  const corpus = readCorpus(corpusDir)
  const tmp = `${indexPath}.tmp`
  rmSync(tmp, { force: true })
  const db = new DatabaseSync(tmp)
  try {
    const stats = writeIndex(db, corpus)
    db.close()
    renameSync(tmp, indexPath)
    return stats
  } catch (error) {
    if (db.isOpen) db.close()
    rmSync(tmp, { force: true })
    throw error
  }
}
