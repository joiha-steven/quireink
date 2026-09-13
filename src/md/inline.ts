// Phase two: the text inside a block.
//
// Runs after the block structure is settled, on the raw lines a leaf collected. That order is
// CommonMark's and it matters: `*foo\n*bar*` is one paragraph of two lines and the emphasis
// is found across the newline, which a parser that worked line by line could never see.
//
// This file holds the parts that scan LEFT TO RIGHT and finish where they started — escapes,
// entities, code spans, autolinks, raw HTML. Emphasis and links do not work that way: they
// need a stack of delimiters that is revisited when the closer turns up, and that lives in
// `inline-delims.ts`.

import type { Inline } from './ast'
import { ENTITIES } from './entity'

/** ASCII punctuation, the only characters a backslash may escape. */
const ESCAPABLE = /[!-/:-@[-`{-~]/

export class InlineParser {
  private text: string
  private pos = 0
  private out: Inline[] = []

  constructor(text: string) {
    this.text = text
  }

  parse(): Inline[] {
    while (this.pos < this.text.length) {
      if (!this.step()) this.pushText(this.text[this.pos++]!)
    }
    return merge(this.out)
  }

  /** One inline thing at the cursor. False when nothing here is special. */
  private step(): boolean {
    const ch = this.text[this.pos]!
    switch (ch) {
      case '\\':
        return this.backslash()
      case '&':
        return this.entity()
      case '`':
        return this.codeSpan()
      case '<':
        return this.autolinkOrHtml()
      case '\n':
        return this.lineBreak()
      default:
        return false
    }
  }

  /**
   * A backslash before ASCII punctuation escapes it; before a newline it is a hard break;
   * anywhere else it is a literal backslash.
   */
  private backslash(): boolean {
    const next = this.text[this.pos + 1]
    if (next === '\n') {
      this.out.push({ type: 'hardbreak' })
      this.pos += 2
      // The spaces that would have been the next line's indent are not part of it.
      while (this.text[this.pos] === ' ' || this.text[this.pos] === '\t') this.pos++
      return true
    }
    if (next && ESCAPABLE.test(next)) {
      this.pushText(next)
      this.pos += 2
      return true
    }
    return false
  }

  /** `&amp;`, `&#35;`, `&#x22;` — resolved to the character, as the spec requires. */
  private entity(): boolean {
    const rest = this.text.slice(this.pos)
    const named = /^&([A-Za-z][A-Za-z0-9]{1,31});/.exec(rest)
    if (named) {
      const value = ENTITIES[named[1]!]
      if (value !== undefined) {
        this.pushText(value)
        this.pos += named[0].length
        return true
      }
      return false
    }
    const dec = /^&#(\d{1,7});/.exec(rest)
    if (dec) {
      this.pushText(codePoint(Number(dec[1])))
      this.pos += dec[0].length
      return true
    }
    const hex = /^&#[xX]([0-9a-fA-F]{1,6});/.exec(rest)
    if (hex) {
      this.pushText(codePoint(parseInt(hex[1]!, 16)))
      this.pos += hex[0].length
      return true
    }
    return false
  }

  /**
   * A code span: a run of backticks, its match, and the text between.
   *
   * The two trims are the spec's and they are not the same trim. Line endings inside become
   * spaces; then, IF the content both begins and ends with a space and is not all spaces, one
   * space comes off each end — which is what lets `` ` `` be written as `` `` ` `` ``.
   */
  private codeSpan(): boolean {
    const open = /^`+/.exec(this.text.slice(this.pos))![0]
    const after = this.pos + open.length
    const closer = new RegExp(`(?<!\`)\`{${open.length}}(?!\`)`).exec(this.text.slice(after))
    if (!closer) return false
    let value = this.text.slice(after, after + closer.index).replace(/\n/g, ' ')
    if (value.length > 2 && value.startsWith(' ') && value.endsWith(' ') && value.trim() !== '') {
      value = value.slice(1, -1)
    }
    this.out.push({ type: 'code', value })
    this.pos = after + closer.index + open.length
    return true
  }

  /** `<https://…>`, `<me@example.com>`, or a raw HTML tag. */
  private autolinkOrHtml(): boolean {
    const rest = this.text.slice(this.pos)

    const uri = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\x00-\x20]*)>/.exec(rest)
    if (uri) {
      this.out.push({ type: 'link', url: uri[1]!, children: [{ type: 'text', value: uri[1]! }] })
      this.pos += uri[0].length
      return true
    }

    const mail = /^<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)>/.exec(rest)
    if (mail) {
      this.out.push({ type: 'link', url: `mailto:${mail[1]}`, children: [{ type: 'text', value: mail[1]! }] })
      this.pos += mail[0].length
      return true
    }

    const tag = HTML_TAG_RE.exec(rest)
    if (tag) {
      this.out.push({ type: 'html', value: tag[0] })
      this.pos += tag[0].length
      return true
    }
    return false
  }

  /** Two trailing spaces make a hard break; one or none makes a soft one. */
  private lineBreak(): boolean {
    let spaces = 0
    let i = this.out.length - 1
    const last = this.out[i]
    if (last && last.type === 'text') {
      const trimmed = last.value.replace(/ +$/, '')
      spaces = last.value.length - trimmed.length
      if (spaces > 0) last.value = trimmed
      if (last.value === '') this.out.pop()
    }
    this.out.push(spaces >= 2 ? { type: 'hardbreak' } : { type: 'softbreak' })
    this.pos += 1
    // Leading whitespace on the next line is not content.
    while (this.text[this.pos] === ' ' || this.text[this.pos] === '\t') this.pos++
    return true
  }

  private pushText(value: string): void {
    const last = this.out[this.out.length - 1]
    if (last && last.type === 'text') last.value += value
    else this.out.push({ type: 'text', value })
  }
}

/** A code point as a character, with the spec's substitution for the ones that cannot be. */
function codePoint(n: number): string {
  if (n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '�'
  return String.fromCodePoint(n)
}

const NAME = '[A-Za-z][A-Za-z0-9-]*'
const ATTR = `(?:[ \\t\\n]+[_:A-Za-z][\\w.:-]*(?:[ \\t\\n]*=[ \\t\\n]*(?:[^ \\t\\n"'=<>\`]+|'[^']*'|"[^"]*"))?)*`
const HTML_TAG_RE = new RegExp(
  `^(?:<${NAME}${ATTR}[ \\t\\n]*/?>` +
    `|</${NAME}[ \\t\\n]*>` +
    `|<!--(?!>|->)(?:[^-]|-(?!-))*-->` +
    `|<\\?[\\s\\S]*?\\?>` +
    `|<![A-Za-z][^>]*>` +
    `|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`,
)

/** Adjacent text nodes become one, so a renderer never emits two `<text>` runs in a row. */
function merge(nodes: Inline[]): Inline[] {
  const out: Inline[] = []
  for (const n of nodes) {
    const last = out[out.length - 1]
    if (n.type === 'text' && last && last.type === 'text') last.value += n.value
    else out.push(n)
  }
  return out
}

export function parseInline(text: string): Inline[] {
  return new InlineParser(text).parse()
}
