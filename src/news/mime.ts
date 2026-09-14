// An email, as the bytes that go down the wire.
//
// Half of retiring `nodemailer`; `smtp.ts` is the other half and speaks the protocol. This file
// only builds the message, which means it is the half where a mistake is silent: a broken
// envelope gets refused by the relay and logged, but a mis-encoded body arrives, looks sent, and
// is a Vietnamese sentence turned to mojibake in somebody's inbox. A newsletter cannot be
// unsent, so everything here is decoded back and compared in `mime.test.ts`.
//
// QUOTED-PRINTABLE RATHER THAN BASE64, which is the one real choice in this file. Base64 is
// easier and cannot be got subtly wrong, but it makes every message opaque to the person
// debugging one, and a base64 text/plain part is a small mark against a newsletter at some spam
// filters. Quoted-printable keeps ASCII readable and encodes only what has to be. The cost is
// that it has three traps, and all three have their own test:
//
//   1. A soft line break may not fall inside an `=XX` triple.
//   2. A space or tab at the end of a line must be encoded, or a relay will strip it.
//   3. Encoding is per BYTE of UTF-8, so a Vietnamese character becomes three triples and must
//      never be split across a wrap. Wrapping by bytes and not by characters is how `ế` becomes
//      two replacement marks.

/** The longest an encoded line may be, before its soft break. 76 is the specification's. */
const QP_LINE = 76

const HEX = '0123456789ABCDEF'

/**
 * Quoted-printable, with CRLF line endings.
 *
 * Literal newlines in the input become hard breaks; everything else is one long logical line
 * broken with `=` soft breaks. A `.` at the start of a line is left alone here: dot-stuffing is
 * the transport's job and `smtp.ts` does it, because it applies to the headers too.
 */
export function quotedPrintable(text: string): string {
  const bytes = new TextEncoder().encode(text.replace(/\r\n/g, '\n'))
  const out: string[] = []
  let line = ''

  const flush = (soft: boolean): void => {
    out.push(soft ? `${line}=` : line)
    line = ''
  }
  /** Appends a token that must not be split, breaking the line first if it will not fit. */
  const put = (token: string): void => {
    // The `+ 1` leaves room for the trailing `=` a soft break needs.
    if (line.length + token.length + 1 > QP_LINE) flush(true)
    line += token
  }

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!
    if (byte === 0x0a) {
      // A hard break. Anything the encoder is holding is flushed as a whole line.
      const last = line[line.length - 1]
      if (last === ' ' || last === '\t') {
        line = `${line.slice(0, -1)}=${HEX[last.charCodeAt(0) >> 4]}${HEX[last.charCodeAt(0) & 15]}`
      }
      flush(false)
      continue
    }
    const printable = byte >= 0x21 && byte <= 0x7e && byte !== 0x3d
    put(printable || byte === 0x20 || byte === 0x09 ? String.fromCharCode(byte) : `=${HEX[byte >> 4]}${HEX[byte & 15]}`)
  }
  // A trailing space on the very last line would be eaten in transit just the same.
  const last = line[line.length - 1]
  if (last === ' ' || last === '\t') {
    line = `${line.slice(0, -1)}=${HEX[last.charCodeAt(0) >> 4]}${HEX[last.charCodeAt(0) & 15]}`
  }
  out.push(line)
  return out.join('\r\n')
}

/** Undoes the above. Exported because the test that matters is the round trip. */
export function decodeQuotedPrintable(encoded: string): string {
  const bytes: number[] = []
  const text = encoded.replace(/=\r?\n/g, '')
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16))
      i += 2
    } else if (text[i] === '\r' && text[i + 1] === '\n') {
      bytes.push(0x0a)
      i++
    } else {
      for (const b of new TextEncoder().encode(text[i]!)) bytes.push(b)
    }
  }
  return new TextDecoder().decode(Uint8Array.from(bytes))
}

/** Room inside one `=?UTF-8?B?…?=` word, in bytes, so the whole word stays under 76 columns. */
const WORD_BYTES = 45

/**
 * A header value that may hold anything, as ASCII. RFC 2047.
 *
 * Split by CHARACTER and not by byte. A Vietnamese letter is up to three bytes, and an encoded
 * word cut between them decodes to a replacement mark in every client that reads it. The limit
 * below is therefore a budget that whole characters are fitted into.
 */
export function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (!/[^\x20-\x7e]/.test(value)) return value
  const encoder = new TextEncoder()
  const words: string[] = []
  let chunk = ''
  let used = 0
  for (const ch of value) {
    const size = encoder.encode(ch).length
    if (used + size > WORD_BYTES) {
      words.push(chunk)
      chunk = ''
      used = 0
    }
    chunk += ch
    used += size
  }
  if (chunk) words.push(chunk)
  return words
    .map((word) => `=?UTF-8?B?${Buffer.from(word, 'utf8').toString('base64')}?=`)
    .join('\r\n ') // a folded header: continuation lines begin with whitespace
}

/**
 * `Display Name <user@host>` with only the name encoded.
 *
 * The address itself is never encoded: it is the routing information, and a relay that cannot
 * read it will not deliver. A name that is already quoted keeps its quotes.
 */
export function encodeAddress(address: string): string {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(address)
  if (!match) return address.trim()
  const name = match[1]!.replace(/^"(.*)"$/, '$1')
  if (!name) return `<${match[2]!.trim()}>`
  return `${encodeHeader(name)} <${match[2]!.trim()}>`
}

/** Just the `user@host` out of either spelling, for the `MAIL FROM` and `RCPT TO` commands. */
export function bareAddress(address: string): string {
  return (/<([^>]+)>/.exec(address)?.[1] ?? address).trim()
}

export type Message = {
  from: string
  to: string
  subject: string
  text: string
  html: string
  /** Fixed only by the test; real messages take the clock and a random boundary. */
  date?: Date
  boundary?: string
  messageId?: string
}

/** A `multipart/alternative` message: the text part first, because a client picks the last. */
export function buildMessage(msg: Message): string {
  const boundary = msg.boundary ?? `--=_quire_${crypto.randomUUID().replace(/-/g, '')}`
  const domain = bareAddress(msg.from).split('@')[1] ?? 'localhost'
  const headers = [
    `From: ${encodeAddress(msg.from)}`,
    `To: ${encodeAddress(msg.to)}`,
    `Subject: ${encodeHeader(msg.subject)}`,
    `Date: ${(msg.date ?? new Date()).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${msg.messageId ?? crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
  const part = (type: string, body: string): string =>
    [
      `--${boundary}`,
      `Content-Type: ${type}; charset=utf-8`,
      'Content-Transfer-Encoding: quoted-printable',
      '',
      quotedPrintable(body),
    ].join('\r\n')

  return [
    headers.join('\r\n'),
    '',
    part('text/plain', msg.text),
    part('text/html', msg.html),
    `--${boundary}--`,
    '',
  ].join('\r\n')
}
