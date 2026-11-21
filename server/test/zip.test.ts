import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, inflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { renameZipRoot, ZipError } from '../src/downloads/zip.ts'
import { makeZip } from './make-zip.ts'

/** Reads every entry back through the central directory and its local header. */
function readZip(zip: Buffer): Map<string, string> {
  let eocd = zip.length - 22
  while (zip.readUInt32LE(eocd) !== 0x06054b50) eocd--
  const count = zip.readUInt16LE(eocd + 10)
  let p = zip.readUInt32LE(eocd + 16)
  const out = new Map<string, string>()
  for (let i = 0; i < count; i++) {
    const nameLen = zip.readUInt16LE(p + 28)
    const name = zip.toString('utf8', p + 46, p + 46 + nameLen)
    const size = zip.readUInt32LE(p + 20)
    const crc = zip.readUInt32LE(p + 16)
    const local = zip.readUInt32LE(p + 42)
    expect(zip.readUInt32LE(local)).toBe(0x04034b50)
    expect(zip.toString('utf8', local + 30, local + 30 + zip.readUInt16LE(local + 26))).toBe(name)
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    const data = inflateRawSync(zip.subarray(start, start + size))
    expect(crc32(data)).toBe(crc)
    out.set(name, data.toString())
    p += 46 + nameLen + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32)
  }
  return out
}

const APP = [
  { name: 'leaaf-scanner.app/', data: '' },
  { name: 'leaaf-scanner.app/Contents/Info.plist', data: '<plist>info</plist>' },
  { name: 'leaaf-scanner.app/Contents/MacOS/leaaf-scanner', data: 'machine code '.repeat(500), descriptor: true },
  { name: '__MACOSX/leaaf-scanner.app/._Info.plist', data: 'apple double' },
  { name: 'README.txt', data: 'not inside the bundle' },
]

describe('renameZipRoot', () => {
  it('renames the bundle folder and keeps every entry intact', () => {
    const renamed = renameZipRoot(makeZip(APP, 'built by CI'), 'leaaf-scanner.app', 'leaaf-scanner-SESSION.app')
    const entries = readZip(renamed)
    expect([...entries.keys()]).toEqual([
      'leaaf-scanner-SESSION.app/',
      'leaaf-scanner-SESSION.app/Contents/Info.plist',
      'leaaf-scanner-SESSION.app/Contents/MacOS/leaaf-scanner',
      '__MACOSX/leaaf-scanner-SESSION.app/._Info.plist',
      'README.txt',
    ])
    expect(entries.get('leaaf-scanner-SESSION.app/Contents/MacOS/leaaf-scanner')).toBe('machine code '.repeat(500))
    expect(renamed.subarray(-11).toString()).toBe('built by CI')
  })

  it('produces an archive a standard tool accepts', (ctx) => {
    let python = true
    try {
      execFileSync('python3', ['--version'])
    } catch {
      python = false
    }
    if (!python) return ctx.skip()
    const dir = mkdtempSync(join(tmpdir(), 'leaaf-zip-'))
    const path = join(dir, 'app.zip')
    writeFileSync(path, renameZipRoot(makeZip(APP), 'leaaf-scanner.app', 'leaaf-scanner-SESSION.app'))
    const listing = execFileSync('python3', ['-I', '-m', 'zipfile', '-t', path]).toString()
    expect(listing).toContain('Done testing')
  })

  it('does not touch names that only start like the bundle', () => {
    const zip = makeZip([{ name: 'leaaf-scanner.application/x', data: 'x' }])
    expect([...readZip(renameZipRoot(zip, 'leaaf-scanner.app', 'other.app')).keys()]).toEqual(['leaaf-scanner.application/x'])
  })

  it('rejects something that is not a zip', () => {
    expect(() => renameZipRoot(Buffer.from('MZ not a zip at all, just some bytes'), 'a', 'b')).toThrow(ZipError)
  })
})
