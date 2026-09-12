// Finding a run of text in a string, and nothing else.
//
// ITS OWN FILE, with no Tiptap and no React in it, for the reason `editorLinkKey.ts` was
// split out: the shortcut TABLE is read by the rail's search button, so anything sitting
// beside it is parsed on the dashboard, on Settings, on every screen with no editor in it.
// This module is imported by the writing surface AND by the Markdown source view, which share
// nothing else — the first searches a ProseMirror document, the second a textarea — so the
// one thing they do agree on is what counts as a match.
//
// PLAIN TEXT, NEVER A REGULAR EXPRESSION. A writer looking for `(` or `.` or `$1.00` is
// looking for those characters. Offering regular expressions here would mean every ordinary
// query is also a pattern that can be wrong in a way the writer cannot see, and the first
// time it bites is a Replace all across a finished piece.

/** A match, as offsets into the string that was searched. `to` is exclusive. */
export type Hit = { from: number; to: number }

export type FindOptions = {
  /** Off by default: somebody searching `paris` means the city as often as not. */
  caseSensitive: boolean
}

/**
 * Every non-overlapping occurrence of `needle`, left to right.
 *
 * NON-OVERLAPPING, and it is the only sane answer for a box with a Replace beside it:
 * searching `aa` in `aaaa` finds two, because replacing four overlapping matches is not a
 * thing that can be done. Stepping through them agrees with what Replace all will do, which
 * is the property that stops Replace all being a surprise.
 *
 * Case folding is `toLowerCase` on both sides rather than a locale-aware compare: it has to
 * agree EXACTLY with what `String.indexOf` will then find, and a fold that changes a string's
 * length would move every offset after it. Turkish dotless ı and the German ß both survive
 * `toLowerCase` at the same length; a full locale fold does not promise that.
 */
export function findAll(haystack: string, needle: string, opts: FindOptions): Hit[] {
  if (!needle) return []
  const hay = opts.caseSensitive ? haystack : haystack.toLowerCase()
  const pin = opts.caseSensitive ? needle : needle.toLowerCase()
  const hits: Hit[] = []
  let at = hay.indexOf(pin)
  while (at !== -1) {
    hits.push({ from: at, to: at + pin.length })
    at = hay.indexOf(pin, at + pin.length)
  }
  return hits
}

/**
 * The hit a writer should land on after pressing next (or previous) from `index`.
 *
 * WRAPS, both ways, because the alternative is a button that stops working near the end of
 * the piece and says nothing about why. Returns 0 for an empty list so callers never carry a
 * -1 into a lookup.
 */
export function step(count: number, index: number, by: 1 | -1): number {
  if (count <= 0) return 0
  return (index + by + count) % count
}

/**
 * The hit nearest AFTER a cursor position, so opening the panel starts where the writer is.
 *
 * Landing on the first hit in the document instead is the behaviour that makes a find box
 * feel like it is searching some other copy of the piece: the writer is three screens down,
 * presses the chord, and the view jumps to the top.
 */
export function firstAfter(hits: Hit[], cursor: number): number {
  const found = hits.findIndex((h) => h.from >= cursor)
  return found === -1 ? 0 : found
}

/**
 * The whole string with every hit replaced — for the Markdown view, which owns a plain string.
 *
 * Built by walking the hits rather than by `String.replaceAll`, for two reasons that both
 * matter here: `replaceAll` on a string needle cannot be told to respect case, and a
 * replacement containing `$&` or `$1` is read by it as a substitution pattern. A writer
 * replacing a price with `$5` should get `$5`.
 */
export function replaceAllIn(haystack: string, hits: Hit[], replacement: string): string {
  let out = ''
  let at = 0
  for (const hit of hits) {
    out += haystack.slice(at, hit.from) + replacement
    at = hit.to
  }
  return out + haystack.slice(at)
}

/**
 * How many hits may be drawn at once.
 *
 * Beyond this only the current one is marked, and the count still says how many there are. A
 * one-letter query in a long piece is thousands of decorations, each one a separate inline
 * range ProseMirror has to map through every keystroke; the writer cannot use thousands of
 * highlights anyway, and the one they are standing on is the one they are looking at.
 */
export const MAX_HIGHLIGHT = 1000
