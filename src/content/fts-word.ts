// One typed word as FTS5 query text, with the one fold the index cannot make.
//
// `remove_diacritics 2` folds every Vietnamese tone and vowel mark, so "lap trinh" finds "lập
// trình". It does not fold `đ`: U+0111 is a letter of its own, not `d` with a mark, so the index
// holds "đường" as `đuong` and "duong" never found it — every word with a đ in it was out of reach
// of an unaccented query, in the reader's search and in the owner's (2026-11-03).
//
// THE QUERY ASKS FOR BOTH, rather than the index storing `d`. In Vietnamese a đ only ever opens a
// syllable, so each token of the word that starts with a `d` is asked for with a `đ` as well:
// "duong" → `"duong" OR "đuong"`. Folding in the index instead would mean triggers that differ
// from the ones every backup carries in its schema, and an external-content `rebuild` that reads
// the table and not the trigger; this needs neither a migration nor a second way of indexing.
// A word typed WITH the stroke is left as typed, and `accent.ts` holds it to it.
//
// Quoted, always: an apostrophe, a `-`, a stray `"` or a bare `OR` is FTS5 operator syntax, and an
// unquoted one throws rather than finding nothing.

/** At most this many tokens of one word are asked for both ways: 2^3 phrases. */
const MAX_FORKS = 3

const phrase = (word: string): string => `"${word.replaceAll('"', '""')}"`

/** Offsets of the tokens inside `word` that begin with d or D. */
function dStarts(word: string): number[] {
  const out: number[] = []
  for (let i = 0; i < word.length && out.length < MAX_FORKS; i++) {
    const c = word[i]!
    if ((c === 'd' || c === 'D') && (i === 0 || !/[\p{L}\p{N}]/u.test(word[i - 1]!))) out.push(i)
  }
  return out
}

export function ftsWord(word: string): string {
  const at = dStarts(word)
  if (at.length === 0) return phrase(word)
  const forms: string[] = []
  for (let mask = 0; mask < 1 << at.length; mask++) {
    // By UTF-16 unit, as `dStarts` counts: only d's are replaced, so a pair split here is joined
    // back whole.
    const units = word.split('')
    at.forEach((pos, bit) => { if (mask & (1 << bit)) units[pos] = 'đ' })
    forms.push(phrase(units.join('')))
  }
  return `(${forms.join(' OR ')})`
}
