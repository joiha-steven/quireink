// Accent-aware matching: the rule that lets one search box answer two kinds of typing.
//
// The FTS5 index folds diacritics (`remove_diacritics 2`, `store/schema.sql`) so that
// somebody typing "lap trinh" with no Vietnamese keyboard still finds "lập trình". Folding
// the QUERY the same way throws away something the person did type. In Vietnamese a tone
// mark is a letter and not a decoration: "lề" (margin), "lệ" (rule), "lê" (pear), "lẻ"
// (odd) and "lễ" (ceremony) are five words. Measured on 2026-09-11: a search for the first
// returned every one of them, with the wrong word highlighted in the passage under the row.
//
// The rule, applied per WORD: a word typed WITHOUT accents matches any accents in the text,
// which is what folding is for. A word typed WITH them means them.
//
// This is not a second index. The folded index still finds the candidates and this narrows
// them afterwards, so there is no migration and nothing to reindex: an accented query reads
// a few more rows and drops the ones that only matched with their accents taken off.
//
// The narrowing asks for a WHOLE word, the same run of letters and digits the tokenizer
// cuts. A substring test was tried first and measured on the live blog on 2026-09-11: it
// left "lê" returning 50 of 50, because "lê" sits inside "lên" and almost every Vietnamese
// post contains that. The exception is the scripts that put no spaces between words — a
// whole-word test would answer "no" to every true hit in Japanese or Chinese, so a word
// written in one of those is matched as a substring instead.
import { foldAccents } from '@/utils'

/** Letter, mark or digit: what a whole word may not be sitting next to. Written as escapes
 *  for the reason `foldAccents` gives — a literal class here is a run of bytes a tool that
 *  guesses the encoding can read as a different range. */
const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u

/** Scripts that run words together, where the boundary rule has nothing to stand on. */
const UNSPACED =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u

/**
 * A text in two lanes whose indices line up with it, so a position found in either lane is
 * a position in the text itself.
 *
 * Both lanes are built PER CHARACTER, not by folding the whole string at once: `foldAccents`
 * decomposes, and a dropped mark shifts every index after it. A character that does not fold
 * to the same number of units is left as its lowercase self, which keeps the lengths equal.
 * `Marked` has painted the right letters this way since it was written; this is that trick
 * with its accented half added.
 */
export type Lanes = {
  /** NFC, unchanged otherwise. This is the string to slice — the lanes are built from it. */
  text: string
  /** Lowercase, accents KEPT. Where an accented word is looked up. */
  lower: string
  /** Lowercase, accents removed. Where an unaccented word is looked up. */
  folded: string
}

export function lanes(input: string): Lanes {
  const text = input.normalize('NFC')
  let lower = ''
  let folded = ''
  for (const c of text) {
    const l = c.toLowerCase()
    const safe = l.length === c.length ? l : c
    const f = foldAccents(c)
    lower += safe
    folded += f.length === c.length ? f : safe
  }
  return { text, lower, folded }
}

/** Did somebody type an accent here? `đ` counts: `foldAccents` turns it into `d`. */
export function isAccented(word: string): boolean {
  const w = word.normalize('NFC')
  return foldAccents(w) !== w.toLowerCase()
}

/**
 * The words of a query that carry accents of their own. Empty means there is nothing to
 * narrow, and every caller reads it that way rather than doing the work anyway.
 *
 * Cut on anything that is not a letter or a digit, which is where `unicode61` cuts too: a
 * check that disagreed with the index about what a word is could only ever be STRICTER than
 * the index, and would then drop rows the index was right about — somebody typing a comma
 * after a word would lose their results.
 */
export function accentedWords(query: string): string[] {
  return query.normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter((w) => w && isAccented(w))
}

/**
 * Where `needle` occurs in `hay`, or -1. An accented needle is matched WITH its accents; an
 * unaccented one is matched against the folded lane, so it still finds accented text.
 *
 * The span is `needle` normalized to NFC — `lanes` keeps lengths, so `lanes(needle).text.length`
 * is how far the match reaches in `hay.text`.
 */
export function indexIn(hay: Lanes, needle: string, from = 0): number {
  return seek(hay, needle, from, false)
}

/**
 * Where `needle` occurs in `hay` as a WHOLE word, or -1. What the narrowing asks, and what
 * a passage should quote: a hit inside a longer word is not the word that was searched for.
 */
export function wordIndexIn(hay: Lanes, needle: string, from = 0): number {
  return seek(hay, needle, from, !UNSPACED.test(needle))
}

function seek(hay: Lanes, needle: string, from: number, whole: boolean): number {
  const n = lanes(needle)
  if (!n.text) return -1
  const accented = isAccented(n.text)
  const lane = accented ? hay.lower : hay.folded
  const probe = accented ? n.lower : n.folded
  for (let at = lane.indexOf(probe, from); at !== -1; at = lane.indexOf(probe, at + 1)) {
    if (!whole) return at
    const before = at === 0 ? '' : hay.folded[at - 1] ?? ''
    const after = hay.folded[at + probe.length] ?? ''
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return at
  }
  return -1
}

/**
 * The narrowing itself: does this text hold the accented words of the query, as typed?
 *
 * `true` when the query has none, so a caller can apply it to every row without asking
 * first. No lanes: a yes/no needs no index, and this runs over whole post bodies.
 */
export function keepsAccents(text: string, query: string): boolean {
  const words = accentedWords(query)
  if (words.length === 0) return true
  const hay = text.normalize('NFC').toLowerCase()
  return words.every((w) => holds(hay, w.normalize('NFC').toLowerCase()))
}

/** `word` stands alone somewhere in the already-lowercased `hay`. */
function holds(hay: string, word: string): boolean {
  const whole = !UNSPACED.test(word)
  for (let at = hay.indexOf(word); at !== -1; at = hay.indexOf(word, at + 1)) {
    if (!whole) return true
    const before = at === 0 ? '' : hay[at - 1] ?? ''
    const after = hay[at + word.length] ?? ''
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return true
  }
  return false
}
