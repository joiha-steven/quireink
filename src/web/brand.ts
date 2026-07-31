// The quireINK mark, for the server-rendered pages.
//
// The sign-in screens carry the SOFTWARE's identity, not the blog's. That is a reversal of
// what 06-auth.md originally specified ("the site's own masthead"), decided by the owner
// after seeing the page: a reader never reaches /login, so the only person it speaks to is
// the one signing in to Quire Ink, and every install should show them the same door.
//
// Both halves are inline SVG rather than files: they must inherit `currentColor` so they
// survive a palette change and dark mode, and a logo that arrives on its own request can
// arrive late — on the one page where "did this load?" is a security question. The word is
// OUTLINES for the same reason plus one more: it is set in Literata and JetBrains Mono, and
// neither is guaranteed to be declared on a page whose owner chose different fonts.
//
// The symbol is what the word means: a quire is a gathering of folded sheets. Two leaves and
// the fold between them, drawn in the same stroke idiom as the rest of the icon set
// (24-grid geometry, `fill=none`, round joins), so it sits beside them without looking
// borrowed. The art itself lives in `@/brand-art`, which the admin shares.

import { MARK_PATHS, MARK_VIEWBOX, WORD_INK, WORD_QUIRE, WORD_VIEWBOX } from '@/brand-art'

/** The symbol alone, at `size` px. Inherits colour from its parent. */
export function quireMark(size = 34): string {
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="${MARK_VIEWBOX}" fill="none" `
    + `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" `
    + `aria-hidden="true" focusable="false">`
    + MARK_PATHS.map((d) => `<path d="${d}"/>`).join('')
    + `</svg>`
}

/**
 * The word alone: `quire` in Literata, `INK` in JetBrains Mono.
 *
 * Height-driven rather than width-driven. The two runs have fixed proportions, so setting
 * the height and letting the width follow is the only sizing that cannot distort them, and
 * it is also how the mark beside it is sized.
 */
export function quireWord(height = 26): string {
  return `<svg class="brand-word" height="${height}" viewBox="${WORD_VIEWBOX}" `
    + `fill="currentColor" role="img" aria-label="quireINK">`
    + `<path d="${WORD_QUIRE}"/><path d="${WORD_INK}"/></svg>`
}

/**
 * Symbol plus word, as one block.
 *
 * Not a link. The sign-in page has exactly one thing to do, and a logo that navigates away
 * from it is a way to lose your place; the way back to the site is a plain link at the
 * bottom, where leaving belongs.
 */
export function quireLockup(): string {
  return `<div class="brand">${quireMark()}${quireWord()}</div>`
}
