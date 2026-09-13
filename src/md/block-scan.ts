// Recognising the start of a block. Pure functions over one line, no state, no tree.
//
// Split from the parser loop because these are the rules a person argues about — is `- - -`
// a thematic break or a list of a list, does `1)` start a list, how many backticks close a
// fence — and an argument is easier to settle against a function that takes a line and
// answers than against a branch buried in a loop over a stack of open containers.

import { Line } from './line'

/** ATX heading: 1-6 `#`, then a space or the end of the line. `#foo` is a paragraph. */
export function atxHeading(line: Line): { level: number; text: string } | null {
  if (line.indent() >= 4) return null
  const rest = line.clone()
  rest.skipWhitespace()
  const m = /^(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/.exec(rest.rest())
  if (!m) return null
  // The closing run of `#` is decoration and comes off, but only when it is separated: the
  // heading `# foo#` keeps its hash, `# foo #` does not.
  const body = (m[2] ?? '').replace(/(^|[ \t])#+[ \t]*$/, '$1').trimEnd()
  return { level: m[1]!.length, text: body }
}

/** ``` or ~~~ — the char, how many, and the info string after it. */
export function codeFence(line: Line): { char: string; length: number; info: string; indent: number } | null {
  if (line.indent() >= 4) return null
  const indent = line.indent()
  const rest = line.clone()
  rest.skipWhitespace()
  const text = rest.rest()
  const m = /^(`{3,}|~{3,})(.*)$/.exec(text)
  if (!m) return null
  const info = m[2]!.trim()
  // A backtick fence may not carry a backtick in its info string — that shape is a code span
  // spanning lines, and reading it as a fence swallows the rest of the document.
  if (m[1]![0] === '`' && info.includes('`')) return null
  return { char: m[1]![0]!, length: m[1]!.length, info, indent }
}

/** The fence that closes an open one: same char, at least as long, nothing else on the line. */
export function closesFence(line: Line, char: string, length: number): boolean {
  if (line.indent() >= 4) return false
  const rest = line.clone()
  rest.skipWhitespace()
  const m = new RegExp(`^\\${char}{${length},}[ \\t]*$`).exec(rest.rest())
  return m !== null
}

/** Three or more of `*`, `-` or `_`, spaces allowed between, nothing else. */
export function thematicBreak(line: Line): boolean {
  if (line.indent() >= 4) return false
  const rest = line.clone()
  rest.skipWhitespace()
  const text = rest.rest()
  const m = /^([*\-_])[ \t]*(?:\1[ \t]*){2,}$/.exec(text)
  return m !== null
}

/** `=` or `-` under a paragraph: the level it makes that paragraph. */
export function setextUnderline(line: Line): 1 | 2 | null {
  if (line.indent() >= 4) return null
  const rest = line.clone()
  rest.skipWhitespace()
  const text = rest.rest()
  if (/^=+[ \t]*$/.test(text)) return 1
  if (/^-+[ \t]*$/.test(text)) return 2
  return null
}

export type ListMarker = {
  ordered: boolean
  /** `-`, `+`, `*` for bullets; the `.` or `)` for ordered. Two lists differ if these do. */
  delim: string
  start: number
  /** Characters the marker itself occupies. */
  width: number
  /** Columns from the marker's end to the item's content. */
  padding: number
}

/**
 * A list marker at the start of a line, and how far in its content sits.
 *
 * THE PADDING IS THE RULE PEOPLE GET WRONG. Content normally begins one space after the
 * marker — but between two and four spaces are all "one space" as far as the marker is
 * concerned, and FIVE or more means the marker is followed by an indented code block, so the
 * content starts one space in and the rest is code. A marker followed by nothing at all
 * (`-` alone) also takes one.
 */
export function listMarker(line: Line, interrupting: boolean): ListMarker | null {
  if (line.indent() >= 4) return null
  const probe = line.clone()
  probe.skipWhitespace()
  const text = probe.rest()

  let ordered = false
  let delim = ''
  let start = 1
  let width = 0

  const bullet = /^([-+*])/.exec(text)
  const number = /^(\d{1,9})([.)])/.exec(text)
  if (bullet) {
    delim = bullet[1]!
    width = 1
  } else if (number) {
    ordered = true
    start = Number(number[1])
    delim = number[2]!
    width = number[1]!.length + 1
    // A list may interrupt a paragraph only when it starts at 1: `I paid 2. 50 dollars`
    // must not become a list in the middle of a sentence.
    if (interrupting && start !== 1) return null
  } else {
    return null
  }

  const after = text.slice(width)
  // `- ` with nothing after it cannot interrupt a paragraph either: an empty item in the
  // middle of running text is never what somebody meant.
  if (interrupting && /^[ \t]*$/.test(after)) return null
  if (after !== '' && !/^[ \t]/.test(after)) return null

  let spaces = 0
  for (const ch of after) {
    if (ch === ' ') spaces += 1
    else if (ch === '\t') spaces += 4 - (spaces % 4)
    else break
  }
  const blank = /^[ \t]*$/.test(after)
  const padding = blank || spaces > 4 ? 1 : spaces
  return { ordered, delim, start, width, padding }
}

/** GFM: `- [ ] task` / `- [x] done`. Read from an item's content, after the marker. */
export function taskMarker(text: string): { checked: boolean; rest: string } | null {
  const m = /^\[([ xX])\](?=[ \t]|$)(.*)$/.exec(text)
  if (!m) return null
  return { checked: m[1] !== ' ', rest: m[2]!.replace(/^[ \t]/, '') }
}

/** `>`, with up to three spaces before it and one optional space after. */
export function blockquoteMarker(line: Line): boolean {
  if (line.indent() >= 4) return false
  const probe = line.clone()
  probe.skipWhitespace()
  return probe.peek() === '>'
}

// ----- HTML blocks ------------------------------------------------------------------------
//
// Seven kinds, and they differ in how they END, which is why the kind is remembered rather
// than re-derived. 1-5 run to a closing marker and may contain blank lines; 6 and 7 run to
// the next blank line. 7 — any other complete tag on a line of its own — may not interrupt a
// paragraph, or every line beginning with a tag would cut the paragraph it is inside.

const HTML_TAG =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul'

const NAME = '[A-Za-z][A-Za-z0-9-]*'
const ATTR = `(?:\\s+[_:A-Za-z][\\w.:-]*(?:\\s*=\\s*(?:[^\\s"'=<>\`]+|'[^']*'|"[^"]*"))?)*`
const OPEN_TAG = `<${NAME}${ATTR}\\s*/?>`
const CLOSE_TAG = `</${NAME}\\s*>`

export function htmlBlockStart(line: Line, inParagraph: boolean): number | null {
  if (line.indent() >= 4) return null
  const probe = line.clone()
  probe.skipWhitespace()
  const text = probe.rest()
  if (text[0] !== '<') return null

  if (/^<(?:script|pre|style|textarea)(?=[\s>]|$)/i.test(text)) return 1
  if (text.startsWith('<!--')) return 2
  if (text.startsWith('<?')) return 3
  if (/^<![A-Za-z]/.test(text)) return 4
  if (text.startsWith('<![CDATA[')) return 5
  if (new RegExp(`^</?(?:${HTML_TAG})(?=[\\s/>]|$)`, 'i').test(text)) return 6
  if (!inParagraph && new RegExp(`^(?:${OPEN_TAG}|${CLOSE_TAG})[ \\t]*$`).test(text)) return 7
  return null
}

/** Whether a line ends an HTML block of kinds 1-5. Kinds 6 and 7 end at a blank line. */
export function htmlBlockEnds(kind: number, text: string): boolean {
  switch (kind) {
    case 1:
      return /<\/(?:script|pre|style|textarea)>/i.test(text)
    case 2:
      return text.includes('-->')
    case 3:
      return text.includes('?>')
    case 4:
      return text.includes('>')
    case 5:
      return text.includes(']]>')
    default:
      return false
  }
}
