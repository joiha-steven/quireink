// The pieces of a link that are pure scanning: its label, and the `(url "title")` after it.
//
// Kept out of the parser because they are the parts with no state — give them a string and a
// position and they answer — and because the link algorithm in `inline.ts` is hard enough to
// read without the bracket counting inlined into it.

import { resolveEntities } from './entity'
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
  // ⚠️ NO CLOSER, NO TAIL — and this line is the difference between linear and quadratic.
  // Every `(` after a label makes the destination scanner walk forward looking for the end of
  // a URL, and the run that FAILS is the one that walks furthest: with no `)` anywhere it goes
  // to the end of the text, for every `[` in the document. MEASURED 2026-09-14: `[a](` repeated
  // 4,000 times is 16 KB and took 161ms, quadrupling on every doubling, so 64 KB was already
  // three seconds of one thread. A tail must end in `)`; if the text holds none from here on,
  // it cannot be one, and that is answerable before any scanning.
  if (!closeParenAtOrAfter(text, from)) return null
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

/**
 * Is there a `)` at or after `from`?
 *
 * ONE ENTRY OF MEMO, because the parser works through one text run at a time and asks this
 * once per `[` in it: computing `lastIndexOf` per question would put the scan back, in a
 * cheaper loop. Correct for the same reason the rules global is (`html.ts`): parsing is wholly
 * synchronous, so there is only ever one text run in flight.
 */
let lastClose = { text: '', at: -1 }

function closeParenAtOrAfter(text: string, from: number): boolean {
  if (lastClose.text !== text) lastClose = { text, at: text.lastIndexOf(')') }
  return lastClose.at >= from
}

function skipWhitespace(text: string, from: number): number {
  let i = from
  while (i < text.length && /[ \t\n]/.test(text[i]!)) i++
  return i
}

/**
 * A URL or a title on its way into the tree: backslash escapes resolved, then entities.
 *
 * THAT ORDER. `\&auml;` is a literal ampersand followed by letters, not the character ä, and
 * resolving entities first would turn the escape's own target into something else.
 */
export function unescapeString(text: string): string {
  return resolveEntities(text.replace(/\\([!-/:-@[-`{-~])/g, '$1'))
}
