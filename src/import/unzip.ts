// Reading a ZIP, without a library.
//
// This replaces `fflate`. The import routes accept a Substack or Medium export, which is a ZIP
// of HTML or CSV beside the images, and `unzipSync` was the only thing this repository ever
// asked that package for.
//
// `node:zlib` already ships the hard half. A ZIP entry is RAW deflate, and `inflateRawSync` is
// exactly that, with a `maxOutputLength` of its own. What is left is the container: a directory
// at the END of the file, and a header before each entry's bytes.
//
// THREE THINGS THIS DOES THAT `unzipSync` DID NOT, which is why it is not a straight port:
//
//   1. It inflates ONLY the entries asked for. `unzipSync` expands the whole archive into
//      memory and hands back every file; a blog export is mostly images this importer never
//      reads, so a 100 MB upload (the route's cap) paid its full inflated size for files that
//      were then dropped by a filename filter one line later.
//   2. It caps what a single entry may inflate to. A small archive can hold gigabytes of
//      repeated bytes, and this runs on a public upload route on the owner's own machine.
//   3. It returns a LIST. A ZIP may legally carry the same name twice and `unzipSync` returns
//      an object, which keeps whichever copy came last without saying so.
//
// SIZES COME FROM THE CENTRAL DIRECTORY, never from the local header. When a writer streams an
// archive it cannot know a size before compressing, so it sets flag bit 3 and writes zeros in
// the local header, putting the real numbers in a descriptor AFTER the data. The local header
// is read here for one thing only: where its variable-length fields end, because the name and
// extra lengths recorded there are allowed to differ from the ones in the directory.
import { crc32, inflateRawSync } from 'node:zlib'

const EOCD = 0x06054b50 // end of central directory
const EOCD64 = 0x06064b50 // its Zip64 replacement
const LOCATOR64 = 0x07064b50 // the pointer to that replacement, sitting just before the EOCD
const CENTRAL = 0x02014b50 // one entry, in the directory
const LOCAL = 0x04034b50 // one entry, before its bytes

const STORED = 0
const DEFLATED = 8

/** 22 bytes of record, plus a comment field that is 16 bits long and therefore this big. */
const EOCD_SCAN = 22 + 0xffff

/**
 * What one entry may inflate to. Deliberately not a total across the archive: entries are read
 * one at a time and the caller decides how many to keep, so the number that matters is how
 * much one hostile file can ask for at once.
 */
const MAX_ENTRY_BYTES = 64 * 1024 * 1024

export type ZipEntry = { name: string; bytes: Uint8Array }

export type ZipFault =
  | 'not_a_zip'
  | 'unsupported_compression'
  | 'entry_too_large'
  | 'corrupt_entry'

/** Carries WHICH way the archive was wrong, so a route can answer better than "not a zip". */
export class ZipError extends Error {
  constructor(readonly code: ZipFault, detail: string) {
    super(`${code}: ${detail}`)
    this.name = 'ZipError'
  }
}

const u16 = (b: Uint8Array, at: number): number => b[at]! | (b[at + 1]! << 8)

