// The quireINK logo, for the server-rendered pages.
//
// The sign-in screens carry the SOFTWARE's identity, not the blog's. That is a reversal of
// what 06-auth.md originally specified ("the site's own masthead"), decided by the owner
// after seeing the page: a reader never reaches /login, so the only person it speaks to is
// the one signing in to Quire Ink, and every install should show them the same door.
//
// ONE logo in two sizes, not a symbol plus a word: `Qi` where a five-letter word would be a
// smear (the app icon, the favicon, the collapsed rail), `quireINK` everywhere else. An
// abstract symbol used to sit beside the word here, and once the compact mark became the
// word's own initials, showing both read as a stutter.
//
// Inline SVG rather than a file: it must inherit `currentColor` so it survives a palette
// change and dark mode, and a logo that arrives on its own request can arrive late, on the
// one page where "did this load?" is a security question. OUTLINES rather than live text
// for the same reason plus two more: the admin renders in whatever chrome font the owner
// picked, and `pageStyles` declares only the owner's own faces, so a logo may not assume
// any given family is even present. The art lives in `@/brand-art`, which the admin shares.

import { MARK_I, MARK_Q, MARK_VIEWBOX, WORD_INK, WORD_QUIRE, WORD_VIEWBOX } from '@/brand-art'

/**
 * `Qi`, at `size` px tall.
 *
 * Height-driven rather than width-driven, like the word: the letterforms have fixed
 * proportions, so setting the height and letting the width follow is the only sizing that
 * cannot distort them.
 */
export function quireMark(size = 30): string {
  return `<svg class="brand-mark" height="${size}" viewBox="${MARK_VIEWBOX}" `
    + `fill="currentColor" role="img" aria-label="Qi">`
    + `<path d="${MARK_Q}"/><path d="${MARK_I}"/></svg>`
}

/** The word: `quire` in Inter, `INK` in JetBrains Mono. */
export function quireWord(height = 26): string {
  return `<svg class="brand-word" height="${height}" viewBox="${WORD_VIEWBOX}" `
    + `fill="currentColor" role="img" aria-label="quireINK">`
    + `<path d="${WORD_QUIRE}"/><path d="${WORD_INK}"/></svg>`
}

/**
 * The sign-in masthead.
 *
 * Not a link. The sign-in page has exactly one thing to do, and a logo that navigates away
 * from it is a way to lose your place; the way back to the site is a plain link at the
 * bottom, where leaving belongs.
 */
export function quireLockup(): string {
  return `<div class="brand">${quireWord(30)}</div>`
}
