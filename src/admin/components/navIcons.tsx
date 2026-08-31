// The admin's icons, worn from the ONE shared set in `src/icons.ts` — the same bodies the
// reading site's chrome wraps in server HTML. This file used to DRAW eighteen icons of its
// own at stroke 1.55 while the public header drew six more at 1.6 and 1.7; now a shape is
// drawn once and both faces inherit it, echo strokes, filled dots and all.
//
// The named exports stay, because eighteen call sites naming their icon is worth more than
// one generic `<Icon name>` prop at each of them — the seam to the shared set lives here.
import { ICONS, type IconName } from '@/icons'

const C = 'h-5 w-5 shrink-0'

// The bodies are module CONSTANTS from our own file — no request data ever passes through
// this, which is what makes `dangerouslySetInnerHTML` ordinary here rather than a hole.
function I({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={C}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  )
}

export function IconHome() { return <I name="home" /> }
export function IconAnalytics() { return <I name="chart" /> }
export function IconContent() { return <I name="page" /> }
export function IconMedia() { return <I name="image" /> }
export function IconNewsletter() { return <I name="mail" /> }
export function IconTrash() { return <I name="trash" /> }
export function IconSettings() { return <I name="settings" /> }
export function IconLog() { return <I name="log" /> }
export function IconComment() { return <I name="comment" /> }
export function IconExternal() { return <I name="external" /> }
export function IconCache() { return <I name="cache" /> }
export function IconHelp() { return <I name="help" /> }
export function IconSignOut() { return <I name="signOut" /> }
export function IconGlyphs() { return <I name="glyphs" /> }
export function IconChevronLeft() { return <I name="prev" /> }
export function IconMore() { return <I name="more" /> }
export function IconAssistant() { return <I name="penMark" /> }
export function IconSearch() { return <I name="search" /> }
export function IconClose() { return <I name="close" /> }

/**
 * A set body as bare SVG children, for a file that draws its own <svg> wrapper.
 *
 * The editor's toolbar is the one such file: it sizes and strokes its glyphs itself (18px,
 * inside a dense row), and three of them — link, picture, bin — are shapes the set already
 * owns. This lets it borrow the shape without borrowing the wrapper.
 */
export const SharedGlyph = ({ name }: { name: IconName }) => (
  <g dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
)
