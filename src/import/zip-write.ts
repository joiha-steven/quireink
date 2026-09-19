// Writing a ZIP, without a library — the other half of `unzip.ts`.
//
// The owner's export leaves as a ZIP rather than as the tar.gz the backup uses, for one
// reason: a ZIP is what the place they are going to already knows how to read. Every blog
// platform's importer takes one, this repository's own importers take one, and it opens with
// a double click on every operating system a reader of this file is likely to hold.
//
// `node:zlib` ships both hard halves again: `deflateRawSync` is exactly a ZIP entry's
// compression, and `crc32` takes a seed, so a large file's checksum is computed as it streams
// rather than by holding the file in memory to checksum it.
//
// TWO METHODS, CHOSEN BY WHAT THE BYTES ARE:
//
//   Text (Markdown, JSON) is DEFLATED. It is small, it is buffered, and it compresses.
//   An upload is STORED. A webp, an avif, a jpeg and an mp4 are already compressed, so
//   deflating one spends CPU to gain a fraction of a percent — and, which matters more here,
//   a stored entry's compressed size is its file size, known BEFORE the local header is
//   written. That is what lets a two-gigabyte video stream through this writer instead of
//   being held whole in memory to find out how long it turned out to be.
//
// ZIP64 IS WRITTEN ONLY WHEN A FIELD ACTUALLY OVERFLOWS, which is the shape `unzip.ts` was
// taught to read after an archive written by `zip -fz` put all-ones in every size. The order
// of the Zip64 extra's members is fixed by the specification and is NOT the record's order:
// uncompressed, compressed, local offset, and only the ones that overflowed.

import { crc32, deflateRawSync } from 'node:zlib'

const LOCAL = 0x04034b50
const CENTRAL = 0x02014b50
const EOCD = 0x06054b50
const EOCD64 = 0x06064b50
const LOCATOR64 = 0x07064b50

const STORED = 0
const DEFLATED = 8

/** The value a fixed field carries when the real one has moved to a Zip64 extra. */
const OVERFLOW32 = 0xffffffff
const OVERFLOW16 = 0xffff

/** Flag bit 11: the name is UTF-8. Set always, because these names come from post titles. */
const UTF8_NAME = 0x0800

/** `0o644 << 16`: a regular file, readable by everyone, writable by its owner. */
const UNIX_MODE = 0o100644 << 16

type Entry = {
  name: Uint8Array
  crc: number
  packed: number
  unpacked: number
  method: number
  local: number
  dos: { time: number; date: number }
}

/** Anything that takes bytes in order. `Bun.file(path).writer()` is one; an array is another. */
export type ByteSink = { write(bytes: Uint8Array): unknown }

const enc = new TextEncoder()

