// The quireINK mark in the admin rail.
//
// The art comes from `@/brand-art`, the same module the server-rendered sign-in page reads,
// so the two can never drift into being two logos. Outlines rather than live text because
// the wordmark is set in Literata and JetBrains Mono, and the admin renders in whatever
// chrome font the owner picked: as text it would have been a different logo per install.
//
// Collapsed shows the symbol alone. The old rail printed the initials "qb" instead, which
// was a second mark that existed only in the collapsed state and only in this file.

import { MARK_PATHS, MARK_VIEWBOX, WORD_INK, WORD_QUIRE, WORD_VIEWBOX } from '@/brand-art'

export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      {MARK_PATHS.map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

/**
 * Height-driven, like the sign-in lockup: the runs have fixed proportions, so setting the
 * height and letting the width follow is the only sizing that cannot distort them.
 */
export function BrandWord({ height = 20 }: { height?: number }) {
  return (
    <svg viewBox={WORD_VIEWBOX} height={height} fill="currentColor" className="w-auto" role="img" aria-label="quireINK">
      <path d={WORD_QUIRE} />
      <path d={WORD_INK} />
    </svg>
  )
}
