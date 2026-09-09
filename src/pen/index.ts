// The pen: one module, one door.
//
// Everything a reader sees drawn by hand on a page comes from this directory — the
// highlighter (`==text==`), the underline (`++text++`), the ring (`@@word@@`) and the dashes
// under a link — and the directory is self-contained ON PURPOSE. Nothing in it imports from
// the rest of the application (`boundary.test.ts` holds the line); the application reaches
// in through this file. That is what makes the pen liftable: the WordPress theme, the
// marketing site and an embeddable `pen.css` can each take the whole hand without taking the
// blog around it.
//
// The layers, bottom up:
//
//   grammar.ts   the three fences as one regex each, and the hash that deals a stroke its
//                variant. Import-free, so four parsers can be built from it without drift.
//   marked.ts    the server's parser, as `marked` inline extensions. The editor's TipTap
//                marks (`admin/components/InkMark.ts`, `PenMarks.ts`) are the other reader.
//   dies.ts      the hand: every stroke shape, grown from one seed. `dies-link.ts` grows the
//                link's dashes from a seed of its own.
//   pigments.ts  the five measured inks and the pencil and ballpoint, and the data-URI that
//                stamps a die in a colour.
//   derive.ts    one chosen colour becoming the four the pen needs.
//   palette.ts   the owner's overrides resolved against the built-ins, and the signature
//                that says whether anything was chosen at all.
//   ink.css.ts   the two sheets and the link rule, in whichever inks a site writes with.
//   lists.css.ts the marks at the head of a list item — dots, dashes, numerals — and the
//                off path that gives the browser's back (`dies-lists.ts` grows them).
//
// The contract with the page is three elements and two sheets: `<mark data-pen>` (with
// `data-ink` for a colour and `data-form="o"` for a ring), `<u data-pen>`, and the CSS that
// paints them. Cached bodies carry only the markup, so the hand can change without a single
// body re-rendering (ADR 0018, 0025, 0026).

export {
  INKS, DEFAULT_INK, isInk, inkOf, penSeed,
  INK_SYNTAX_SOURCE, INK_SYNTAX_CONTENT_LAST, INK_SYNTAX_GLOBAL,
  UNDER_SYNTAX_SOURCE, UNDER_SYNTAX_CONTENT_LAST, UNDER_SYNTAX_GLOBAL,
  RING_SYNTAX_SOURCE, RING_SYNTAX_CONTENT_LAST, RING_SYNTAX_GLOBAL,
} from '@/pen/grammar'
export type { Ink } from '@/pen/grammar'
export { inkExtension, underExtension, ringExtension } from '@/pen/marked'
export {
  PEN_LIGHT, PEN_DARK, PEN_AUX_LIGHT, PEN_AUX_DARK, PEN_LINE_LIGHT, PEN_LINE_DARK,
  penStroke, penStrokeFlat, penUnder, penRing, penDash, penSolidRule,
  PEN_DIE_COUNT, PEN_VARIANT_COUNT, PEN_GRIPS,
  UNDER_DIE_COUNT, UNDER_GRIPS, RING_DIE_COUNT, RING_GRIPS,
} from '@/pen/pigments'
export type { PenInk } from '@/pen/pigments'
export { contrastRatio, darkStroke, lineInk, parseHex } from '@/pen/derive'
export { BUILT_IN_INKS, DEFAULT_INKS, inkSignature, resolveInks } from '@/pen/palette'
export type { InkPalette, InkSettings } from '@/pen/palette'
export {
  inkHighlightCss, inkLinesCss, INK_HIGHLIGHT_CSS, INK_LINES_CSS, INK_CSS, LINK_INK_CSS,
} from '@/pen/ink.css'
export { LISTS_INK_CSS, LISTS_PLAIN_CSS } from '@/pen/lists.css'
export { DOT_MASKS, DASH_MASKS, NUMERAL_LEANS } from '@/pen/dies-lists'
