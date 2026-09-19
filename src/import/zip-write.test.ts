// THE WRITER IS CHECKED BY THE READER THIS REPOSITORY ALREADY HAD.
//
// `unzip.ts` is the code that reads a Substack and a Medium export, and it was written against
// archives produced by other people's tools. Asking it to read what `zip-write.ts` produces is
// therefore not two halves of one idea agreeing with each other: it is the new half being held
// to a container format the old half already knew, independently, how to parse.
//
// It is not the whole proof. A reader and a writer can agree on the same misreading of a
// specification, so the cases below also assert bytes at fixed offsets — the signature, the
// UTF-8 flag, the method actually chosen — which only the specification can settle.
import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzip, ZipError } from '@/import/unzip'
import { ZipWriter, type ByteSink } from '@/import/zip-write'

/** Collects what the writer emits, in order, and hands back one buffer. */
function collector(): { sink: ByteSink; bytes: () => Uint8Array } {
  const parts: Uint8Array[] = []
  return {
    sink: { write: (b: Uint8Array) => parts.push(new Uint8Array(b)) },
    bytes: () => {
      const total = parts.reduce((n, p) => n + p.length, 0)
      const out = new Uint8Array(total)
      let at = 0
      for (const p of parts) { out.set(p, at); at += p.length }
      return out
    },
  }
}

