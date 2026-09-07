// A named group of settings INSIDE one card.
//
// ADR 0041 groups the Posts tab by WHERE a thing sits on a published page — the head of the
// post, its body, its foot — and those are not three cards. Three cards would say the head of
// a post and the foot of a post are as unrelated as the palette and the backup schedule, when
// the whole point of the grouping is that they are the same subject read in order. So: one
// card, and a rule with a name on it between each stretch.
//
// It is the MIDDLE of the three ranks (`SettingsCard` names all three) — the sheet's edge,
// then the card's, then whatever is in the card, each line lighter than the one around it. A
// group draws ONE hairline above its title and no box: a box inside a card at the card's own
// radius is the arrangement that made the innermost frame shout loudest, fixed on 2026-09-01
// and not worth re-introducing one level further in.
//
// `first` drops that rule, because a rule directly under the card's own header row is two
// lines with nothing between them.
import type { ReactNode } from 'react'
import { NOTE_TEXT, UTIL } from './scale'

export function SettingsGroup({ title, note, first = false, children }: {
  title: ReactNode
  /** One sentence on what the group is for, when the title alone does not say it. */
  note?: ReactNode
  first?: boolean
  children: ReactNode
}) {
  return (
    <section
      className={first ? '' : 'mt-6 border-t border-neutral-100 pt-5 dark:border-neutral-800'}
    >
      {/* AN EYEBROW, not a heading. At `SECTION` this sat one point under the card's own
          title, so a card and a stretch inside it were the same object to the eye and the
          card had to be decorated — a dot, a band, an extra point of size — to tell them
          apart. 12px uppercase against a 16px/600 title is four points and two weights, and
          the decoration comes off. */}
      <h3 className={`${UTIL} mb-1.5`}>{title}</h3>
      {note && (
        <p className={`${NOTE_TEXT} mb-3`}>{note}</p>
      )}
      {children}
    </section>
  )
}
