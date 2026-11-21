// Builds small deflate zip archives for tests, like the macOS app archive CI produces.
import { crc32, deflateRawSync } from 'node:zlib'

export interface TestEntry {
  name: string
  data: string
  /** Write sizes and CRC in a data descriptor after the data, as ditto does. */
  descriptor?: boolean
}

/** A small deflate zip like the macOS app archive: local records, central directory, end record. */
export function makeZip(entries: TestEntry[], comment = ''): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const e of entries) {
    const raw = Buffer.from(e.data)
    const comp = deflateRawSync(raw)
    const name = Buffer.from(e.name)
    const crc = crc32(raw)
    const flags = e.descriptor ? 0x08 : 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(flags, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(e.descriptor ? 0 : crc, 14)
    local.writeUInt32LE(e.descriptor ? 0 : comp.length, 18)
    local.writeUInt32LE(e.descriptor ? 0 : raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    const parts = [local, name, comp]
    if (e.descriptor) {
      const d = Buffer.alloc(16)
      d.writeUInt32LE(0x08074b50, 0)
      d.writeUInt32LE(crc, 4)
      d.writeUInt32LE(comp.length, 8)
      d.writeUInt32LE(raw.length, 12)
      parts.push(d)
    }
    const record = Buffer.concat(parts)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(0x031e, 4) // made by Unix, so the external attributes hold permissions
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(flags, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(comp.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE((0o100755 << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(Buffer.concat([central, name]))
    locals.push(record)
    offset += record.length
  }
  const cd = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(comment.length, 20)
  return Buffer.concat([...locals, cd, end, Buffer.from(comment)])
}
