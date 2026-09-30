// An author's straight quotes, curled on the page in the piece's own language (2026-09-30).
//
// A keyboard types `"` and `'`, and a page set in Literata printed them as typed: two
// typewriter ticks beside the curly marks every word of the interface around the piece is
// held to (`scripts/checks/i18n-typography.ts`). Now `"word"` reads “word” in English,
// „word“ in German, « word » in French and 「word」 in Japanese, and `it's` reads it’s.
//
// ⚠️ ON THE PAGE, NOT IN THE MARKDOWN. What the author typed is what is stored, what the editor
// shows and what an export hands back: nothing to undo, nothing to fight when they paste code
// into a paragraph. It runs where the callout labels get their language, after the body cache,
// so the cache stays language-blind and the golden corpus (Markdown → HTML) is untouched.
//
// ⚠️ THE READER'S MARKS WERE THE COST, and `pen-anchor.ts` pays it. A mark is stored as the
// words it covers; a mark drawn over `it's` before this change would look for `it's` on a
// page that now says `it’s`. `locate` folds both kinds of quote to one before comparing, so
// old marks land and new ones would still land if this were ever switched off.
//
// Code is left alone — `<code>`, `<pre>`, `<kbd>`, `<samp>`, maths — because a quote in code is
// syntax, and `"x"` curled is a program that no longer runs.
import type { SiteLang } from '@/types'
import { innerQuotesOf, quotesOf } from '@/i18n/quotes'

const SKIP = new Set(['code', 'pre', 'kbd', 'samp', 'math', 'script', 'style', 'svg', 'textarea'])

/** Whatever may stand before an OPENING quote: nothing, a space, a bracket, a dash, a slash. */
const OPENS_AFTER = /[\s([{<>\u2014\u2013/\u00a0-]/

/** A quotation's pair plus its padding: French sets a thin no-break space inside guillemets. */
function pairFor(lang: SiteLang): [string, string] {
  const [open, close] = quotesOf(lang)
  return lang === 'fr' ? [`${open}\u202f`, `\u202f${close}`] : [open, close]
}

/** What an escaped character stands for, as far as deciding the next quote goes. */
const ENTITY: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&nbsp;': '\u00a0' }

/**
 * What the reader has seen so far in this block: the last character, and which quotations are
 * open. It crosses tags — `"*word*"` is one quotation in three runs of text — and starts again
 * at every paragraph, item and cell.
 *
 * `inner` because the closing half of 'word' is otherwise indistinguishable from the apostrophe
 * in word's. `outer` because Japanese and Chinese put no space before a quotation: `彼は"はい"`
 * has a letter on both sides of both marks, and only knowing that none is open yet says the
 * first one opens.
 */
type Seen = { prev: string; outer: boolean; inner: boolean }

const fresh = (): Seen => ({ prev: '', outer: false, inner: false })

const ENTITY_AT = /&(?:#\d+|#x[\da-f]+|\w+);/iy

/** One run of text, carrying `seen` forward. */
function curlText(text: string, seen: Seen, lang: SiteLang): string {
  const [open, close] = pairFor(lang)
  const [inOpen, inClose] = innerQuotesOf(lang)
  let out = ''
  let { prev, inner, outer } = seen
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '&') {
      // An escaped character is one character to the reader, and the quote after `&gt;` is
      // after a `>`, not after a semicolon. Sticky, so a run with many `&` does not copy the
      // rest of the text at each one.
      ENTITY_AT.lastIndex = i
      const ent = ENTITY_AT.exec(text)
      if (ent) {
        out += ent[0]
        prev = ENTITY[ent[0]] ?? 'x'
        i += ent[0].length - 1
        continue
      }
    }
    if (c !== '"' && c !== "'") {
      out += c
      prev = c
      continue
    }
    const opening = prev === '' || OPENS_AFTER.test(prev)
    if (c === '"') {
      const opens = opening || (!outer && /\S/.test(text[i + 1] ?? ''))
      out += opens ? open : close
      outer = opens
    } else if (c === "'") {
      const next = text[i + 1] ?? ''
      if (opening) {
        // At the start of a word before a digit it is an elision (’90s); otherwise it opens.
        if (/\d/.test(next)) out += '’'
        else { out += inOpen; inner = true }
      } else if (inner && !/[\p{L}\p{N}]/u.test(next)) {
        out += inClose
        inner = false
      } else {
        // A contraction or a possessive: every language spells it ’.
        out += '’'
      }
    }
    prev = c
  }
  Object.assign(seen, { prev, inner, outer })
  return out
}

/** The piece's HTML with the quotes in its running text curled for `lang`. */
export function curlyQuotes(html: string, lang: SiteLang): string {
  let depth = 0
  let seen = fresh()
  return html.split(/(<[^>]*>)/).map((part) => {
    if (part.startsWith('<')) {
      const m = /^<(\/?)([a-zA-Z][\w-]*)/.exec(part)
      if (m && SKIP.has(m[2]!.toLowerCase()) && !part.endsWith('/>')) depth += m[1] ? -1 : 1
      if (depth < 0) depth = 0
      // A block boundary is a fresh start: a quote opening a paragraph opens.
      if (m && /^(p|li|h[1-6]|td|th|blockquote|div|figcaption|dt|dd|br)$/i.test(m[2]!)) seen = fresh()
      return part
    }
    if (depth > 0 || part === '') return part
    const text = part.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    // No quote in it: nothing to curl, and only the last character to carry forward.
    if (!/["']/.test(text)) {
      seen.prev = text.at(-1) ?? seen.prev
      return part
    }
    const curled = curlText(text, seen, lang)
    return curled.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }).join('')
}