/** MS-DOS packs a timestamp into two 16-bit words, with two-second resolution and a 1980 epoch. */
function dosStamp(at: Date): { time: number; date: number } {
  const year = Math.max(1980, at.getFullYear())
  return {
    time: (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
  }
}

/** A little-endian writer over a fixed-size record. */
class Rec {
  readonly bytes: Uint8Array
  private at = 0
  constructor(size: number) { this.bytes = new Uint8Array(size) }
  u16(v: number): this { this.bytes[this.at++] = v & 0xff; this.bytes[this.at++] = (v >>> 8) & 0xff; return this }
  u32(v: number): this {
    for (let i = 0; i < 4; i++) this.bytes[this.at++] = (v >>> (i * 8)) & 0xff
    return this
  }
  /** Numbers here come from file sizes and offsets, which stay inside the 2^53 JS can hold. */
  u64(v: number): this {
    const lo = v >>> 0
    const hi = Math.floor(v / 0x100000000)
    return this.u32(lo).u32(hi)
  }
}

export class ZipWriter {
  private readonly entries: Entry[] = []
  private offset = 0
  private readonly stamp: { time: number; date: number }

  /**
   * @param sink where the bytes go, in order.
   * @param at the timestamp every entry carries. ONE for the whole archive rather than each
   *   file's own mtime: the store's mtimes are when this server happened to write a variant,
   *   which says nothing about the writing and makes two exports of one blog differ.
   */
  constructor(private readonly sink: ByteSink, at: Date = new Date()) {
    this.stamp = dosStamp(at)
  }

  private put(bytes: Uint8Array): void {
    this.sink.write(bytes)
    this.offset += bytes.length
  }

  /** The 30-byte local header, plus the name and any Zip64 extra. */
  private header(name: Uint8Array, e: Omit<Entry, 'name' | 'local' | 'dos'>): void {
    const big = e.packed >= OVERFLOW32 || e.unpacked >= OVERFLOW32
    const extra = big ? 20 : 0
    const r = new Rec(30)
      .u32(LOCAL).u16(big ? 45 : 20).u16(UTF8_NAME).u16(e.method)
      .u16(this.stamp.time).u16(this.stamp.date).u32(e.crc)
      .u32(big ? OVERFLOW32 : e.packed).u32(big ? OVERFLOW32 : e.unpacked)
      .u16(name.length).u16(extra)
    this.put(r.bytes)
    this.put(name)
    // The LOCAL extra's order is the record's own: uncompressed then compressed, both always
    // present. Only the CENTRAL one omits the members that did not overflow.
    if (big) this.put(new Rec(20).u16(0x0001).u16(16).u64(e.unpacked).u64(e.packed).bytes)
  }

  /** A text file: deflated, and buffered because it is small enough to be. */
  addText(path: string, text: string): void {
    const raw = enc.encode(text)
    const packed = new Uint8Array(deflateRawSync(raw))
    // A tiny or incompressible file can deflate LARGER than it started. Storing it then is
    // both smaller and faster to read back.
    const useDeflate = packed.length < raw.length
    const body = useDeflate ? packed : raw
    const name = enc.encode(path)
    const local = this.offset
    const meta = {
      crc: crc32(raw), packed: body.length, unpacked: raw.length,
      method: useDeflate ? DEFLATED : STORED,
    }
    this.header(name, meta)
    this.put(body)
    this.entries.push({ name, local, dos: this.stamp, ...meta })
  }

  /**
   * A file on disk: stored, and streamed a megabyte at a time.
   *
   * The size is taken ONCE, before the header is written, and exactly that many bytes are
   * then copied. A file being appended to while this runs would otherwise write more bytes
   * than its header declares, which produces an archive that opens and is wrong — the worst
   * of the three outcomes.
   */
  async addFile(path: string, from: string): Promise<void> {
    const file = Bun.file(from)
    const size = file.size
    const name = enc.encode(path)
    const local = this.offset
    let crc = 0
    // The CRC is needed in the header, which is written first, so the file is read twice:
    // once to check it, once to copy it. Two sequential reads of a local file beat holding
    // a video in memory, and this runs off the request path in a staging directory.
    const stream = file.stream()
    for await (const chunk of stream) crc = crc32(chunk, crc)
    this.header(name, { crc, packed: size, unpacked: size, method: STORED })
    let written = 0
    for await (const chunk of file.stream()) {
      const room = size - written
      if (room <= 0) break
      const take = chunk.length <= room ? chunk : chunk.subarray(0, room)
      this.put(take)
      written += take.length
    }
    // A file that SHRANK between the two reads would leave the archive short by the
    // difference, and every offset after it correct only by accident. Pad rather than lie.
    if (written < size) this.put(new Uint8Array(size - written))
    this.entries.push({ name, local, crc, packed: size, unpacked: size, method: STORED, dos: this.stamp })
  }

  /** The central directory and the end record. Nothing may be added after this. */
  finish(): void {
    const start = this.offset
    for (const e of this.entries) {
      // Only the members that overflowed are written, in the order the specification fixes:
      // uncompressed, compressed, local offset. `unzip.ts` reads them back in exactly this
      // order and would mis-assign them in any other.
      const over: number[] = []
      if (e.unpacked >= OVERFLOW32) over.push(e.unpacked)
      if (e.packed >= OVERFLOW32) over.push(e.packed)
      if (e.local >= OVERFLOW32) over.push(e.local)
      const extra = over.length > 0 ? 4 + over.length * 8 : 0
      const r = new Rec(46)
        .u32(CENTRAL).u16(45 | (3 << 8)).u16(extra > 0 ? 45 : 20).u16(UTF8_NAME).u16(e.method)
        .u16(e.dos.time).u16(e.dos.date).u32(e.crc)
        .u32(e.packed >= OVERFLOW32 ? OVERFLOW32 : e.packed)
        .u32(e.unpacked >= OVERFLOW32 ? OVERFLOW32 : e.unpacked)
        .u16(e.name.length).u16(extra).u16(0).u16(0).u16(0)
        .u32(UNIX_MODE)
        .u32(e.local >= OVERFLOW32 ? OVERFLOW32 : e.local)
      this.put(r.bytes)
      this.put(e.name)
      if (extra > 0) {
        const x = new Rec(extra).u16(0x0001).u16(extra - 4)
        for (const v of over) x.u64(v)
        this.put(x.bytes)
      }
    }
    const size = this.offset - start
    const count = this.entries.length
    const big = count >= OVERFLOW16 || start >= OVERFLOW32 || size >= OVERFLOW32
    if (big) {
      const here = this.offset
      this.put(new Rec(56)
        .u32(EOCD64).u64(44).u16(45 | (3 << 8)).u16(45).u32(0).u32(0)
        .u64(count).u64(count).u64(size).u64(start).bytes)
      this.put(new Rec(20).u32(LOCATOR64).u32(0).u64(here).u32(1).bytes)
    }
    this.put(new Rec(22)
      .u32(EOCD).u16(0).u16(0)
      .u16(big ? OVERFLOW16 : count).u16(big ? OVERFLOW16 : count)
      .u32(big ? OVERFLOW32 : size).u32(big ? OVERFLOW32 : start).u16(0).bytes)
  }
}
