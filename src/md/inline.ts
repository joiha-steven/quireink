// Phase two: the text inside a block.
//
// Runs after the block structure is settled, on the raw lines a leaf collected. That order is
// CommonMark's and it matters: `*foo\n*bar*` is one paragraph of two lines and the emphasis is
// found across the newline, which a parser working line by line could never see.
//
// The scan here is left to right and each step is decided where it stands — except for the two
// that cannot be. Emphasis and links are settled by the delimiter stack in `inline-chunks.ts`,
// which is why the output is built as a linked list rather than an array: those two reach back
// into text already read and wrap it.

import type { Inline } from './ast'
import { ENTITIES } from './entity'
import { ChunkList, DelimStack, processEmphasis, scanDelims, type Chunk, type Delim } from './inline-chunks'
import { inlineLinkTail, linkLabelLength, unescapeString } from './inline-link'
import { normalizeLabel, type LinkDefs } from './link-ref'
import { linkifyAll } from './gfm-autolink'
import { INK_SYNTAX_SOURCE, RING_SYNTAX_SOURCE, UNDER_SYNTAX_SOURCE } from '@/pen/grammar'
import { matchMathAt } from '@/render/math-syntax'

/**
 * THE PEN'S GRAMMAR COMES FROM `pen/grammar.ts`, not from a copy of it here.
 *
 * That file's own warning is the reason: four parsers used to read `==text==` and the two that
 * spelled the rule out separately drifted within the hour — `toPlainText` put the word "green"
 * into every excerpt of a post that used a colour suffix. This engine is what ends the other
 * three, and it would be a poor start to copy the regex on the way.
 */
const PEN = {
  ink: new RegExp(`^${INK_SYNTAX_SOURCE}`),
  underline: new RegExp(`^${UNDER_SYNTAX_SOURCE}`),
  ring: new RegExp(`^${RING_SYNTAX_SOURCE}`),
} as const

