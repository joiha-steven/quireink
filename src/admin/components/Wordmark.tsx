// The quireINK logo in the admin rail.
//
// The art comes from `@/brand-art`, the same module the server-rendered sign-in page reads,
// so the two can never drift into being two logos. Outlines rather than live text because
// the admin renders in whatever chrome font the owner picked: as text this would have been a
// different logo per install.
//
// Collapsed shows `Qi`, which is the same logo at the size where the word would be a smear.
// The old rail printed the initials "qb" instead, which was a second mark that existed only
// in the collapsed state and only in this file.

import { MARK_I, MARK_Q, MARK_VIEWBOX, WORD_INK, WORD_QUIRE, WORD_VIEWBOX } from '@/brand-art'

/**
 * Height-driven, both of them: the letterforms have fixed proportions, so setting the height
 * and letting the width follow is the only sizing that cannot distort them.
 */
export function BrandMark({ height = 22 }: { height?: number }) {
  return (
    <svg viewBox={MARK_VIEWBOX} height={height} fill="currentColor" className="w-auto shrink-0" role="img" aria-label="Qi">
      <path d={MARK_Q} />
      <path d={MARK_I} />
    </svg>
  )
}

export function BrandWord({ height = 20 }: { height?: number }) {
  return (
    <svg viewBox={WORD_VIEWBOX} height={height} fill="currentColor" className="w-auto" role="img" aria-label="quireINK">
      <path d={WORD_QUIRE} />
      <path d={WORD_INK} />
    </svg>
  )
}
