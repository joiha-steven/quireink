// A field that depends on a switch grows out of the row rather than appearing in it.
//
// The admin had five of these — the related-post count under "Related posts", the mat colour
// under a frame, the front page's rows, the popular window — and every one of them was a
// bare `{on && <field/>}`. So turning a switch on inserted a control between two frames and
// pushed everything below it down by however tall the control happened to be. The eye cannot
// follow that: it reports "the screen is different now" and leaves working out what moved,
// and where, to a second look.
//
// ⚠️ `grid-template-rows: 0fr → 1fr` IS THE MECHANISM, and it is the only one that animates
// to a height nobody has measured. `height: auto` is not animatable; a fixed pixel height is
// a number that goes stale the first time a translation is longer. The rule lives in
// `admin.css` under `.admin-reveal`; the inner element owns the `overflow: hidden` that makes
// the row a curtain rather than a clip.
//
// ⚠️ THE CHILDREN STAY MOUNTED while closed, which is why this is for SMALL things. A number
// field costs nothing to keep around; the front page's twenty controls are a different
// decision — `SettingsHomeTab` still mounts those only when the mode calls for them, and the
// reason is written there.
import type { ReactNode } from 'react'

export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    // `aria-hidden` and `inert` while closed: the row is still in the DOM, so without them a
    // screen reader and the Tab key both find a control nobody can see.
    <div className="admin-reveal" data-open={open ? '' : undefined} aria-hidden={!open} inert={!open}>
      <div>{children}</div>
    </div>
  )
}
