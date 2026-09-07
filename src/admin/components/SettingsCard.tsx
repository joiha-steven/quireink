// A settings CARD: the top rank of the three the settings screen is built from, and the box
// twenty-two of them draw.
//
// THREE RANKS, and the point of naming them is that each is quieter than the one outside it
// (`docs/admin-design.md`: enclosure weakens inward):
//
//   · CARD — this. A hairline box on the sheet's white, its name on a ruled header row at
//     16px/600. It answers "what is this a box of".
//   · GROUP — `SettingsGroup`. A stretch inside a card, opened by ONE rule and an eyebrow in
//     `UTIL`. It answers "which part of that".
//   · LIST — `PANEL_LIST`. Rows with a rule between them and no edge of their own.
//
// ⚠️ THE GREY DOT IS GONE, and so is the tinted header band and the 17px title. All three were
// earned on 2026-09-04 and all three were answers to the same problem: a card title at 15px/600
// over labels at 14px/500 could not be picked out of a column of thirty-seven, so it was given
// a size step, a marker and a band. What was actually missing was RANK — the groups inside a
// card were set at 16px/600, one point under the card's own title, so a card and a stretch
// within it were the same object to the eye and no amount of decoration on the outer one could
// fix that. With the group dropped to a 12px eyebrow the distance is four points and two
// weights, which is the whole job; the dot, the band and the extra point are then three marks
// paid for a difference that is already legible. `GROUP_TITLE` went with them: a step in a
// scale used by exactly one component is not a scale.
//
// What the wrapper still exists for is the LAMP, and one decision stated once rather than at
// twenty-two call sites. `Card panel` also draws the Help screen's cards, which are prose and
// have no state to report.
import type { ReactNode } from 'react'
import { Card } from './kit'

export function SettingsCard({ title, actions, lamp, children, className = '', bodyClassName = '' }: {
  title: ReactNode
  actions?: ReactNode
  /**
   * The card's state, beside its name — green stored and answering, amber wants you, grey off.
   *
   * ⚠️ ONE MARK OPENS A TITLE ROW. `ConnectionCard` first passed its lamp inside the `title`
   * node while this file still drew a grey dot, which left two marks side by side on every
   * self-saving card — one meaning "this is a group" and one meaning "this is working" —
   * reported on the Comments & mail tab the day it shipped. The dot has since gone entirely,
   * and the lamp is the only thing that may take that position.
   */
  lamp?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card
      panel
      className={className}
      bodyClassName={bodyClassName}
      title={
        lamp
          ? (
            <span className="flex items-start gap-2.5">
              {/* ⚠️ `flex`, and it is the whole fix. A lamp is an INLINE-BLOCK, so inside an
                  ordinary span it sits on the text baseline of the title's line box — about
                  15px below where an 8px mark belongs — and the row read visibly out of true.
                  A flex wrapper has no baseline to sit on, so the offset below is the only
                  thing positioning it: 7px centres 8px of lamp on a 16px/1.4 first line,
                  (22.4 − 8) ÷ 2 ≈ 7. `items-start` and not `items-center`, because a title
                  that wraps would otherwise centre the lamp in the gap between its two lines
                  — English never wraps here, and "Đăng nhập và chống spam bình luận" does. */}
              <span className="mt-[7px] flex shrink-0">{lamp}</span>
              {title}
            </span>
          )
          : title
      }
      actions={actions}
    >
      {children}
    </Card>
  )
}
