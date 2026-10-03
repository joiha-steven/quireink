// A multipart/form-data body read as it arrives, one part at a time.
//
// `c.req.parseBody()` and `formData()` read the whole request before the handler sees a field.
// For a sign-in form that is nothing; for a backup archive loaded at first setup it is the whole
// blog held in memory, twice on Cloudflare's 128 MB, before the setup token has even been checked.
// Read here instead, the token arrives first (it is first in the form), is checked, and the
// archive streams straight into the restore without ever being whole.
//
// Only what a browser sends: a boundary from the content type, parts with a Content-Disposition,
// CRLF line ends. Anything else is refused rather than guessed at.
import { ByteReader } from '@/server/tar'

export type Part = {
  name: string
  filename: string | null
  /** Read it to its end, or not at all, before asking for the next part. */
  body: () => AsyncGenerator<Uint8Array>
}

const enc = new TextEncoder()
const HEADER_LIMIT = 16 * 1024

/** The boundary from a `multipart/form-data` content type, or null for anything else. */
export function boundaryOf(contentType: string): string | null {
  if (!/^multipart\/form-data\s*;/i.test(contentType)) return null
  const m = /boundary=(?:"([^"]{1,70})"|([^\s;]{1,70}))/i.exec(contentType)
  return m ? (m[1] ?? m[2] ?? null) : null
}

const indexOf = (hay: Uint8Array, needle: Uint8Array, from = 0): number =>
  Buffer.from(hay.buffer, hay.byteOffset, hay.byteLength).indexOf(needle, from)

/** Every part of the body, in the order the browser sent them. */
export async function* multipart(body: AsyncIterable<Uint8Array>, boundary: string): AsyncGenerator<Part> {
  const reader = new ByteReader(body)
  const dash = enc.encode(`--${boundary}`)
  const delimiter = enc.encode(`\r\n--${boundary}`)
  // The preamble, which browsers leave empty, up to and past the first boundary line.
  let at: number
  while ((at = indexOf(reader.buffered, dash)) === -1) {
    if (reader.buffered.length > HEADER_LIMIT || !(await reader.more())) throw new Error('multipart: no boundary')
  }
  reader.consume(at + dash.length)
  try {
    for (;;) {
      while (reader.buffered.length < 2 && await reader.more()) { /* pulling */ }
      const after = Buffer.from(reader.consume(2)).toString('latin1')
      if (after === '--') return
      if (after !== '\r\n') throw new Error('multipart: malformed boundary line')
      let end: number
      while ((end = indexOf(reader.buffered, enc.encode('\r\n\r\n'))) === -1) {
        if (reader.buffered.length > HEADER_LIMIT || !(await reader.more())) throw new Error('multipart: headers never end')
      }
      const headers = Buffer.from(reader.consume(end + 4)).toString('utf8')
      const disposition = /^content-disposition:\s*form-data(.*)$/im.exec(headers)?.[1] ?? ''
      const name = /;\s*name="([^"]*)"/i.exec(disposition)?.[1]
      if (name === undefined) throw new Error('multipart: a part with no name')
      const filename = /;\s*filename="([^"]*)"/i.exec(disposition)?.[1] ?? null
      let done = false
      const part: Part = {
        name,
        filename,
        body: async function* () {
          while (!done) {
            const found = indexOf(reader.buffered, delimiter)
            if (found !== -1) {
              if (found > 0) yield reader.consume(found).slice()
              reader.consume(delimiter.length)
              done = true
              return
            }
            // Everything but a tail that could be the start of the delimiter is this part's.
            const safe = reader.buffered.length - delimiter.length
            if (safe > 0) yield reader.consume(safe).slice()
            if (!(await reader.more())) throw new Error('multipart: the body ends inside a part')
          }
        },
      }
      yield part
      if (!done) for await (const _ of part.body()) { /* the caller did not want the rest */ }
    }
  } finally {
    await reader.cancel()
  }
}

/** A small text field, whole. A field longer than `limit` is refused rather than held. */
export async function fieldText(part: Part, limit = 4096): Promise<string> {
  const pieces: Uint8Array[] = []
  let size = 0
  for await (const piece of part.body()) {
    size += piece.length
    if (size > limit) throw new Error(`multipart: ${part.name} is longer than a field can be`)
    pieces.push(piece)
  }
  return Buffer.concat(pieces).toString('utf8')
}
