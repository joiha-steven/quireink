// A CSS tokenizer, CSS Syntax Level 3 section 4, for stylesheets written by strangers.
//
// The theme checker is a security boundary (ADR 0072): what it reads must be what a browser
// reads, or a rule can hide in the difference. A line regex sees `u\72l(` as text; a browser
// sees `url(`. So names, strings and URLs come out of here DECODED, with every escape
// resolved exactly as the spec resolves it, and the checker compares decoded values.
//
// Deviations from the spec are only in what is reported, never in how text is split:
//   - The input is not preprocessed. CR, CRLF and FF are newlines where the spec says so, NUL
//     reads as U+FFFD, and offsets stay offsets into the string the caller passed, so a
//     violation can point at the line the author sees.
//   - The parse errors that change nothing in the token stream but mean the author's text was
//     cut short (an unterminated comment, string or url at end of input) are returned in
//     `errors`, because a gate should say so rather than accept a truncated sheet.
//
// No `node:*` and nothing Bun-only: this runs on Cloudflare Workers too.

export type CssTokenType =
  | 'ident' | 'function' | 'at-keyword' | 'hash' | 'string' | 'bad-string' | 'url' | 'bad-url'
  | 'delim' | 'number' | 'percentage' | 'dimension' | 'whitespace' | 'CDO' | 'CDC'
  | 'colon' | 'semicolon' | 'comma' | '[' | ']' | '(' | ')' | '{' | '}'

export interface CssToken {
  type: CssTokenType
  /** Offset of the first code unit in the source. */
  start: number
  /** Offset just past the last code unit. */
  end: number
  /** Decoded name, text (string, url), unit (dimension) or the delim character; else ''. */
  value: string
  /** The numeric value of a number, percentage or dimension; 0 otherwise. */
  num: number
  /** A hash whose name would start an identifier, i.e. one that can be an id selector. */
  hashId: boolean
}

export type CssTokenErrorKind = 'unclosed-comment' | 'unclosed-string' | 'unclosed-url'
export interface CssTokenError { kind: CssTokenErrorKind; offset: number }

const EOF = -1
const REPLACEMENT = '�'

const isDigit = (c: number) => c >= 0x30 && c <= 0x39
const isHex = (c: number) => isDigit(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66)
const isNewline = (c: number) => c === 0x0a || c === 0x0d || c === 0x0c
const isWhitespace = (c: number) => isNewline(c) || c === 0x09 || c === 0x20
// NUL counts as a name character because the spec's preprocessing turns it into U+FFFD.
const isNameStart = (c: number) =>
  (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || c === 0x5f || c >= 0x80 || c === 0
const isNameChar = (c: number) => isNameStart(c) || isDigit(c) || c === 0x2d
const isNonPrintable = (c: number) =>
  (c >= 0x01 && c <= 0x08) || c === 0x0b || (c >= 0x0e && c <= 0x1f) || c === 0x7f
const isQuote = (c: number) => c === 0x22 || c === 0x27

/** ASCII-only lowercase: CSS keywords compare ASCII case-insensitively, and so must we. */
export function asciiLower(s: string): string {
  return s.replace(/[A-Z]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 32))
}

