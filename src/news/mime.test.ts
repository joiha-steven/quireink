// The message encoder, checked by decoding it again.
//
// This is the file where a mistake is silent. A bad envelope is refused by the relay and lands
// in `newsletter_sends` as a failure somebody can see; a bad BODY is accepted, delivered, and is
// a Vietnamese sentence turned to mojibake in a reader's inbox with nothing anywhere saying so.
// A newsletter cannot be unsent, so nothing here asserts what the encoder printed. Everything
// decodes it back and compares.
import { describe, expect, it } from 'bun:test'
import {
  bareAddress,
  buildMessage,
  decodeQuotedPrintable,
  encodeAddress,
  encodeHeader,
  quotedPrintable,
} from './mime'

/** Strings chosen because each one is a way quoted-printable is got wrong. */
const CORPUS: [string, string][] = [
  ['plain ascii', 'Hello there, reader.'],
  ['vietnamese', 'Chào bạn, đây là bản tin tháng này của Quire Ink.'],
  ['every tone mark', 'à á ả ã ạ ă ằ ắ ẳ ẵ ặ â ầ ấ ẩ ẫ ậ đ ê ế ệ ô ố ộ ơ ớ ợ ư ứ ự'],
  ['emoji', 'Shipped 🚀 and measured 📏 and done ✅'],
  ['an equals sign', 'a = b, and c == d, and e =3D f'],
  ['trailing space', 'a line that ends in a space \nand the next one'],
  ['trailing tab', 'a line that ends in a tab\t\nand the next one'],
  ['a lone dot line', 'before\n.\nafter'],
  ['crlf input', 'one\r\ntwo\r\nthree'],
  ['empty', ''],
  ['one very long word', 'x'.repeat(500)],
  ['long vietnamese', 'nước '.repeat(120)],
  ['a paragraph that wraps', `${'word '.repeat(40)}\n\n${'khác '.repeat(40)}`],
  ['multibyte at the edge', `${'a'.repeat(73)}ế${'b'.repeat(73)}`],
  ['newline at the end', 'ends with a newline\n'],
  ['only newlines', '\n\n\n'],
]

describe('quoted-printable, decoded back', () => {
  for (const [name, text] of CORPUS) {
    it(`${name}: survives the round trip`, () => {
      // CRLF in, LF out: the encoder normalises line endings, which every mail agent does.
      expect(decodeQuotedPrintable(quotedPrintable(text))).toBe(text.replace(/\r\n/g, '\n'))
    })
  }

  it('never writes a line longer than the limit', () => {
    for (const [name, text] of CORPUS) {
      for (const line of quotedPrintable(text).split('\r\n')) {
        expect(`${name}: ${line.length}`).toBe(`${name}: ${Math.min(line.length, 76)}`)
      }
    }
  })

  it('never breaks a line inside an escape triple', () => {
    for (const [, text] of CORPUS) {
      for (const line of quotedPrintable(text).split('\r\n')) {
        // A soft break is a trailing `=`. Any OTHER `=` must have its two hex digits behind it.
        const body = line.endsWith('=') ? line.slice(0, -1) : line
        for (let i = 0; i < body.length; i++) {
          if (body[i] === '=') {
            expect(/^[0-9A-F]{2}$/.test(body.slice(i + 1, i + 3))).toBe(true)
            i += 2
          }
        }
      }
    }
  })

  it('encodes a space at the end of a line, which a relay would otherwise strip', () => {
    const encoded = quotedPrintable('trailing \nnext')
    expect(encoded.split('\r\n')[0]).toBe('trailing=20')
  })
})

/** RFC 2047, undone: enough of it to check what the encoder wrote. */
function decodeHeader(value: string): string {
  return value
    .replace(/\r\n /g, '')
    .replace(/=\?UTF-8\?B\?([^?]*)\?=/g, (_, b64: string) => Buffer.from(b64, 'base64').toString('utf8'))
}