// `>>> 0` because the top bit of a four-byte field is a value here, not a sign. Without it a
// central directory past 2 GB reads as a negative offset and every slice below comes back empty.
const u32 = (b: Uint8Array, at: number): number =>
  (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0

/** Little-endian 64-bit, for the Zip64 records. Sizes here are capped long before 2^53. */
const u64 = (b: Uint8Array, at: number): number => u32(b, at) + u32(b, at + 4) * 0x1_0000_0000

/** The value a four-byte field carries when the real one moved into a Zip64 extra field. */
const OVERFLOWED = 0xffffffff

const utf8 = new TextDecoder('utf-8', { fatal: true })
const latin1 = new TextDecoder('latin1')

/**
 * An entry's name.
 *
 * The specification says a name is CP437 unless flag bit 11 marks it UTF-8, and that rule
 * describes almost no archive made this century. Info-ZIP, which is what `zip` is on macOS and
 * most Linux, writes UTF-8 bytes and leaves bit 11 CLEAR: an exported post called
 * `tiếng-việt.html` comes back from `fflate` as `tiáº¿ng-viá»t.html`, because reading those
 * bytes one-per-character is what the spec-shaped answer does to them.
 *
 * So the bytes decide, not the flag. Valid UTF-8 is read as UTF-8, and anything else falls back
 * to one byte per character, which is wrong in the same way as before but at least reversible.
 * CP437 proper is not implemented: it would need a 128-entry table for archives written before
 * this product existed, and the extension is ASCII either way, so the import still finds them.
 */
function entryName(bytes: Uint8Array): string {
  try {
    return utf8.decode(bytes)
  } catch {
    return latin1.decode(bytes)
  }
}

/**
 * Where the central directory starts, and how many entries it holds.
 *
 * The record is found by scanning BACKWARDS, because the archive ends with a comment of
 * arbitrary length and there is no other way to know where the record begins. Scanning forwards
 * for the signature would stop at the first four bytes of file DATA that happen to spell it.
 */
function readEnd(b: Uint8Array): { offset: number; count: number } {
  const floor = Math.max(0, b.length - EOCD_SCAN)
  for (let at = b.length - 22; at >= floor; at--) {
    if (u32(b, at) !== EOCD) continue

    let count = u16(b, at + 10)
    let offset = u32(b, at + 16)

    // Some writers emit Zip64 for every archive, small ones included. The classic record then
    // carries all-ones in the fields that overflowed, and reading those literally means walking
    // to offset 4294967295 and finding nothing: an empty import, with no error anywhere.
    if (count === 0xffff || offset === 0xffffffff) {
      const locator = at - 20
      if (locator < 0 || u32(b, locator) !== LOCATOR64) {
        throw new ZipError('not_a_zip', 'a Zip64 archive with no Zip64 locator')
      }
      const record = u64(b, locator + 8)
      if (record + 56 > b.length || u32(b, record) !== EOCD64) {
        throw new ZipError('not_a_zip', 'the Zip64 locator points at no Zip64 record')
      }
      count = u64(b, record + 32)
      offset = u64(b, record + 48)
    }

    if (offset > b.length) throw new ZipError('not_a_zip', 'the directory starts past the end')
    return { offset, count }
  }
  throw new ZipError('not_a_zip', 'no end-of-central-directory record in the last 64 KB')
}

/**
 * The three numbers an entry keeps in its Zip64 extra field, when the fixed record overflowed.
 *
 * Found the hard way: `zip -fz` writes all-ones into every size in the directory and puts the
 * real ones here, so handling Zip64 at the end-of-archive record alone reads every entry as
 * 4294967295 bytes long. That failed loudly here, which is the good version of the bug; the bad
 * version is a reader that trusts the sentinel and slices nothing.
 *
 * ORDER IS FIXED AND NOT THE RECORD'S ORDER: uncompressed, then compressed, then the local
 * header's offset, and only the ones that actually overflowed are present.
 */
function readZip64Extra(
  b: Uint8Array,
  at: number,
  len: number,
  head: { local: number; packed: number; unpacked: number },
): void {
  const end = at + len
  for (let field = at; field + 4 <= end; field += 4 + u16(b, field + 2)) {
    if (u16(b, field) !== 0x0001) continue
    let p = field + 4
    const stop = Math.min(end, p + u16(b, field + 2))
    const take = (): number => {
      if (p + 8 > stop) throw new ZipError('not_a_zip', 'a Zip64 extra field stops short')
      const value = u64(b, p)
      p += 8
      return value
    }
    if (head.unpacked === OVERFLOWED) head.unpacked = take()
    if (head.packed === OVERFLOWED) head.packed = take()
    if (head.local === OVERFLOWED) head.local = take()
    return
  }
  throw new ZipError('not_a_zip', 'an entry overflowed its record with no Zip64 extra field')
}

/** The bytes of one entry, decompressed and checked against the CRC the directory recorded. */
function readEntry(
  b: Uint8Array,
  name: string,
  head: { local: number; packed: number; unpacked: number; method: number; crc: number },
  limit: number,
): Uint8Array {
  if (head.local + 30 > b.length || u32(b, head.local) !== LOCAL) {
    throw new ZipError('corrupt_entry', `${name} has no local header`)
  }
  // The name and extra lengths HERE, not the directory's: a writer may pad the local extra
  // field differently, and using the wrong pair starts the read a few bytes into the data.
  const start = head.local + 30 + u16(b, head.local + 26) + u16(b, head.local + 28)
  const end = start + head.packed
  if (end > b.length) throw new ZipError('corrupt_entry', `${name} runs past the end`)
  if (head.unpacked > limit) {
    throw new ZipError('entry_too_large', `${name} declares ${head.unpacked} bytes`)
  }

  const packed = b.subarray(start, end)
  let bytes: Uint8Array
  if (head.method === STORED) {
    bytes = packed
  } else if (head.method === DEFLATED) {
    try {
      // The cap is enforced by zlib itself rather than after the fact, so a lying `unpacked`
      // cannot make this allocate first and complain second.
      bytes = new Uint8Array(inflateRawSync(packed, { maxOutputLength: limit }))
    } catch (cause) {
      const tooBig = cause instanceof Error && /larger than/.test(cause.message)
      throw new ZipError(tooBig ? 'entry_too_large' : 'corrupt_entry', `${name} did not inflate`)
    }
  } else {
    throw new ZipError('unsupported_compression', `${name} uses method ${head.method}`)
  }

  // A wrong CRC means the bytes are not what was stored. Decoding them as text anyway is how a
  // truncated upload becomes a post full of replacement characters that nobody can explain.
  if ((crc32(bytes) >>> 0) !== head.crc) {
    throw new ZipError('corrupt_entry', `${name} failed its checksum`)
  }
  return bytes
}

/**
 * Every entry the archive holds, or only the ones `keep` says yes to.
 *
 * `keep` is applied to the NAME, before anything is decompressed, which is the whole point of
 * it: the caller filters on `.html` and `.csv`, and the images in the same archive are never
 * touched.
 *
 * Directory entries (a name ending in `/`) are not entries and are dropped without asking.
 */
export function unzip(
  archive: Uint8Array,
  keep: (name: string) => boolean = () => true,
  limit: number = MAX_ENTRY_BYTES,
): ZipEntry[] {
  const { offset, count } = readEnd(archive)
  const out: ZipEntry[] = []


  let at = offset
  for (let i = 0; i < count; i++) {
    if (at + 46 > archive.length || u32(archive, at) !== CENTRAL) {
      throw new ZipError('not_a_zip', `entry ${i + 1} of ${count} is not a directory record`)
    }
    const nameLen = u16(archive, at + 28)
    const extraLen = u16(archive, at + 30)
    const commentLen = u16(archive, at + 32)
    const name = entryName(archive.subarray(at + 46, at + 46 + nameLen))

    if (!name.endsWith('/') && keep(name)) {
      const head = {
        local: u32(archive, at + 42),
        packed: u32(archive, at + 20),
        unpacked: u32(archive, at + 24),
        method: u16(archive, at + 10),
        crc: u32(archive, at + 16),
      }
      if (head.local === OVERFLOWED || head.packed === OVERFLOWED || head.unpacked === OVERFLOWED) {
        readZip64Extra(archive, at + 46 + nameLen, extraLen, head)
      }
      out.push({ name, bytes: readEntry(archive, name, head, limit) })
    }
    at += 46 + nameLen + extraLen + commentLen
  }
  return out
}
