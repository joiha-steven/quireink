// A tar writer and reader in plain JS, streaming both ways (ADR 0067).
//
// The archive was `tar -czf -` through `Bun.spawn`. A Durable Object has no child process and
// no file to hand a `tar` binary, and the archive now holds rows rather than database files, so
// it is written here instead: one implementation both runtimes run, which cannot drift from
// itself the way two adapters would.
//
// The format is POSIX ustar, which every tar since 1988 reads, with a PAX extended header in
// front of any entry whose name or size does not fit the fixed fields — what GNU tar and bsdtar
// both write themselves for a long name. The reader also takes GNU's `L` long-name entries,
// because the archives written before this file existed came out of GNU tar on every Linux box.
//
// NOTHING IS HELD WHOLE. An entry's size is declared before its bytes, so the writer is handed
// the size up front and then exactly that many bytes, which it checks: more or fewer is an
// archive that opens and is wrong, the worst of the outcomes, so both throw instead.

const BLOCK = 512
const enc = new TextEncoder()
const dec = new TextDecoder()

/** The largest size the 11 octal digits of a ustar header can say: 8 GiB less one byte. */
const USTAR_MAX_SIZE = 0o77777777777

export type TarBody = Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>

/** One file to write: its name inside the archive, its exact size, and its bytes. */
export type TarEntry = { name: string; size: number; body: TarBody }

function octal(value: number, width: number): string {
  // `width - 1` digits and a NUL, the form every reader accepts.
  return value.toString(8).padStart(width - 1, '0') + '\0'
}

function put(block: Uint8Array, at: number, text: string, width: number): void {
  const bytes = enc.encode(text)
  block.set(bytes.subarray(0, width), at)
}

/** A 512-byte header. `name` must already fit in 100 bytes; the caller handles the rest. */
function header(name: string, size: number, mtime: number, type: '0' | 'x'): Uint8Array {
  const h = new Uint8Array(BLOCK)
  put(h, 0, name, 100)
  put(h, 100, octal(0o644, 8), 8)
  put(h, 108, octal(0, 8), 8)
  put(h, 116, octal(0, 8), 8)
  put(h, 124, octal(Math.min(size, USTAR_MAX_SIZE), 12), 12)
  put(h, 136, octal(Math.floor(mtime / 1000), 12), 12)
  put(h, 156, type, 1)
  put(h, 257, 'ustar\0', 6)
  put(h, 263, '00', 2)
  // The checksum is the byte sum with its own field counted as eight spaces.
  h.fill(0x20, 148, 156)
  let sum = 0
  for (const b of h) sum += b
  put(h, 148, sum.toString(8).padStart(6, '0') + '\0 ', 8)
  return h
}

/** One PAX record, `<len> <key>=<value>\n`, where `len` counts its own digits too. */
function paxRecord(key: string, value: string): string {
  const body = ` ${key}=${value}\n`
  const bodyLen = enc.encode(body).length
  let digits = String(bodyLen).length
  while (String(bodyLen + digits).length !== digits) digits++
  return `${bodyLen + digits}${body}`
}

const padding = (size: number): Uint8Array => new Uint8Array((BLOCK - (size % BLOCK)) % BLOCK)

/** The header blocks for one entry: a PAX header first when the name or the size needs one. */
export function entryHeader(name: string, size: number, mtime: number): Uint8Array[] {
  const nameBytes = enc.encode(name).length
  const records = (nameBytes > 100 ? paxRecord('path', name) : '')
    + (size > USTAR_MAX_SIZE ? paxRecord('size', String(size)) : '')
  // The fallback name in the ustar header of a PAX'd entry is only read by a tar that ignores
  // PAX, so it has to be ASCII that fits; the tail of the name is the part a person recognises.
  const short = nameBytes > 100 ? name.replace(/[^\x20-\x7e]/g, '_').slice(-100) : name
  if (records === '') return [header(name, size, mtime, '0')]
  const pax = enc.encode(records)
  return [header('PaxHeader', pax.length, mtime, 'x'), pax, padding(pax.length), header(short, size, mtime, '0')]
}

async function* bodyChunks(body: TarBody): AsyncGenerator<Uint8Array> {
  if (body instanceof Uint8Array) { yield body; return }
  for await (const chunk of body as AsyncIterable<Uint8Array>) yield chunk
}

/**
 * Every entry, in order, as tar bytes. Each entry's body must be exactly `size` bytes long.
 *
 * A generator rather than a stream so the caller decides what drives it; `tarStream` below is
 * the usual one, pulling only as fast as whoever reads it.
 */
export async function* tarChunks(
  entries: Iterable<TarEntry> | AsyncIterable<TarEntry>, mtime = Date.now(),
): AsyncGenerator<Uint8Array> {
  for await (const entry of entries as AsyncIterable<TarEntry>) {
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error(`tar: bad size for ${entry.name}`)
    for (const block of entryHeader(entry.name, entry.size, mtime)) if (block.length) yield block
    let written = 0
    for await (const chunk of bodyChunks(entry.body)) {
      written += chunk.length
      if (written > entry.size) throw new Error(`tar: ${entry.name} is longer than the ${entry.size} bytes declared`)
      if (chunk.length) yield chunk
    }
    if (written !== entry.size) throw new Error(`tar: ${entry.name} ended at ${written} of ${entry.size} bytes`)
    const pad = padding(entry.size)
    if (pad.length) yield pad
  }
  // The end of an archive is two empty blocks. Without them GNU tar warns and bsdtar refuses.
  yield new Uint8Array(BLOCK * 2)
}