describe('header words', () => {
  it('leaves a plain ASCII header exactly as written', () => {
    expect(encodeHeader('Monthly letter, issue 4')).toBe('Monthly letter, issue 4')
  })

  for (const [name, text] of CORPUS.filter(([, t]) => t && t.length < 300)) {
    it(`${name}: decodes back to itself`, () => {
      expect(decodeHeader(encodeHeader(text.replace(/[\r\n\t]/g, ' ')))).toBe(
        text.replace(/[\r\n\t]/g, ' '),
      )
    })
  }

  it('never splits a character across two encoded words', () => {
    // The trap: a Vietnamese letter is up to three bytes, and a word cut between them decodes
    // to replacement marks. Each word is decoded ALONE here, so a split shows up as U+FFFD.
    const long = 'Bản tin tháng chín của Quire Ink, với rất nhiều chữ có dấu để bắt lỗi cắt ngang'
    for (const word of encodeHeader(long).split('\r\n ')) {
      expect(decodeHeader(word)).not.toContain('�')
    }
  })

  it('keeps every encoded word inside the line limit', () => {
    for (const word of encodeHeader('ế'.repeat(200)).split('\r\n ')) {
      expect(word.length).toBeLessThanOrEqual(76)
    }
  })
})

describe('addresses', () => {
  it('encodes the display name and never the address', () => {
    const out = encodeAddress('Nhật ký <hi@example.com>')
    expect(out).toContain('<hi@example.com>')
    expect(decodeHeader(out)).toBe('Nhật ký <hi@example.com>')
  })

  it('passes a bare address through', () => {
    expect(encodeAddress('hi@example.com')).toBe('hi@example.com')
    expect(encodeAddress('  <hi@example.com> ')).toBe('<hi@example.com>')
  })

  it('pulls the routing address out of either spelling', () => {
    expect(bareAddress('Blog <hi@example.com>')).toBe('hi@example.com')
    expect(bareAddress('hi@example.com')).toBe('hi@example.com')
  })
})

describe('the whole message', () => {
  const built = buildMessage({
    from: 'Nhật ký <hi@example.com>',
    to: 'reader@example.org',
    subject: 'Bản tin tháng chín',
    text: 'Chào bạn.\n\nThân mến.',
    html: '<p>Chào bạn.</p>',
    date: new Date(Date.UTC(2026, 8, 14, 3, 0, 0)),
    boundary: 'BOUND',
    messageId: 'fixed-id',
  })

  it('carries the headers a relay and a client both need', () => {
    expect(built).toContain('MIME-Version: 1.0')
    expect(built).toContain('Content-Type: multipart/alternative; boundary="BOUND"')
    expect(built).toContain('Message-ID: <fixed-id@example.com>')
    expect(built).toContain('Date: Mon, 14 Sep 2026 03:00:00 +0000')
    expect(decodeHeader(/Subject: (.*)/.exec(built)![1]!)).toBe('Bản tin tháng chín')
  })

  it('puts the text part before the HTML one, because a client takes the last it understands', () => {
    expect(built.indexOf('text/plain')).toBeLessThan(built.indexOf('text/html'))
  })

  it('closes the multipart with the end boundary', () => {
    expect(built.trimEnd().endsWith('--BOUND--')).toBe(true)
  })

  it('holds both bodies, decodable', () => {
    const parts = built.split('--BOUND')
    const body = (part: string): string => decodeQuotedPrintable(part.split('\r\n\r\n').slice(1).join('\r\n\r\n'))
    expect(body(parts[1]!).trim()).toBe('Chào bạn.\n\nThân mến.')
    expect(body(parts[2]!).trim()).toBe('<p>Chào bạn.</p>')
  })

  it('uses CRLF everywhere, which is the only line ending SMTP has', () => {
    expect(/[^\r]\n/.test(built)).toBe(false)
  })
})
