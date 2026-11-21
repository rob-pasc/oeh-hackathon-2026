// Renames the top-level folder of a zip archive without recompressing it (feature 007 FR-012).
//
// The macOS scanner is a signed .app bundle in a zip. A session download must carry the session
// ID, but changing anything inside the bundle would break its signature, so the server renames
// the bundle itself: "leaaf-scanner.app/…" becomes "leaaf-scanner-<session>.app/…". Only names
// and offsets change; each entry's compressed data, CRC and data descriptor are copied as they are.
// Zip64 archives are not supported (the app is a few megabytes).

const EOCD_SIG = 0x06054b50
const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50

interface Entry {
  name: string
  central: Buffer
  localOffset: number
}

export class ZipError extends Error {}

function findEndOfCentralDirectory(zip: Buffer): number {
  // The record is 22 bytes plus a comment of up to 65535 bytes at the very end.
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--)
    if (zip.readUInt32LE(i) === EOCD_SIG) return i
  throw new ZipError('not a zip archive')
}

function readEntries(zip: Buffer, eocd: number): { entries: Entry[]; cdOffset: number } {
  const count = zip.readUInt16LE(eocd + 10)
  const cdSize = zip.readUInt32LE(eocd + 12)
  const cdOffset = zip.readUInt32LE(eocd + 16)
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ZipError('zip64 is not supported')
  const entries: Entry[] = []
  let p = cdOffset
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(p) !== CENTRAL_SIG) throw new ZipError('corrupt central directory')
    const nameLen = zip.readUInt16LE(p + 28)
    const extraLen = zip.readUInt16LE(p + 30)
    const commentLen = zip.readUInt16LE(p + 32)
    const end = p + 46 + nameLen + extraLen + commentLen
    entries.push({
      name: zip.toString('utf8', p + 46, p + 46 + nameLen),
      central: zip.subarray(p, end),
      localOffset: zip.readUInt32LE(p + 42),
    })
    p = end
  }
  return { entries, cdOffset }
}

/** Replaces the first path segment `from` (and `__MACOSX/from`) with `to` in every entry name. */
export function renameZipRoot(zip: Buffer, from: string, to: string): Buffer {
  const rename = (name: string) => {
    for (const prefix of ['', '__MACOSX/'])
      if (name === prefix + from || name.startsWith(prefix + from + '/')) return prefix + to + name.slice(prefix.length + from.length)
    return name
  }
  const eocd = findEndOfCentralDirectory(zip)
  const { entries, cdOffset } = readEntries(zip, eocd)
  // Local records are copied in file order; each runs until the next one (or the central
  // directory) starts, which covers the data and any data descriptor.
  const byOffset = [...entries].sort((a, b) => a.localOffset - b.localOffset)
  const parts: Buffer[] = []
  const newOffsets = new Map<Entry, number>()
  let written = 0
  byOffset.forEach((entry, i) => {
    const start = entry.localOffset
    const end = i + 1 < byOffset.length ? byOffset[i + 1]!.localOffset : cdOffset
    if (zip.readUInt32LE(start) !== LOCAL_SIG) throw new ZipError('corrupt local header')
    const nameLen = zip.readUInt16LE(start + 26)
    const name = Buffer.from(rename(zip.toString('utf8', start + 30, start + 30 + nameLen)), 'utf8')
    const header = Buffer.from(zip.subarray(start, start + 30))
    header.writeUInt16LE(name.length, 26)
    const rest = zip.subarray(start + 30 + nameLen, end)
    newOffsets.set(entry, written)
    parts.push(header, name, rest)
    written += header.length + name.length + rest.length
  })
  const newCdOffset = written
  for (const entry of entries) {
    const oldNameLen = entry.central.readUInt16LE(28)
    const name = Buffer.from(rename(entry.name), 'utf8')
    const fixed = Buffer.from(entry.central.subarray(0, 46))
    fixed.writeUInt16LE(name.length, 28)
    fixed.writeUInt32LE(newOffsets.get(entry)!, 42)
    const tail = entry.central.subarray(46 + oldNameLen)
    parts.push(fixed, name, tail)
    written += fixed.length + name.length + tail.length
  }
  const end = Buffer.from(zip.subarray(eocd))
  end.writeUInt32LE(written - newCdOffset, 12)
  end.writeUInt32LE(newCdOffset, 16)
  parts.push(end)
  return Buffer.concat(parts)
}
