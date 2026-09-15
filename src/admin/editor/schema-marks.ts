// THE EIGHT MARKS, written out, because this product owns its own schema now (ADR 0054 step 7).
//
// Every one of these came from a package until 2026-09-15: five from `@tiptap/starter-kit` and
// three from this repo's own extensions, which had to be expressed as Tiptap `Mark.create` calls
// to sit beside them. A `MarkSpec` is the thing ProseMirror actually wants, and it is shorter
// than the wrapper that produced it.
//
// ⚠️ THE ORDER IN THIS FILE IS THE NESTING ORDER, and it is not cosmetic. ProseMirror ranks
// marks by their position in the schema's map and `Mark.sort()` uses that rank, so the order
// here decides whether the serializer writes `==**bold**==` or `**==bold==**` for the same
// document. It is the order the previous schema ended up with — link, bold, code, italic,
// strike, underline, ink, ring — which Tiptap arrived at by sorting on a `priority` number
// spread across eight files. One list is the same answer, written where it can be read.
import type { MarkSpec } from 'prosemirror-model'
import { DEFAULT_INK, isInk } from '@/pen/grammar'

/** DOM attributes with the empty ones dropped, which is what every `toDOM` below wants. */
export const attrs = (pairs: Record<string, string | null | undefined>): Record<string, string> =>
  Object.fromEntries(Object.entries(pairs).filter(([, v]) => v != null && v !== '')) as Record<string, string>

const link: MarkSpec = {
  attrs: {
    href: { default: null },
    target: { default: '_blank' },
    rel: { default: 'noopener noreferrer nofollow' },
    class: { default: null },
    title: { default: null },
  },
  // ⚠️ INCLUSIVE, AND THAT IS PARITY RATHER THAN A CHOICE. Typing immediately after a linked
  // word puts the new characters INSIDE the link — measured on the outgoing build, 2026-09-15:
  // a `Z` typed at the end of `[word](…)` makes the link text `wordZ`. It reads like a fault
  // and it probably is one, but it is not this step's to change: step 7 moves which layer the
  // editor stands on and keeps what it does, and this one changes what happens to text a
  // writer has already typed. One word here flips it, once somebody decides.
  inclusive: true,
  parseDOM: [{
    tag: 'a[href]',
    getAttrs: (dom) => {
      const el = dom as HTMLElement
      const href = el.getAttribute('href')
      // A `javascript:` URL in pasted HTML is the one thing a link mark must never carry.
      // The serializer would write it back into the Markdown and the reader's page would
      // publish it — `md/` escapes nothing about a URL, because a URL is not text.
      if (!href || /^\s*javascript:/i.test(href)) return false
      return { href, title: el.getAttribute('title'), class: el.getAttribute('class') }
    },
  }],
  toDOM: (mark) => ['a', attrs({
    href: mark.attrs.href as string | null,
    target: mark.attrs.target as string | null,
    rel: mark.attrs.rel as string | null,
    class: mark.attrs.class as string | null,
    title: mark.attrs.title as string | null,
  }), 0],
}

const bold: MarkSpec = {
  parseDOM: [
    { tag: 'strong' },
    // `<b>` is bold unless the browser wrote it as part of a paste from a word processor,
    // where `font-weight: normal` on a `<b>` is how Google Docs marks something NOT bold.
    { tag: 'b', getAttrs: (dom) => (dom as HTMLElement).style.fontWeight !== 'normal' && null },
    { style: 'font-weight=400', clearMark: (m) => m.type.name === 'bold' },
    { style: 'font-weight', getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null },
  ],
  toDOM: () => ['strong', 0],
}

