// WHO WINS ON A PUBLIC PAGE: the base sheet, then the theme, then the owner's settings, then the
// owner's custom CSS, whatever the selectors weigh (ADR 0072, decision 3).
//
// Before this the order was document order and specificity, nothing else. Every rule in a
// built-in theme's sheet hangs off `html[data-look=…]`, which is (0,1,1) heavier than a bare class,
// so `.post-meta{letter-spacing:.3em}` in the Custom CSS box lost to the newspaper's
// `html[data-look=paper] .post-meta` although it came last. A theme installed from a zip would do
// the same to every blog that wears it.
//
// Cascade layers settle it: a declaration in a later layer beats one in an earlier layer whatever
// the specificity, and an UNLAYERED declaration beats every layer. So the two linked sheets are
// wrapped as they are served (`web/assets.ts`: the base sheet in `base`, the theme's in `theme`),
// and the inline block stays unlayered, with the custom CSS last in it. The inline pieces that
// belong to a sheet are wrapped where they stand: the geometry (the reading column, a moved
// column's rail, the page's own `extra`) in `base`; the theme's rail rules, the notebook's
// deepened meta ink and the chrome font's tracking correction, which themes refine weight against
// weight, in `theme` (`web/layout-styles.ts`, `web/layout.ts`). Nothing is reordered, so inside
// one tier it is specificity, then order, as before.
//
// Between tiers the winner changes only where a lower tier outweighed a higher one. A probe run
// in the browser over the theme matrix, an untitled post, book mode at every width, a touch
// screen, print and the whole seeded sitemap (every rule, every element, hover and focus counted
// as on, a logical property counted as its physical twin; `docs/conventions/looks.md`) found six
// base rules that outweighed a built-in theme's; each keeps that weight through a `revert-layer` line in the theme layer (`HOLDS`
// below). Two more were the page's geometry: unlayered, it beat the code theme's rail marker; in
// `base` alone, the front page's `:root{--shell-w}` lost to the column setting. Hence the column
// setting sits in `base` too. And one was the chrome font's tracking: unlayered, it beat the
// notebook's own tracking of the site title, hence `theme`.
//
// The settings are unlayered too, rather than in a third layer of their own, and that is on
// purpose: between the settings and the custom CSS nothing moves. Some settings rules are heavier
// than what an owner usually writes (the system-dark palette on `:root:not([data-scheme])`, the
// pen toggles on `.prose u[data-pen]`, the selection ink on `html.dark ::selection`), and in a
// layer of their own they would all start losing to custom CSS that never beat them before,
// on blogs whose pages nobody has touched. Unlayered, the custom CSS still comes last and wins
// every tie, as it always has, and both still beat every layer. (The chrome font's tracking
// correction is the one setting-made rule in `theme`, so custom CSS now beats it outright.)
//
// THE PEN is unlayered too: the reader's pen links its two sheets in front of the first <style>
// (`assets/js/reader-pen.ts`), so a layer here would have to be stamped into the served pen sheets
// as well, and the ink competes with the settings and the custom CSS exactly as it did.
//
// Browser floor: the public page's real minimum is now Chrome and Edge 99, Safari 15.4, Firefox 97
// (early 2022), for `@layer` and `revert-layer`. An older browser drops every `@layer` block, which
// is the whole base and theme sheet, and draws the page unstyled. The palette already needed
// `color-mix()` (Chrome 111, Safari 16.2, Firefox 113) to look right, and the admin sheet already
// ships `@layer utilities`, so no reader who saw the page correctly before loses it.
//
// The base sheet's `!important` declarations are NOT in the base layer: `!important` runs the
// layers backwards, so there they would beat the owner's `!important`. They are served after the
// layers, outside every one (`web/css-important.ts`), and weigh what they did before.

import { DEFAULT_RAIL_WIDTH, railHoldCss } from '@/render/rail-css'

/** The two layers a public page has, in the order they lose in. */
export type CssLayer = 'base' | 'theme'

/**
 * Stated at the very head of the base sheet, the first stylesheet a public page links, so the
 * order is fixed before any layer block is met: a theme sheet swapped in by a script (the demo
 * does) or an inline block naming `theme` cannot reorder it.
 */
export const LAYER_ORDER = '@layer base,theme;'

/** `css` inside `layer`, or '' for nothing, so an empty block never reaches a page. */
export function inLayer(layer: CssLayer, css: string): string {
  return css ? `@layer ${layer}{${css}}` : ''
}

/**
 * BASE RULES THAT KEEP THE WEIGHT THEY HAD AGAINST A THEME.
 *
 * Each line restates one base rule's selector in the THEME layer with every property it sets as
 * `revert-layer`, and the base sheet carries them after its own block, so they come before any
 * theme's sheet. Against a theme rule that is lighter, the line wins inside the layer and hands
 * the property back to the base, as the base rule's weight did before the layers; against one as
 * heavy or heavier, the theme's rule comes later or weighs more and wins, as it did. On plain they
 * revert to the base and do nothing.
 *
 * Only the rules where a built-in theme was measured to lose to the base (the probe above), each
 * with the place the base rule lives. One more is computed from the column: `railHoldCss`.
 */
const HOLDS = [
  // book.css.ts, the comment thread's heading: the newspaper sets every h1 to h3 lighter.
  '#comments h2{font-size:revert-layer;line-height:revert-layer;letter-spacing:revert-layer;'
    + 'color:revert-layer;font-weight:revert-layer;margin:revert-layer}',
  // book-text.css.ts, the book's headings on its line grid: the newspaper's leading and the
  // newspaper's and the notebook's rule under a section head would break it. The padding is set
  // only where the browser has round(), so its hold is too; the scrolled phone reader sets it always.
  '.book-overlay .book-flow.prose > :is(h1,h2,h3,h4,h5){line-height:revert-layer}',
  '@supports (line-height:round(nearest,1px,1px)){'
    + '.book-overlay .book-flow.prose > :is(h2,h3,h4,h5){padding-block:revert-layer}}',
  '.book-reader .book-flow.prose > :is(h1,h2,h3,h4,h5){padding-block:revert-layer}',
  // front.css.ts, the text-only front page's lead headline: the code theme tracks headings tighter.
  '.front-text .fc-lead .fc-title{font-size:revert-layer;line-height:revert-layer;letter-spacing:revert-layer}',
  // chips.css.ts, pressing the current chip: the notebook's slips carry a shadow of their own.
  '.chips .chip[aria-current]:active{box-shadow:revert-layer}',
].join('')

/** What the base sheet carries in the theme layer, after its own block. */
export const BASE_HOLDS_CSS = HOLDS + railHoldCss(DEFAULT_RAIL_WIDTH, { scoped: true })
