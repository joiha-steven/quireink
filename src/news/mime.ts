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
    //
    // ⚠️ A SPACE OR A TAB NEEDS TWO MORE THAN THAT. If one ends up last on a line it is rewritten
    // as `=20` or `=09`, because a trailing space is eaten in transit — and that rewrite happens
    // AFTER this decided the line would fit. Measured: 74 characters and a space came out as a
    // 77-character line, where RFC 2045 §6.7 rule 5 allows 76.
    const need = token === ' ' || token === '\t' ? 3 : token.length + 1
    if (line.length + need > QP_LINE) flush(true)
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
// ⚠️ AND THE HEADER NAME IS IN FRONT OF THE FIRST ONE. 45 bytes makes an encoded word 72
// characters long, which fits 76 on its own and not after `Subject: `: measured at 81. RFC 2047
// §2 limits a LINE carrying encoded words to 76, so the budget is 76 less the longest header
// name this writes (`Subject: `, 9) less the word's own `=?UTF-8?B?` and `?=` (12), rounded down
// to a whole base64 group: 39 bytes, and the first line comes out at 73.
const WORD_BYTES = 39

/**
 * ⚠️ NO VALUE CARRIES A LINE ENDING INTO A HEADER, OR INTO AN SMTP COMMAND.
 *
 * A header ends at the first CRLF and the next line is the next header, so a value holding one
 * writes a header nobody asked for — `To: Reader\r\nBcc: …` is two headers and a copy of the
 * letter to a third party. The same characters in an envelope address are a second SMTP command,
 * because `smtp.ts` writes `MAIL FROM:<…>` and `RCPT TO:<…>` around what it is handed.
 *
 * Measured before this existed: `buildMessage` with a recipient of `Reader\r\nBcc: evil@… <r@…>`
 * emitted a real `Bcc:` header. Nothing reachable put one there — a subscriber's address is
 * checked on the way in and every other recipient is the owner's own — so this is the sink
 * holding rather than a hole closing, which is where a rule about a format belongs. The subject
 * was already safe by accident: anything outside printable ASCII forces the encoded form, and a
 * CRLF is outside it.
 *
 * A space, not a deletion: two words that were on two lines are two words.
 */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ')
}

/**
 * A header value that may hold anything, as ASCII. RFC 2047.
 *
 * Split by CHARACTER and not by byte. A Vietnamese letter is up to three bytes, and an encoded
 * word cut between them decodes to a replacement mark in every client that reads it. The limit
 * below is therefore a budget that whole characters are fitted into.
 */
export function encodeHeader(value: string): string {
  const text = oneLine(value)
  // eslint-disable-next-line no-control-regex
  if (!/[^\x20-\x7e]/.test(text)) return text
  const encoder = new TextEncoder()
  const words: string[] = []
  let chunk = ''
  let used = 0
  for (const ch of text) {
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
 * Characters that cannot stand in a bare display name: RFC 5322 calls them `specials`, and a
 * name carrying one has to be a quoted string instead.
 */
const SPECIALS = /[()<>[\]:;@\\,."]/

/**
 * A display name in a form a mail server will read back as ONE name.
 *
 * ⚠️ AN ENCODED WORD IS NOT QUOTED, and a quoted string is not encoded. `=?UTF-8?B?…?=` is an
 * atom: quoting it would make the quotes part of the name in every client that decodes it. So
 * the two branches are exclusive, and `encodeHeader` returning the value unchanged is how this
 * knows which one it is in.
 */
function displayName(name: string): string {
  const encoded = encodeHeader(name)
  if (encoded !== name) return encoded
  return SPECIALS.test(name) ? `"${name.replace(/([\\"])/g, '\\$1')}"` : name
}

/**
 * `Display Name <user@host>` with only the name encoded.
 *
 * The address itself is never encoded: it is the routing information, and a relay that cannot
 * read it will not deliver.
 *
 * ⚠️ A NAME THAT IS ALREADY QUOTED KEEPS ITS QUOTES, which is what the line above this used to
 * claim while the code did the opposite: it unquoted and never re-quoted. `"Blog, Inc"` went out
 * as `From: Blog, Inc <hi@example.com>`, which RFC 5322 §3.6.2 reads as a list of TWO mailboxes
 * with no `Sender:`, and a colon in a name makes a malformed group. The quoted spelling is the
 * CORRECT thing for an owner to type into `smtp_from`, so this broke the input that was right.
 * A non-ASCII name escaped it by accident, because that one goes out as an encoded word.
 *
 * nodemailer quoted these; it went when the mail half became ours (2.2.10).
 */
export function encodeAddress(addressIn: string): string {
  const address = oneLine(addressIn)
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(address)
  if (!match) return address.trim()
  const quoted = /^"(.*)"$/.exec(match[1]!)
  // Undo the escapes a quoted string carries, so the name is the name before it is re-emitted.
  const name = quoted ? quoted[1]!.replace(/\\(.)/g, '$1') : match[1]!
  if (!name) return `<${match[2]!.trim()}>`
  return `${displayName(name)} <${match[2]!.trim()}>`
}

/** Just the `user@host` out of either spelling, for the `MAIL FROM` and `RCPT TO` commands. */
export function bareAddress(address: string): string {
  return oneLine(/<([^>]+)>/.exec(address)?.[1] ?? address).trim()
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