// ⚠️ `excludes` IS NARROWER THAN IT WAS, and that is a fix rather than a liberty.
//
// StarterKit's `code` is `excludes: '_'` — it refuses to share a character with ANY other mark
// — and `InkMark.ts` carried a paragraph explaining that a highlight running across an inline
// code span could not be held by the editor because of it, and could not be changed from
// outside: "the fix is a direct dependency on `@tiptap/extension-code` plus a forked mark".
// The mark is written here now, so the fix is a list instead of an underscore.
//
// The server has always rendered ``==a `b` c==`` as one unbroken stroke. Opening and saving
// used to end the stroke before the code, which is a save that changes the reader's page — the
// one thing `editor-corpus.test.ts`'s second law exists to forbid.
//
// ⚠️ `_` IS NOT A LIST YOU CAN SUBTRACT FROM. It is ProseMirror's word for "every mark", and
// `'_ ink'` still means every mark — the first term already said all of them. So the marks this
// one excludes are NAMED, and the three pen gestures are the omission. `schema-agreement.test.ts`
// walks every mark in the schema and asserts which side of that line it falls on, so a ninth
// mark added later cannot quietly become legal inside a code span.
const code: MarkSpec = {
  excludes: 'code bold italic strike link',
  code: true,
  parseDOM: [{ tag: 'code' }],
  toDOM: () => ['code', 0],
}

const italic: MarkSpec = {
  parseDOM: [
    { tag: 'em' },
    { tag: 'i', getAttrs: (dom) => (dom as HTMLElement).style.fontStyle !== 'normal' && null },
    { style: 'font-style=normal', clearMark: (m) => m.type.name === 'italic' },
    { style: 'font-style=italic' },
  ],
  toDOM: () => ['em', 0],
}

const strike: MarkSpec = {
  parseDOM: [
    { tag: 's' },
    { tag: 'del' },
    { tag: 'strike' },
    { style: 'text-decoration', getAttrs: (value) => ((value as string) === 'line-through' ? null : false) },
  ],
  toDOM: () => ['s', 0],
}

/**
 * The pencil: `++text++`.
 *
 * ⚠️ IT REPLACES StarterKit's `underline`, and the replacement is the bug fix that made it
 * worth writing. That one had no Markdown serialization at all: pressing U applied a mark the
 * writer could see and the save then dropped, silently. This one is the same name, the same
 * `Mod-u`, and a gesture the file keeps.
 */
const underline: MarkSpec = {
  excludes: 'underline',
  attrs: { ink: { default: '' } },
  parseDOM: [{
    tag: 'u',
    getAttrs: (dom) => {
      const v = (dom as HTMLElement).getAttribute('data-ink')
      return { ink: isInk(v) ? v : '' }
    },
  }],
  toDOM: (mark) => ['u', attrs({ 'data-ink': mark.attrs.ink as string }), 0],
}

/**
 * The highlighter: `==text==`, optionally `==text==#pink`.
 *
 * Renders as the SAME `<mark data-ink="…">` the published page uses, so `pen/ink.css.ts` styles
 * the writing surface and the reader's page from one place. Yellow writes no attribute, because
 * a bare `<mark>` MEANS yellow — the rule the server renderer follows, and what keeps the two
 * outputs identical rather than merely similar.
 */
const ink: MarkSpec = {
  // Two inks cannot both apply to one character, and the second replaces the first rather than
  // nesting inside it.
  excludes: 'ink',
  attrs: { ink: { default: DEFAULT_INK } },
  parseDOM: [{
    // `:not([data-form])`, so a ring never parses as a highlight.
    tag: 'mark:not([data-form])',
    getAttrs: (dom) => {
      const v = (dom as HTMLElement).getAttribute('data-ink')
      return { ink: isInk(v) ? v : DEFAULT_INK }
    },
  }],
  toDOM: (mark) => {
    const v = mark.attrs.ink as string
    return ['mark', attrs({ 'data-ink': v && v !== DEFAULT_INK ? v : null }), 0]
  },
}

/** The ballpoint ring: `@@word@@`. Its own `data-form`, so the ink rule above refuses it. */
const ring: MarkSpec = {
  excludes: 'ring',
  attrs: { ink: { default: '' } },
  parseDOM: [{
    tag: 'mark[data-form="o"]',
    // Above the ink rule's own, so a ring is never taken for a highlight on the way in.
    priority: 60,
    getAttrs: (dom) => {
      const v = (dom as HTMLElement).getAttribute('data-ink')
      return { ink: isInk(v) ? v : '' }
    },
  }],
  toDOM: (mark) => ['mark', attrs({ 'data-form': 'o', 'data-ink': mark.attrs.ink as string }), 0],
}

/** In rank order. See the warning at the top of this file: the order is the nesting order. */
export const MARKS: Record<string, MarkSpec> = {
  link, bold, code, italic, strike, underline, ink, ring,
}