/** A pull-driven stream over an async generator, which stops the generator if it is cancelled. */
export function streamOf(chunks: AsyncGenerator<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await chunks.next()
        if (next.done) controller.close()
        else controller.enqueue(next.value)
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel(reason) {
      await chunks.throw(reason instanceof Error ? reason : new Error('cancelled')).catch(() => undefined)
    },
  })
}

export const tarStream = (entries: Iterable<TarEntry> | AsyncIterable<TarEntry>, mtime?: number): ReadableStream<Uint8Array> =>
  streamOf(tarChunks(entries, mtime))

// ---------------------------------------------------------------------------------------------
// Reading

/**
 * Bytes off a stream, a requested number at a time, holding no more than one chunk beyond what
 * was asked for. Shared with the multipart reader, which has the same problem with a request.
 */
export class ByteReader {
  private held: Uint8Array = new Uint8Array(0)
  private done = false
  private readonly it: AsyncIterator<Uint8Array>

  constructor(source: AsyncIterable<Uint8Array>) { this.it = source[Symbol.asyncIterator]() }

  /** Pull one more chunk into the buffer. False at the end of the source. */
  async more(): Promise<boolean> {
    if (this.done) return false
    const next = await this.it.next()
    if (next.done) { this.done = true; return false }
    if (this.held.length === 0) { this.held = next.value; return true }
    const joined = new Uint8Array(this.held.length + next.value.length)
    joined.set(this.held)
    joined.set(next.value, this.held.length)
    this.held = joined
    return true
  }

  get buffered(): Uint8Array { return this.held }

  /** Drop `n` bytes from the front of the buffer, which the caller has already looked at. */
  consume(n: number): Uint8Array {
    const out = this.held.subarray(0, n)
    this.held = this.held.subarray(n)
    return out
  }

  /** Exactly `n` bytes, or fewer only at the end of the source. */
  async read(n: number): Promise<Uint8Array> {
    while (this.held.length < n && await this.more()) { /* pulling */ }
    return this.consume(Math.min(n, this.held.length)).slice()
  }

  /** `n` bytes as they arrive, without gathering them. Throws if the source ends first. */
  async* take(n: number): AsyncGenerator<Uint8Array> {
    let left = n
    while (left > 0) {
      if (this.held.length === 0 && !(await this.more())) throw new Error('truncated')
      const piece = this.consume(Math.min(left, this.held.length))
      left -= piece.length
      yield piece.slice()
    }
  }

  async cancel(): Promise<void> {
    await this.it.return?.()
  }
}

export type TarItem = {
  name: string
  size: number
  /** `file`, `dir`, or `other` (a link or a device), which nothing here restores. */
  kind: 'file' | 'dir' | 'other'
  /** Must be read to its end, or skipped with `skip()`, before asking for the next item. */
  body: () => AsyncGenerator<Uint8Array>
  skip: () => Promise<void>
}

const cstring = (b: Uint8Array): string => {
  const end = b.indexOf(0)
  return dec.decode(end === -1 ? b : b.subarray(0, end))
}

/** A numeric header field: octal text, or GNU's base-256 form for a size past 8 GiB. */
function number(b: Uint8Array): number {
  if (b[0]! & 0x80) {
    let n = 0
    for (let i = 1; i < b.length; i++) n = n * 256 + b[i]!
    return n
  }
  const text = cstring(b).trim()
  return text === '' ? 0 : parseInt(text, 8)
}

function paxFields(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  let at = 0
  const bytes = enc.encode(text)
  while (at < bytes.length) {
    const space = bytes.indexOf(0x20, at)
    if (space === -1) break
    const len = parseInt(dec.decode(bytes.subarray(at, space)), 10)
    if (!Number.isFinite(len) || len <= 0) break
    const record = dec.decode(bytes.subarray(space + 1, at + len - 1))
    const eq = record.indexOf('=')
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1)
    at += len
  }
  return out
}

/** Every entry of a tar stream, one at a time. A header that fails its checksum stops it. */
export async function* tarEntries(source: AsyncIterable<Uint8Array>): AsyncGenerator<TarItem> {
  const reader = new ByteReader(source)
  let longName: string | null = null
  let pax: Record<string, string> = {}
  try {
    for (;;) {
      const h = await reader.read(BLOCK)
      if (h.length < BLOCK) throw new Error('tar: the archive ends inside a header')
      if (h.every((b) => b === 0)) return
      let sum = 0
      for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i]!
      if (sum !== number(h.subarray(148, 156))) throw new Error('tar: a header failed its checksum')
      const type = String.fromCharCode(h[156] || 0x30)
      const prefix = cstring(h.subarray(345, 500))
      const ustarName = cstring(h.subarray(0, 100))
      const size = pax.size !== undefined ? Number(pax.size) : number(h.subarray(124, 136))
      const padded = size + padding(size).length
      if (type === 'x' || type === 'g' || type === 'L') {
        const text = dec.decode(await reader.read(size))
        await reader.read(padded - size)
        if (type === 'x') pax = paxFields(text)
        if (type === 'L') longName = cstring(enc.encode(text))
        continue
      }
      const name = pax.path ?? longName ?? (prefix ? `${prefix}/${ustarName}` : ustarName)
      longName = null
      pax = {}
      // What of this entry, padding included, is still in the stream. A body read halfway and
      // abandoned is skipped from where it stopped, so the next header is where it should be.
      let left = padded
      const item: TarItem = {
        name,
        size,
        kind: type === '0' || type === '\0' || type === '7' ? 'file' : type === '5' ? 'dir' : 'other',
        body: async function* () {
          const start = padded - left
          for await (const piece of reader.take(Math.max(0, size - start))) {
            left -= piece.length
            yield piece
          }
        },
        skip: async () => {
          for await (const piece of reader.take(left)) left -= piece.length
        },
      }
      yield item
      await item.skip()
    }
  } finally {
    await reader.cancel()
  }
}
