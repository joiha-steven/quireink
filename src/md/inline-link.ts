// The pieces of a link that are pure scanning: its label, and the `(url "title")` after it.
//
// Kept out of the parser because they are the parts with no state — give them a string and a
// position and they answer — and because the link algorithm in `inline.ts` is hard enough to
// read without the bracket counting inlined into it.

import { matchTitle, matchUrl } from './link-ref'

/**
 * The length of a `[…]` label starting at `from`, or 0 if there is not one.
 *
 * Brackets nest, escaped brackets do not count, and a label may not exceed 999 characters —
 * all three are the spec's, and the last one is what stops a runaway `[` from making the
 * parser scan the rest of a long document for a closer that is not there.
 */
export function linkLabelLength(text: string, from: number): number {
  if (text[from] !== '[') return 0
  let i = from + 1
  let depth = 1
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '\\' && i + 1 < text.length) {
      i += 2
      continue
    }
    if (ch === '`') {
      // A code span inside a label hides its brackets: `[a `]` b]` is one label.
      const fence = /^`+/.exec(text.slice(i))![0]
      const close = text.indexOf(fence, i + fence.length)
      i = close === -1 ? i + fence.length : close + fence.length
      continue
    }
    if (ch === '[') depth++
    if (ch === ']') {
      depth--
      if (depth === 0) {
        const length = i - from + 1
        return length > 1001 ? 0 : length
      }
    }
    i += 1
  }
  return 0
}

/**
 * The `(…)` that follows a link's label: its destination and optional title.
 *
 * Answers null when what follows is not one, and the caller then tries the reference forms.
 * That fallback is why this may not be lenient: `[a](not a url)` has to FAIL here so it can
 * be tried as a shortcut reference, and a permissive match would swallow it.
 */
export function inlineLinkTail(text: string, from: number): { url: string; title?: string; next: number } | null {
  if (text[from] !== '(') return null
  let i = skipWhitespace(text, from + 1)

  const dest = matchUrl(text, i)
  if (!dest) return null
  i = dest.next

  const afterDest = i
  i = skipWhitespace(text, i)
  let title: string | undefined
  // A title must be separated from the destination by whitespace; `(/url"title")` is not one.
  if (i > afterDest) {
    const t = matchTitle(text, i)
    if (t) {
      title = t.value
      i = skipWhitespace(text, t.next)
    }
  }

  if (text[i] !== ')') return null
  return { url: dest.value, title, next: i + 1 }
}

function skipWhitespace(text: string, from: number): number {
  let i = from
  while (i < text.length && /[ \t\n]/.test(text[i]!)) i++
  return i
}

/** A backslash escape resolved, for a URL or a title on its way into the tree. */
export function unescapeString(text: string): string {
  return text.replace(/\\([!-/:-@[-`{-~])/g, '$1')
}
