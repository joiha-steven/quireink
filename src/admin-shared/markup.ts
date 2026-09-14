// ONE DESCRIPTION OF A PIECE OF MARKUP, for the two places that have to draw it.
//
// ADR 0054's screens are drawn twice by definition: the server sends the page, and the
// island adds to it afterwards. For most screens that is fine, because the island only ever
// toggles attributes on markup the server already wrote. The assistant is the first screen
// where it is not: an answer streams in after the page has loaded, so the island has to
// BUILD an exchange that looks exactly like the ones the server drew above it.
//
// Written twice, those two would drift — one class added on the server, a `<p>` that became
// a `<div>` in the island, and the transcript reads as two different screens depending on
// whether you reloaded. So the SHAPE is written once, as data, and the two renderers are
// each about twenty dumb lines: `htmlOf` on the server (escaping into a string) and `elOf`
// in the island (real nodes, text set as text). Neither can inject markup, because neither
// is ever handed any: they are given a tree that already says what every element is.
//
// No imports, deliberately. This module is read by the server, by the browser and by the
// tests, so it may not reach for `@/utils` (which pulls the pen grammar and the maths
// syntax behind it) or for anything that knows what a DOM is.

/**
 * One element, or one piece of text.
 *
 * `tag: ''` is a bare text node — that is how a sentence with two bold words in it stays one
 * flow rather than becoming three wrapped spans. An element carries `text` OR `kids`, never
 * both: nothing in this admin needs an element that is half prose and half children, and
 * forbidding it means each renderer has exactly two cases to get right.
 */
export type Mark = {
  tag: string
  cls?: string
  attrs?: Record<string, string>
  text?: string
  kids?: Mark[]
}

/** A bare text node. */
export const txt = (text: string): Mark => ({ tag: '', text })

/** An element with children. */
export const el = (tag: string, cls: string, kids: Mark[], attrs?: Record<string, string>): Mark =>
  attrs ? { tag, cls, kids, attrs } : { tag, cls, kids }

/** An element whose whole content is one run of text. */
export const leaf = (tag: string, cls: string, text: string, attrs?: Record<string, string>): Mark =>
  attrs ? { tag, cls, text, attrs } : { tag, cls, text }

/**
 * Elements that close themselves.
 *
 * Only the ones this admin's server actually emits. A tag that is not here is written with a
 * closing tag, which is what `<div>`, `<span>`, `<p>` and the rest want.
 */
export const VOID_TAGS = new Set(['br', 'hr', 'img', 'input'])
