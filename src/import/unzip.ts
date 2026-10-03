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

/**
 * What all the kept entries may inflate to together. Each entry was capped and the sum was not:
 * a thousand `.md` entries of zeros fit well under the 100 MB upload and inflate to about 64 GB,
 * which ended the process (2026-09-30). Reported as `entry_too_large`, the answer the import
 * route already gives for an archive that will not fit.
 */
export const MAX_TOTAL_BYTES = 256 * 1024 * 1024

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

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })
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

/** Bytes `[start, end)` of the archive, however it is held: in memory, a file, an R2 object. */
export type ZipReader = (start: number, end: number) => Promise<Uint8Array>

/**
 * Where the central directory starts, how long it is, and how many entries it holds.
 *
 * The record is found by scanning BACKWARDS, because the archive ends with a comment of
 * arbitrary length and there is no other way to know where the record begins. Scanning forwards
 * for the signature would stop at the first four bytes of file DATA that happen to spell it.
 * Only the last 64 KB is read for it (plus the Zip64 locator's 20 bytes before the record), so an
 * archive of any size costs one small read here.
 */
async function readEnd(read: ZipReader, size: number): Promise<{ offset: number; length: number; count: number }> {
  const base = Math.max(0, size - EOCD_SCAN - 20)
  const b = await read(base, size)
  const floor = Math.max(0, b.length - EOCD_SCAN)
  for (let at = b.length - 22; at >= floor; at--) {
    if (u32(b, at) !== EOCD) continue

    let count = u16(b, at + 10)
    let length = u32(b, at + 12)
    let offset = u32(b, at + 16)

    // Some writers emit Zip64 for every archive, small ones included. The classic record then
    // carries all-ones in the fields that overflowed, and reading those literally means walking
    // to offset 4294967295 and finding nothing: an empty import, with no error anywhere.
    if (count === 0xffff || offset === 0xffffffff || length === 0xffffffff) {
      const locator = at - 20
      if (locator < 0 || u32(b, locator) !== LOCATOR64) {
        throw new ZipError('not_a_zip', 'a Zip64 archive with no Zip64 locator')
      }
      const record = u64(b, locator + 8)
      if (record + 56 > size) throw new ZipError('not_a_zip', 'the Zip64 locator points at no Zip64 record')
      const r = await read(record, record + 56)
      if (u32(r, 0) !== EOCD64) throw new ZipError('not_a_zip', 'the Zip64 locator points at no Zip64 record')
      count = u64(r, 32)
      length = u64(r, 40)
      offset = u64(r, 48)
    }

    if (offset > size || offset + length > size) throw new ZipError('not_a_zip', 'the directory starts past the end')
    return { offset, length, count }
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
async function readEntry(
  read: ZipReader,
  size: number,
  name: string,
  head: { local: number; packed: number; unpacked: number; method: number; crc: number },
  limit: number,
): Promise<Uint8Array> {
  if (head.local + 30 > size) throw new ZipError('corrupt_entry', `${name} has no local header`)
  const local = await read(head.local, head.local + 30)
  if (u32(local, 0) !== LOCAL) throw new ZipError('corrupt_entry', `${name} has no local header`)
  // The name and extra lengths HERE, not the directory's: a writer may pad the local extra
  // field differently, and using the wrong pair starts the read a few bytes into the data.
  const start = head.local + 30 + u16(local, 26) + u16(local, 28)
  const end = start + head.packed
  if (end > size) throw new ZipError('corrupt_entry', `${name} runs past the end`)
  if (head.unpacked > limit) {
    throw new ZipError('entry_too_large', `${name} declares ${head.unpacked} bytes`)
  }

  const packed = await read(start, end)
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
export async function unzipFrom(
  read: ZipReader,
  size: number,
  keep: (name: string) => boolean = () => true,
  limit: number = MAX_ENTRY_BYTES,
  total: number = MAX_TOTAL_BYTES,
): Promise<ZipEntry[]> {
  const { offset, length, count } = await readEnd(read, size)
  // The whole directory in one read: a few hundred bytes an entry, never the entries themselves.
  const dir = await read(offset, offset + length)
  const out: ZipEntry[] = []
  let inflated = 0

  let at = 0
  for (let i = 0; i < count; i++) {
    if (at + 46 > dir.length || u32(dir, at) !== CENTRAL) {
      throw new ZipError('not_a_zip', `entry ${i + 1} of ${count} is not a directory record`)
    }
    const nameLen = u16(dir, at + 28)
    const extraLen = u16(dir, at + 30)
    const commentLen = u16(dir, at + 32)
    const name = entryName(dir.subarray(at + 46, at + 46 + nameLen))

    if (!name.endsWith('/') && keep(name)) {
      const head = {
        local: u32(dir, at + 42),
        packed: u32(dir, at + 20),
        unpacked: u32(dir, at + 24),
        method: u16(dir, at + 10),
        crc: u32(dir, at + 16),
      }
      if (head.local === OVERFLOWED || head.packed === OVERFLOWED || head.unpacked === OVERFLOWED) {
        readZip64Extra(dir, at + 46 + nameLen, extraLen, head)
      }
      // The entry is capped at what is still left of the total, so the sum cannot pass it.
      const bytes = await readEntry(read, size, name, head, Math.max(1, Math.min(limit, total - inflated)))
      inflated += bytes.byteLength
      out.push({ name, bytes })
    }
    at += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/** The same over an archive already in memory. */
export const unzip = (
  archive: Uint8Array,
  keep?: (name: string) => boolean,
  limit?: number,
  total?: number,
): Promise<ZipEntry[]> => unzipFrom(async (start, end) => archive.subarray(start, end), archive.length, keep, limit, total)

/**
 * The same over a Blob — a `File` from a form, or one held on disk — read a slice at a time, so a
 * large archive of pictures is never in memory for the sake of its few text entries.
 */
export const unzipBlob = (
  blob: Blob,
  keep?: (name: string) => boolean,
  limit?: number,
  total?: number,
): Promise<ZipEntry[]> => unzipFrom(async (start, end) => new Uint8Array(await (blob as Blob & { slice(a: number, b: number): Blob }).slice(start, end).arrayBuffer()), blob.size, keep, limit, total)
