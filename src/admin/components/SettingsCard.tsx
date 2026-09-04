// A settings GROUP: the panel card the eight tabs are built from, with a header the eye can
// find. Thirty-seven of these are on the settings screen, in two columns, and until this file
// existed a group's title was 15px/600 sitting one point and one weight above the labels
// underneath it — which the owner read on 2026-09-04 as "khó nhận biết quá", hard to make out.
//
// THREE THINGS DO THE WORK, and no one of them is enough on its own. Measured on a plate of six
// treatments rendered in the real admin, light and dark:
//   · SIZE — `GROUP_TITLE`, 17px against the 14px labels below. This is the one that carries it;
//     a marker alone left the title reading as one more label.
//   · A DOT — a 7px round mark opening the row, so scanning DOWN a column has something to catch
//     on rather than a wall of same-sized words. It is the thing the owner asked for by name.
//   · A BAND — the header row on its own tint, which turns "a line of bolder text" into "the top
//     of a box". It is what separates one group from the next when they stack.
//
// THE BAND IS DRAWN WITHOUT TOUCHING `Card`, and the trick is worth stating because it looks
// like a mistake otherwise: the tint goes on the SECTION (`className`), which paints the whole
// card including the header; the body then paints itself back to the sheet's own colour
// (`bodyClassName`), so the tint survives only on the strip the body does not cover. That is
// the header row, exactly. Two props that already existed, no structural CSS reaching into the
// primitive's children, and nothing to break if `Card` is rearranged later.
//
// The body's `rounded-b-[7px]` is one step INSIDE the section's `rounded-lg` (8px), so the
// repainted corner sits within the 1px border instead of cutting across its curve.
//
// WHY A WRAPPER RATHER THAN A PROP ON `Card`. Two reasons, and the second is the real one:
//   · `kit.tsx` sits at 398 lines against the 400-line cap, so a prop there would have had to be
//     paid for by splitting the kit — a large change to buy a small one;
//   · the treatment belongs to SETTINGS, not to every card. `Card panel` also draws the eight
//     cards on the Help screen, and those are prose, not groups of controls read down a column.
//     A prop on the primitive would have left the choice at thirty-seven call sites; a wrapper
//     makes it one decision stated once — the same argument `check:admin-kit` makes about class
//     lists.
//
// The title goes in as a NODE, so `Card` keeps drawing the <h2> and nothing about the header row
// is re-typed here. `GROUP_TITLE` on the span inside it wins over the `SECTION` the <h2> carries,
// which is why both can exist: a card that is not a settings group still gets `SECTION`.
// `textContent` is unchanged by any of this, which is what `buttonInCard` in the test fixture
// matches a card by.
//
// `items-start`, NOT `items-center`: a title that wraps to two lines would otherwise centre the
// dot in the gap between them. English never shows this — every title fits one line at 375px —
// but "Đăng nhập và chống spam bình luận" measures 259px against 243px of room, so the case is
// real on a phone in the language this blog is run in. `mt-[7px]` centres the 7px dot on the
// FIRST line box: (17px × 1.4 − 7px) ÷ 2 ≈ 7.
import type { ReactNode } from 'react'
import { Card } from './kit'
import { GROUP_TITLE } from './scale'

/** The tint that survives on the header strip, and the repaint that confines it there. */
const BAND = 'bg-neutral-50 dark:bg-white/[0.04]'
const BODY = 'rounded-b-[7px] bg-white dark:bg-neutral-900'
/** The mark that opens the row. Graphite, not an ink: see `admin.css` on what a colour MEANS. */
const DOT = 'mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-500'

export function SettingsCard({ title, actions, children, className = '', bodyClassName = '' }: {
  title: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card
      panel
      className={`${BAND} ${className}`}
      bodyClassName={`${BODY} ${bodyClassName}`}
      title={
        <span className={`flex items-start gap-2.5 ${GROUP_TITLE}`}>
          <span className={DOT} aria-hidden />
          {title}
        </span>
      }
      actions={actions}
    >
      {children}
    </Card>
  )
}