const ESCAPABLE = /[!-/:-@[-`{-~]/

/** An open `[` or `![`, waiting for the `]` that may turn it into a link. */
type Bracket = {
  chunk: Chunk
  /** Where the label's text starts, in the source. */
  index: number
  image: boolean
  /** Cleared on every open bracket when a link is built: links may not nest in links. */
  active: boolean
  /** Whether a `[` has been seen since this one — a collapsed reference may not have one. */
  bracketAfter: boolean
  /** The delimiter stack's top when this opened; emphasis inside resolves no further back. */
  prevDelim: Delim | null
  prev: Bracket | null
}

export class InlineParser {
  private text: string
  private pos = 0
  private list = new ChunkList()
  private delims = new DelimStack()
  private brackets: Bracket | null = null
  private defs: LinkDefs

  constructor(text: string, defs: LinkDefs = new Map()) {
    this.text = text
    this.defs = defs
  }

  parse(): Inline[] {
    while (this.pos < this.text.length) {
      if (!this.step()) this.pushText(this.text[this.pos++]!)
    }
    processEmphasis(this.list, this.delims, null)
    // GFM's bare URLs, last: they are found in the text that survived every other rule, so a
    // code span or a link written the CommonMark way has already taken its characters away.
    return linkifyAll(this.list.toArray())
  }

  private step(): boolean {
    const ch = this.text[this.pos]!
    switch (ch) {
      case '&':
        return this.entity()
      case '`':
        return this.codeSpan()
      case '<':
        return this.autolinkOrHtml()
      case '\n':
        return this.lineBreak()
      case '*':
      case '_':
      case '~':
        return this.delimiterRun(ch)
      case '[':
        return this.openBracket(false)
      case '!':
        return this.text[this.pos + 1] === '[' ? this.openBracket(true) : false
      case ']':
        return this.closeBracket()
      case '=':
        return this.pen('ink')
      case '+':
        return this.pen('underline')
      case '@':
        return this.pen('ring')
      case '$':
      case '\\':
        return this.math() || (ch === '\\' ? this.backslash() : false)
      default:
        return false
    }
  }

  // ----- emphasis -------------------------------------------------------------------------

  private delimiterRun(char: string): boolean {
    const scan = scanDelims(this.text, this.pos, char)
    const run = char.repeat(scan.count)
    this.pos += scan.count
    const chunk = this.list.push({ type: 'text', value: run })
    this.delims.push(chunk, char, scan.count, scan.canOpen, scan.canClose)
    return true
  }

  /**
   * One of the pen's three gestures, if the fence at the cursor completes one.
   *
   * The content is parsed as inline Markdown of its own, so bold, a link and a code span all
   * survive under a stroke — which is the first thing anybody tries. `marked` does the same
   * thing by calling back into its lexer; here it is a recursive parse, and the delimiter
   * stack of the inner run is its own, which is correct: a `*` inside a highlight may not pair
   * with one outside it.
   */
  /**
   * A formula, in any of the delimiters this blog accepts: `$…$`, `\\(…\\)`, `$$…$$`, `\\[…\\]`.
   *
   * The match comes from `render/math-syntax.ts`, which every parser here already shares, and
   * the TeX inside is never handed to the inline scan — `x_1 + y_2` would come back with an
   * `<em>` in the middle of it.
   */
  private math(): boolean {
    const m = matchMathAt(this.text.slice(this.pos))
    if (!m) return false
    this.list.push({ type: 'math', value: m.tex, display: m.display })
    this.pos += m.raw.length
    return true
  }

  private pen(type: 'ink' | 'underline' | 'ring'): boolean {
    const m = PEN[type].exec(this.text.slice(this.pos))
    if (!m) return false
    this.list.push({ type, ink: m[2], raw: m[0], children: parseInline(m[1]!, this.defs) })
    this.pos += m[0].length
    return true
  }

  // ----- links and images -----------------------------------------------------------------

  private openBracket(image: boolean): boolean {
    const marker = image ? '![' : '['
    this.pos += marker.length
    const chunk = this.list.push({ type: 'text', value: marker })
    if (this.brackets) this.brackets.bracketAfter = true
    this.brackets = {
      chunk, index: this.pos, image, active: true, bracketAfter: false,
      prevDelim: this.delims.top, prev: this.brackets,
    }
    return true
  }

  /**
   * A `]`, and the four shapes it may complete.
   *
   *   [text](/url "title")   inline
   *   [text][label]          full reference
   *   [text][]               collapsed
   *   [text]                 shortcut
   *
   * They are tried in that order, and anything that matches none of them leaves a literal `]`
   * behind — which is most of them, since `]` is an ordinary character in prose.
   */
  private closeBracket(): boolean {
    this.pos += 1
    const startPos = this.pos
    const opener = this.brackets
    // The cursor has already moved past the `]`, so handing back "not mine" would drop the
    // character entirely — `[link] bar](/uri)` came out missing its second bracket.
    if (!opener) {
      this.pushText(']')
      return true
    }
    if (!opener.active) {
      this.brackets = opener.prev
      this.pushText(']')
      return true
    }

    const savePos = this.pos
    let url: string | undefined
    let title: string | undefined

    const tail = inlineLinkTail(this.text, this.pos)
    if (tail) {
      url = tail.url
      title = tail.title
      this.pos = tail.next
    } else {
      // A reference, in one of its three spellings.
      const labelLength = linkLabelLength(this.text, this.pos)
      let label: string | null = null
      if (labelLength > 2) label = this.text.slice(this.pos + 1, this.pos + labelLength - 1)
      else if (!opener.bracketAfter) label = this.text.slice(opener.index, startPos - 1)
      if (labelLength === 0) this.pos = savePos
      else this.pos += labelLength

      const found = label === null ? undefined : this.defs.get(normalizeLabel(label))
      if (found) {
        url = found.url
        title = found.title
      } else {
        this.pos = savePos
      }
    }

    if (url === undefined) {
      this.brackets = opener.prev
      this.pos = startPos
      this.pushText(']')
      return true
    }

    // The emphasis inside the label resolves now, and only back as far as this bracket.
    processEmphasis(this.list, this.delims, opener.prevDelim)
    const children = this.list.take(opener.chunk.next, null)
    this.list.unlink(opener.chunk)
    this.list.push(
      opener.image
        ? { type: 'image', url: unescapeString(url), title: title === undefined ? undefined : unescapeString(title), alt: children }
        : { type: 'link', url: unescapeString(url), title: title === undefined ? undefined : unescapeString(title), children },
    )

    this.brackets = opener.prev
    // A link may not contain a link. An image may, because its content is alt text.
    if (!opener.image) {
      for (let b = this.brackets; b; b = b.prev) if (!b.image) b.active = false
    }
    return true
  }

  // ----- the parts that finish where they start --------------------------------------------

  private backslash(): boolean {
    const next = this.text[this.pos + 1]
    if (next === '\n') {
      this.list.push({ type: 'hardbreak' })
      this.pos += 2
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

  private entity(): boolean {
    const rest = this.text.slice(this.pos)
    const named = /^&([A-Za-z][A-Za-z0-9]{1,31});/.exec(rest)
    if (named) {
      const value = ENTITIES[named[1]!]
      if (value === undefined) return false
      this.pushText(value)
      this.pos += named[0].length
      return true
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
   * A code span, and the two trims that are not the same trim.
   *
   * Line endings inside become spaces; then, IF the content both begins and ends with a space
   * and is not all spaces, one space comes off each end — which is what lets a backtick be
   * written as `` ` ``.
   */
  private codeSpan(): boolean {
    const open = /^`+/.exec(this.text.slice(this.pos))![0]
    const after = this.pos + open.length
    const closer = new RegExp(`(?<!\`)\`{${open.length}}(?!\`)`).exec(this.text.slice(after))
    if (!closer) {
      // THE WHOLE RUN BECOMES TEXT, and the cursor goes past all of it. Backing off by one
      // character instead let the run be re-scanned a backtick shorter, so ```` ```foo`` ````
      // found a two-backtick span inside a three-backtick opener that had no match at all.
      this.pushText(open)
      this.pos = after
      return true
    }
    let value = this.text.slice(after, after + closer.index).replace(/\n/g, ' ')
    if (value.length > 2 && value.startsWith(' ') && value.endsWith(' ') && value.trim() !== '') {
      value = value.slice(1, -1)
    }
    this.list.push({ type: 'code', value })
    this.pos = after + closer.index + open.length
    return true
  }

  private autolinkOrHtml(): boolean {
    const rest = this.text.slice(this.pos)

    const uri = /^<([A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\x00-\x20]*)>/.exec(rest)
    if (uri) {
      this.list.push({ type: 'link', url: uri[1]!, children: [{ type: 'text', value: uri[1]! }] })
      this.pos += uri[0].length
      return true
    }

    const mail = /^<([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)>/.exec(rest)
    if (mail) {
      this.list.push({ type: 'link', url: `mailto:${mail[1]}`, children: [{ type: 'text', value: mail[1]! }] })
      this.pos += mail[0].length
      return true
    }

    const tag = HTML_TAG_RE.exec(rest)
    if (tag) {
      this.list.push({ type: 'html', value: tag[0] })
      this.pos += tag[0].length
      return true
    }
    return false
  }

  /** Two trailing spaces make a hard break; one or none makes a soft one. */
  private lineBreak(): boolean {
    let spaces = 0
    const last = this.list.tail
    if (last && last.node.type === 'text') {
      const trimmed = last.node.value.replace(/ +$/, '')
      spaces = last.node.value.length - trimmed.length
      if (spaces > 0) last.node.value = trimmed
      if (last.node.value === '') this.list.unlink(last)
    }
    this.list.push(spaces >= 2 ? { type: 'hardbreak' } : { type: 'softbreak' })
    this.pos += 1
    while (this.text[this.pos] === ' ' || this.text[this.pos] === '\t') this.pos++
    return true
  }

  private pushText(value: string): void {
    const last = this.list.tail
    // Never merge into a chunk a delimiter is holding: its length is how many characters that
    // delimiter still owns, and growing it from behind would hand it text it must not take.
    const mergeable = last && last.node.type === 'text' && this.delims.top?.chunk !== last && this.brackets?.chunk !== last
    if (mergeable) (last.node as Extract<Inline, { type: 'text' }>).value += value
    else this.list.push({ type: 'text', value })
  }
}

function codePoint(n: number): string {
  if (n === 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '�'
  return String.fromCodePoint(n)
}

const NAME = '[A-Za-z][A-Za-z0-9-]*'
const ATTR = `(?:[ \\t\\n]+[_:A-Za-z][\\w.:-]*(?:[ \\t\\n]*=[ \\t\\n]*(?:[^ \\t\\n"'=<>\`]+|'[^']*'|"[^"]*"))?)*`
const HTML_TAG_RE = new RegExp(
  `^(?:<${NAME}${ATTR}[ \\t\\n]*/?>` +
    `|</${NAME}[ \\t\\n]*>` +
    `|<!-->|<!--->|<!--[\\s\\S]*?-->` +
    `|<\\?[\\s\\S]*?\\?>` +
    `|<![A-Za-z][^>]*>` +
    `|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`,
)

export function parseInline(text: string, defs?: LinkDefs): Inline[] {
  return new InlineParser(text, defs).parse()
}
