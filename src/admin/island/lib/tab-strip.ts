// THE CHOSEN TAB COMES INTO VIEW, and on a phone that is the difference between a strip and a
// strip you can use.
//
// Seven settings tabs are 720px of labels in a 358px sheet, so four of them are off the right
// edge. Arriving on `?tab=account` — or arrowing to it — left the selection scrolled out of
// sight with the strip apparently showing "Blog", which is a screen telling the reader they are
// somewhere they are not. React's shared `tabs.tsx` did this and every island that replaced it
// under ADR 0054 lost it: measured 2026-09-15 at 375px against the React build, on all five.
//
// One module rather than five copies, for the reason the whole conversion keeps running into:
// five copies of a rule is five chances for four of them to be wrong, and this is a rule nobody
// looks at on a desktop, where the strip fits and nothing is ever out of view.
import { scrollBehavior } from '@/admin/motion'

/**
 * Centre the selected tab in a strip that actually scrolls.
 *
 * `inline: 'center'` rather than `'nearest'`: centring also reveals what is on either SIDE of
 * the current tab, which is the whole reason the strip is a strip.
 *
 * ⚠️ NOT WHEN IT FITS. `scrollIntoView` on an element in a box with nothing to scroll still
 * scrolls the PAGE — so on a desktop, where all seven tabs are on screen, swapping tabs would
 * jump the sheet to put the strip in the middle of the window.
 */
export function showTab(strip: HTMLElement | null | undefined): void {
  if (!strip) return
  const track = strip.scrollWidth > strip.clientWidth
    ? strip
    : [...strip.querySelectorAll<HTMLElement>('*')].find((el) => el.scrollWidth > el.clientWidth)
  if (!track) return
  // EITHER WORD FOR "THIS ONE". Settings draws a real tablist and says `aria-selected`; the
  // library, newsletter, trash and comments strips are rows of toggle buttons and say
  // `aria-pressed`. Both are correct for what they are, and both mean the same thing here.
  const chosen = [...track.querySelectorAll<HTMLElement>('[data-tab]')]
    .find((b) => b.getAttribute('aria-selected') === 'true' || b.getAttribute('aria-pressed') === 'true')
  chosen?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: scrollBehavior() })
}
