// Splits a Markdown extract into passages that keep their location (feature 002 FR-003).
//
// Extract format (corpus/README.md): headings name the source's own sections, and a line
// `<!-- page: N -->` sets the source page for the text after it. A passage never spans a heading
// or a page marker, so each citation points at exactly one section and page. Chunks do not overlap:
// the extracts are short curated quotations, and overlap would make two passages cite the same text.
//
// The output depends only on the input, so re-ingesting an unchanged corpus yields identical IDs.

export interface Chunk {
  passage_id: string
  /** Order within the document, from 0. */
  ord: number
  section: string | null
  page: number | null
  text: string
}

export interface ChunkOptions {
  /** Soft upper bound on passage length; paragraphs are only split when they alone exceed it. */
  maxChars?: number
  /** Section used for text before the first heading when it has no page either. */
  fallbackSection: string
}

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const PAGE = /^<!--\s*page:\s*(\d+)\s*-->$/i
const COMMENT = /^<!--.*-->$/

export function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  return slug || 'section'
}

/** Splits an over-long paragraph at sentence ends, keeping pieces under `max` where possible. */
function splitParagraph(text: string, max: number): string[] {
  if (text.length <= max) return [text]
  const sentences = text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)\s*/g) ?? [text]
  const pieces: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > max) {
      pieces.push(current.trim())
      current = ''
    }
    current += sentence
  }
  if (current.trim()) pieces.push(current.trim())
  return pieces
}

interface Block {
  section: string | null
  page: number | null
  paragraphs: string[]
}

function blocks(markdown: string): Block[] {
  const result: Block[] = []
  let section: string | null = null
  let page: number | null = null
  let block: Block = { section, page, paragraphs: [] }
  let lines: string[] = []

  const endParagraph = () => {
    if (lines.length > 0) block.paragraphs.push(lines.join('\n'))
    lines = []
  }
  const endBlock = () => {
    endParagraph()
    if (block.paragraphs.length > 0) result.push(block)
    block = { section, page, paragraphs: [] }
  }

  for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    const heading = HEADING.exec(line)
    const pageMarker = PAGE.exec(line)
    if (heading) {
      endBlock()
      section = heading[2] || section
      block.section = section
    } else if (pageMarker) {
      endBlock()
      page = Number(pageMarker[1])
      block.page = page
    } else if (COMMENT.test(line)) {
      continue
    } else if (line === '') {
      endParagraph()
    } else {
      lines.push(line)
    }
  }
  endBlock()
  return result
}

export function chunkMarkdown(documentId: string, markdown: string, options: ChunkOptions): Chunk[] {
  const maxChars = options.maxChars ?? 1000
  const chunks: Chunk[] = []
  const countBySlug = new Map<string, number>()

  const push = (block: Block, text: string) => {
    const section = block.section ?? (block.page === null ? options.fallbackSection : null)
    const slug = section ? slugify(section) : `p${block.page}`
    const n = (countBySlug.get(slug) ?? 0) + 1
    countBySlug.set(slug, n)
    chunks.push({ passage_id: `${documentId}#${slug}-${n}`, ord: chunks.length, section, page: block.page, text })
  }

  for (const block of blocks(markdown)) {
    let current = ''
    for (const paragraph of block.paragraphs.flatMap((p) => splitParagraph(p, maxChars))) {
      if (current && current.length + 2 + paragraph.length > maxChars) {
        push(block, current)
        current = ''
      }
      current = current ? `${current}\n\n${paragraph}` : paragraph
    }
    if (current) push(block, current)
  }
  return chunks
}