const AT = new Date('2026-09-19T10:30:00Z')
const dec = new TextDecoder()
const u16 = (b: Uint8Array, at: number): number => b[at]! | (b[at + 1]! << 8)
const u32 = (b: Uint8Array, at: number): number =>
  (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0

/** The nth CENTRAL directory record's method and packed size, read straight from the bytes. */
function unzipRecordAt(b: Uint8Array, index: number): { method: number; packed: number } {
  let at = u32(b, b.length - 6)
  for (let i = 0; i < index; i++) at += 46 + u16(b, at + 28) + u16(b, at + 30) + u16(b, at + 32)
  return { method: u16(b, at + 10), packed: u32(b, at + 20) }
}

describe('the ZIP writer', () => {
  it('writes text the reader reads back, byte for byte', async () => {
    const c = collector()
    const zip = new ZipWriter(c.sink, AT)
    const body = `---\ntitle: "Xin chào"\n---\n\n${'Một câu tiếng Việt. '.repeat(40)}`
    zip.addText('posts/xin-chao.md', body)
    zip.addText('site.json', '{"title":"My Blog"}')
    zip.finish()

    const out = unzip(c.bytes())
    expect(out.map((e) => e.name)).toEqual(['posts/xin-chao.md', 'site.json'])
    expect(dec.decode(out[0]!.bytes)).toBe(body)
    expect(dec.decode(out[1]!.bytes)).toBe('{"title":"My Blog"}')
  })

  it('keeps a non-ASCII name, and flags it as UTF-8 so a reader does not guess', async () => {
    const c = collector()
    const zip = new ZipWriter(c.sink, AT)
    // A slug can hold any letter the owner writes in, and the classic ZIP name encoding is
    // CP437. Bit 11 is the only thing that tells a reader otherwise.
    zip.addText('posts/thư-gửi-mẹ.md', 'x')
    zip.finish()
    const bytes = c.bytes()
    expect(u32(bytes, 0)).toBe(0x04034b50)
    expect(u16(bytes, 6) & 0x0800).toBe(0x0800)
    expect(unzip(bytes)[0]!.name).toBe('posts/thư-gửi-mẹ.md')
  })

  it('stores a file that deflate would make bigger, and says so in the record', async () => {
    const c = collector()
    const zip = new ZipWriter(c.sink, AT)
    zip.addText('a.md', 'x')                      // one byte: deflate adds overhead
    zip.addText('b.md', 'yyyy'.repeat(500))       // compressible
    zip.finish()
    expect(u16(c.bytes(), 8)).toBe(0)             // first entry's method: stored
    const out = unzip(c.bytes())
    expect(dec.decode(out[0]!.bytes)).toBe('x')
    expect(dec.decode(out[1]!.bytes)).toBe('yyyy'.repeat(500))
    // And the compressible one really WAS deflated: its stored length in the record is under
    // its 2,000 real bytes. Without this the line above is satisfied by a writer that stores
    // everything, and the method choice would be untested in the direction that saves bytes.
    expect(out[1]!.bytes.length).toBe(2000)
    const second = unzipRecordAt(c.bytes(), 1)
    expect(second.method).toBe(8)
    expect(second.packed).toBeLessThan(2000)
  })

  it('streams a file off disk, stored and byte-identical', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'quire-zip-'))
    try {
      // Bytes that do NOT compress, which is the case `addFile` exists for: an upload is
      // already a compressed picture, and storing it is both faster and no larger.
      const blob = new Uint8Array(300_000)
      for (let i = 0; i < blob.length; i++) blob[i] = (i * 2654435761) & 0xff
      const path = join(dir, 'photo.webp')
      writeFileSync(path, blob)

      const c = collector()
      const zip = new ZipWriter(c.sink, AT)
      await zip.addFile('uploads/photo.webp', path)
      zip.finish()

      const out = unzip(c.bytes())
      expect(out).toHaveLength(1)
      expect(out[0]!.name).toBe('uploads/photo.webp')
      expect(out[0]!.bytes).toEqual(blob)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('writes a real CRC, so a flipped byte is caught rather than served', async () => {
    const c = collector()
    const zip = new ZipWriter(c.sink, AT)
    zip.addText('a.md', 'the quick brown fox'.repeat(20))
    zip.finish()
    const bytes = c.bytes()
    // The counter-test for every round trip above: they would all pass against a writer that
    // wrote zero for the checksum, because nothing else in them looks at it. Corrupt the
    // DATA — not the record — and the reader must refuse.
    const corrupt = new Uint8Array(bytes)
    corrupt[60] = corrupt[60]! ^ 0xff
    expect(() => unzip(corrupt)).toThrow(ZipError)
    expect(() => unzip(bytes)).not.toThrow()
  })

  it('handles an empty file and an empty archive', async () => {
    const c = collector()
    const zip = new ZipWriter(c.sink, AT)
    zip.addText('empty.md', '')
    zip.finish()
    expect(unzip(c.bytes())).toEqual([{ name: 'empty.md', bytes: new Uint8Array(0) }])

    const e = collector()
    new ZipWriter(e.sink, AT).finish()
    expect(unzip(e.bytes())).toEqual([])
  })

  it('crosses into Zip64 when the entry count outgrows the classic record', async () => {
    // 65,535 is the largest count the end record can hold, so this is the first archive that
    // needs the Zip64 record and its locator. A blog of ten thousand posts plus its uploads
    // reaches it, and the failure without it is not an error: the classic field wraps and a
    // reader is told there are fewer entries than there are.
    //
    // ⚠️ THE OTHER ZIP64 BRANCH — a single entry or an archive over 4 GiB — IS NOT EXERCISED
    // HERE, because reaching it means writing four gigabytes. It is the same record shape in
    // the same layout, and the entry extra's member ORDER is asserted by `unzip.ts` reading
    // it, but this test has not seen it. Named rather than left as a silence.
    const c = collector()
    const zip = new ZipWriter(c.sink, AT)
    for (let i = 0; i < 0xffff + 1; i++) zip.addText(`n/${i}.md`, 'x')
    zip.finish()
    const bytes = c.bytes()
    const out = unzip(bytes, (n) => n === 'n/0.md' || n === 'n/65535.md')
    expect(out.map((e) => e.name).sort()).toEqual(['n/0.md', 'n/65535.md'])
    expect(dec.decode(out[0]!.bytes)).toBe('x')
  })
})
