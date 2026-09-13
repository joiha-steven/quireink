// Link reference definitions: `[label]: /url "title"`, and the labels that find them again.
//
// THEY ARE NOT BLOCKS, which is the thing to understand about them. A definition is peeled off
// the FRONT of a paragraph — several may be, one after another — and whatever is left is the
// paragraph. A paragraph that was nothing but definitions disappears entirely, and that is why
// `[foo]: /url` on its own line produces no output at all.
//
// And they are collected in a pass of their own, before any inline parsing happens, because a
// link may point at a definition written further down the document. A parser that resolved
// links as it met them would get every forward reference wrong.

export type LinkDef = { url: string; title?: string }
export type LinkDefs = Map<string, LinkDef>

/**
 * A label, as the key two of them are the same by.
 *
 * Case folding plus whitespace collapsing, both the spec's: `[Foo Bar]` and `[foo   bar]` are
 * one label. `toLowerCase` after `toUpperCase` is not a typo — it is the Unicode case-folding
 * the spec asks for, and it is what makes `[ẞ]` and `[ß]` match.
 */
export function normalizeLabel(label: string): string {
  // THREE STEPS, not two. `ẞ` lowercases to `ß`, which uppercases to `SS`, which lowercases to
  // `ss` — the same key `SS` reaches. Starting with uppercase leaves `ẞ` alone and the two
  // labels never meet.
  return label.trim().replace(/[ \t\r\n]+/g, ' ').toLowerCase().toUpperCase().toLowerCase()
}

/** A backslash escape or an entity inside a URL or a title, resolved. */
function unescape(text: string, entity: (s: string) => string): string {
  return entity(text.replace(/\\([!-/:-@[-`{-~])/g, '$1'))
}

/**
 * Peel every definition off the front of a paragraph's text.
 *
 * Returns what is left. Definitions found are added to `defs`, and the FIRST one for a label
 * wins — a second definition of the same label is not an error and does not overwrite.
 */
export function stripDefinitions(text: string, defs: LinkDefs, entity: (s: string) => string): string {
  let rest = text
  for (;;) {
    const def = matchDefinition(rest)
    if (!def) return rest
    const key = normalizeLabel(def.label)
    if (key !== '' && !defs.has(key)) {
      defs.set(key, { url: unescape(def.url, entity), title: def.title === undefined ? undefined : unescape(def.title, entity) })
    }
    rest = def.rest
  }
}

type Matched = { label: string; url: string; title?: string; rest: string }

/**
 * One definition at the very start of the text, if there is one.
 *
 * Written as a hand scan rather than one regular expression because three of its four parts
 * are not regular: a label may contain escaped brackets, a pointy URL may contain escaped
 * angles, and a title in parentheses may nest them. The version of this that was a regex
 * matched `[a\]b]: /x` as a label of `a\` and then quietly dropped the rest of the paragraph.
 */
function matchDefinition(text: string): Matched | null {
  let i = 0
  // Up to three spaces of indent; four would have made it a code block before now.
  while (i < 3 && text[i] === ' ') i++
  if (text[i] !== '[') return null
  i++

  let label = ''
  let closed = false
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '\\' && i + 1 < text.length) {
      label += ch + text[i + 1]
      i += 2
      continue
    }
    if (ch === '[') return null // an unescaped bracket may not appear inside a label
    if (ch === ']') {
      closed = true
      i++
      break
    }
    label += ch
    i++
  }
  if (!closed || label.length > 999 || label.trim() === '') return null
  if (text[i] !== ':') return null
  i++

  // Whitespace, up to one blank line.
  i = skipSpace(text, i)
  if (i >= text.length) return null

  const url = matchUrl(text, i)
  if (!url) return null
  i = url.next

  // A title is optional, and it must be separated by whitespace — but if what follows the
  // whitespace is not a title, the definition still stands and the rest is the paragraph.
  const afterUrl = i
  const beforeTitle = skipSpace(text, i)
  let title: string | undefined
  if (beforeTitle > afterUrl || beforeTitle >= text.length) {
    const t = matchTitle(text, beforeTitle)
    if (t) {
      const endOfLine = skipInlineSpace(text, t.next)
      // Anything other than the end of the line after a title means it was not a title.
      if (endOfLine >= text.length || text[endOfLine] === '\n') {
        title = t.value
        i = endOfLine < text.length ? endOfLine + 1 : endOfLine
        return { label, url: url.value, title, rest: text.slice(i) }
      }
    }
  }

  const endOfLine = skipInlineSpace(text, afterUrl)
  if (endOfLine < text.length && text[endOfLine] !== '\n') return null
  return { label, url: url.value, title, rest: text.slice(endOfLine < text.length ? endOfLine + 1 : endOfLine) }
}

function skipInlineSpace(text: string, from: number): number {
  let i = from
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) i++
  return i
}

/** Whitespace including at most one newline: a definition may wrap, but not across a blank line. */
function skipSpace(text: string, from: number): number {
  let i = skipInlineSpace(text, from)
  if (text[i] === '\n') {
    i = skipInlineSpace(text, i + 1)
    if (text[i] === '\n') return from // a blank line ends the definition's reach
  }
  return i
}

/** `<a url>` or a bare one, which may carry balanced parentheses but no spaces. */
export function matchUrl(text: string, from: number): { value: string; next: number } | null {
  let i = from
  if (text[i] === '<') {
    i++
    let value = ''
    while (i < text.length) {
      const ch = text[i]!
      if (ch === '\\' && i + 1 < text.length && /[!-/:-@[-`{-~]/.test(text[i + 1]!)) {
        value += ch + text[i + 1]
        i += 2
        continue
      }
      if (ch === '\n' || ch === '<') return null
      if (ch === '>') return { value, next: i + 1 }
      value += ch
      i++
    }
    return null
  }

  let depth = 0
  let value = ''
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '\\' && i + 1 < text.length && /[!-/:-@[-`{-~]/.test(text[i + 1]!)) {
      value += ch + text[i + 1]
      i += 2
      continue
    }
    if (ch === ' ' || ch === '\t' || ch === '\n' || (ch <= '\x1f' && ch !== '\t')) break
    if (ch === '(') depth++
    if (ch === ')') {
      if (depth === 0) break
      depth--
    }
    value += ch
    i++
  }
  if (depth !== 0) return null
  if (value === '' && i === from) return { value: '', next: i }
  return { value, next: i }
}

/** `"title"`, `'title'` or `(title)`, with the quotes off. */
export function matchTitle(text: string, from: number): { value: string; next: number } | null {
  const open = text[from]
  if (open !== '"' && open !== "'" && open !== '(') return null
  const close = open === '(' ? ')' : open
  let i = from + 1
  let value = ''
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '\\' && i + 1 < text.length && /[!-/:-@[-`{-~]/.test(text[i + 1]!)) {
      value += ch + text[i + 1]
      i += 2
      continue
    }
    if (ch === close) return { value, next: i + 1 }
    if (open === '(' && ch === '(') return null // unescaped nesting is not allowed
    value += ch
    i++
  }
  return null
}