export function tokenizeCss(src: string): { tokens: CssToken[]; errors: CssTokenError[] } {
  const n = src.length
  const tokens: CssToken[] = []
  const errors: CssTokenError[] = []
  // A byte order mark is stripped by the decoder before a browser's tokenizer ever sees it.
  let i = src.charCodeAt(0) === 0xfeff ? 1 : 0

  const at = (k: number) => (k < n ? src.charCodeAt(k) : EOF)
  const validEscape = (k: number) => at(k) === 0x5c && !isNewline(at(k + 1))
  const startsIdent = (k: number) => {
    const c = at(k)
    if (c === 0x2d) return isNameStart(at(k + 1)) || at(k + 1) === 0x2d || validEscape(k + 1)
    if (isNameStart(c)) return true
    return c === 0x5c && validEscape(k)
  }
  const startsNumber = (k: number) => {
    const c = at(k)
    if (c === 0x2b || c === 0x2d) {
      return isDigit(at(k + 1)) || (at(k + 1) === 0x2e && isDigit(at(k + 2)))
    }
    if (c === 0x2e) return isDigit(at(k + 1))
    return isDigit(c)
  }
  /** Skips one newline, counting CRLF as one, as the spec's preprocessing would have. */
  const skipNewline = () => {
    if (at(i) === 0x0d && at(i + 1) === 0x0a) i += 2
    else i += 1
  }

  /** Called with `i` just past the backslash. */
  const consumeEscape = (): string => {
    const c = at(i)
    if (c === EOF) return REPLACEMENT
    if (isHex(c)) {
      let hex = ''
      while (hex.length < 6 && isHex(at(i))) hex += src[i++]
      if (isWhitespace(at(i))) skipNewline()
      const cp = parseInt(hex, 16)
      if (cp === 0 || (cp >= 0xd800 && cp <= 0xdfff) || cp > 0x10ffff) return REPLACEMENT
      return String.fromCodePoint(cp)
    }
    i += 1
    return c === 0 ? REPLACEMENT : String.fromCharCode(c)
  }

  const consumeName = (): string => {
    let out = ''
    for (;;) {
      const c = at(i)
      if (c !== EOF && isNameChar(c)) {
        out += c === 0 ? REPLACEMENT : src[i]
        i += 1
      } else if (validEscape(i)) {
        i += 1
        out += consumeEscape()
      } else {
        return out
      }
    }
  }

  const consumeNumber = (): number => {
    const from = i
    if (at(i) === 0x2b || at(i) === 0x2d) i += 1
    while (isDigit(at(i))) i += 1
    if (at(i) === 0x2e && isDigit(at(i + 1))) {
      i += 2
      while (isDigit(at(i))) i += 1
    }
    const e = at(i)
    if (e === 0x45 || e === 0x65) {
      const s = at(i + 1)
      const skip = isDigit(s) ? 1 : (s === 0x2b || s === 0x2d) && isDigit(at(i + 2)) ? 2 : 0
      if (skip > 0) {
        i += skip
        while (isDigit(at(i))) i += 1
      }
    }
    return Number(src.slice(from, i))
  }

  const push = (type: CssTokenType, start: number, value = '', num = 0, hashId = false) => {
    tokens.push({ type, start, end: i, value, num, hashId })
  }

  const consumeNumeric = (start: number) => {
    const num = consumeNumber()
    if (startsIdent(i)) {
      const unit = consumeName()
      push('dimension', start, unit, num)
    } else if (at(i) === 0x25) {
      i += 1
      push('percentage', start, '', num)
    } else {
      push('number', start, '', num)
    }
  }

  const consumeBadUrlRemnants = () => {
    for (;;) {
      const c = at(i)
      if (c === EOF) return
      if (c === 0x29) {
        i += 1
        return
      }
      if (validEscape(i)) {
        i += 1
        consumeEscape()
      } else {
        i += 1
      }
    }
  }

  /** Called with `i` just past `url(` and the whitespace after it. */
  const consumeUrl = (start: number) => {
    let value = ''
    while (isWhitespace(at(i))) i += 1
    for (;;) {
      const c = at(i)
      if (c === 0x29) {
        i += 1
        return push('url', start, value)
      }
      if (c === EOF) {
        errors.push({ kind: 'unclosed-url', offset: start })
        return push('url', start, value)
      }
      if (isWhitespace(c)) {
        while (isWhitespace(at(i))) i += 1
        if (at(i) === 0x29) {
          i += 1
          return push('url', start, value)
        }
        if (at(i) === EOF) {
          errors.push({ kind: 'unclosed-url', offset: start })
          return push('url', start, value)
        }
        consumeBadUrlRemnants()
        return push('bad-url', start)
      }
      if (isQuote(c) || c === 0x28 || isNonPrintable(c)) {
        consumeBadUrlRemnants()
        return push('bad-url', start)
      }
      if (c === 0x5c) {
        if (validEscape(i)) {
          i += 1
          value += consumeEscape()
          continue
        }
        consumeBadUrlRemnants()
        return push('bad-url', start)
      }
      value += c === 0 ? REPLACEMENT : src[i]
      i += 1
    }
  }

  const consumeIdentLike = (start: number) => {
    const name = consumeName()
    if (asciiLower(name) === 'url' && at(i) === 0x28) {
      i += 1
      while (isWhitespace(at(i)) && isWhitespace(at(i + 1))) i += 1
      const c = at(i)
      if (isQuote(c) || (isWhitespace(c) && isQuote(at(i + 1)))) return push('function', start, name)
      return consumeUrl(start)
    }
    if (at(i) === 0x28) {
      i += 1
      return push('function', start, name)
    }
    push('ident', start, name)
  }

  /** Called with `i` just past the opening quote. */
  const consumeString = (start: number, quote: number) => {
    let value = ''
    for (;;) {
      const c = at(i)
      if (c === quote) {
        i += 1
        return push('string', start, value)
      }
      if (c === EOF) {
        errors.push({ kind: 'unclosed-string', offset: start })
        return push('string', start, value)
      }
      if (isNewline(c)) return push('bad-string', start)
      if (c === 0x5c) {
        const next = at(i + 1)
        if (next === EOF) {
          i += 1
        } else if (isNewline(next)) {
          i += 1
          skipNewline()
        } else {
          i += 1
          value += consumeEscape()
        }
        continue
      }
      value += c === 0 ? REPLACEMENT : src[i]
      i += 1
    }
  }

  const SINGLE: Record<number, CssTokenType> = {
    0x28: '(', 0x29: ')', 0x5b: '[', 0x5d: ']', 0x7b: '{', 0x7d: '}',
    0x2c: 'comma', 0x3a: 'colon', 0x3b: 'semicolon',
  }

  while (i < n) {
    const start = i
    const c = at(i)
    if (c === 0x2f && at(i + 1) === 0x2a) {
      const close = src.indexOf('*/', i + 2)
      if (close === -1) {
        errors.push({ kind: 'unclosed-comment', offset: start })
        i = n
      } else {
        i = close + 2
      }
      continue
    }
    if (isWhitespace(c)) {
      while (isWhitespace(at(i))) i += 1
      push('whitespace', start)
      continue
    }
    if (isQuote(c)) {
      i += 1
      consumeString(start, c)
      continue
    }
    const single = SINGLE[c]
    if (single) {
      i += 1
      push(single, start)
      continue
    }
    if (c === 0x23) {
      if (isNameChar(at(i + 1)) || validEscape(i + 1)) {
        const hashId = startsIdent(i + 1)
        i += 1
        push('hash', start, consumeName(), 0, hashId)
      } else {
        i += 1
        push('delim', start, '#')
      }
      continue
    }
    if (c === 0x2b || c === 0x2e) {
      if (startsNumber(i)) consumeNumeric(start)
      else {
        i += 1
        push('delim', start, src[start]!)
      }
      continue
    }
    if (c === 0x2d) {
      if (startsNumber(i)) consumeNumeric(start)
      else if (at(i + 1) === 0x2d && at(i + 2) === 0x3e) {
        i += 3
        push('CDC', start)
      } else if (startsIdent(i)) consumeIdentLike(start)
      else {
        i += 1
        push('delim', start, '-')
      }
      continue
    }
    if (c === 0x3c && src.startsWith('!--', i + 1)) {
      i += 4
      push('CDO', start)
      continue
    }
    if (c === 0x40) {
      if (startsIdent(i + 1)) {
        i += 1
        push('at-keyword', start, consumeName())
      } else {
        i += 1
        push('delim', start, '@')
      }
      continue
    }
    if (c === 0x5c) {
      if (validEscape(i)) consumeIdentLike(start)
      else {
        i += 1
        push('delim', start, '\\')
      }
      continue
    }
    if (isDigit(c)) {
      consumeNumeric(start)
      continue
    }
    if (isNameStart(c)) {
      consumeIdentLike(start)
      continue
    }
    i += 1
    push('delim', start, src[start]!)
  }
  return { tokens, errors }
}
