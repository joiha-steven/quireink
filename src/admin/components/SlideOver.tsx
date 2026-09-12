// The right-hand sheet: a scrim, a fixed panel, a titled header, a footer for the
// buttons that end it (the Writing Desk mock's `pubsheet`).
//
// One component, because the post editor and the page editor both hang their attributes on
// it and the sheet chrome is exactly the kind of thing that drifts when each screen carries
// its own copy — see "One of each" in docs/admin-kit.md.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { OVERLAY_LIFT } from './sheet'

/**
 * The width at which the sheet stops covering the words and stands beside them instead.
 *
 * Arithmetic, not taste: the rail is 208px at its widest, the sheet is 24rem, and the writing
 * column is 672px and does not give any of that back. 208 + 384 + 672 leaves 176px at 1440,
 * which is 88px of paper each side of the column; at 1360 it is 48px, and under that the
 * column would have to narrow, which is the one thing the sheet must never make it do.
 *
 * Measured on 2026-09-12 with the sheet always on top: it hid 232px of the writing column at
 * 1280 (34.5% of every line), 104px at 1440 and 200px at 1920, with 348px of empty paper
 * standing beside the text at that last one. So the trade is width against sight, and above
 * this line there is enough width that nothing has to be paid for it.
 */
const DOCK_AT = '(min-width: 85rem)'

/**
 * Is this sheet standing beside the page rather than on top of it, right now?
 *
 * Two answers, and they are not the same question: `wanted` is whether this KIND of sheet
 * docks at all (the publish step never does, see `PublishPanel`), and the media query is
 * whether there is room. Re-asked on resize, so dragging a window across the line moves the
 * sheet between the two behaviours rather than leaving it in the wrong one.
 */
function useDocked(wanted: boolean): boolean {
  const [fits, setFits] = useState(false)
  useEffect(() => {
    if (!wanted) return
    const mq = matchMedia(DOCK_AT)
    const sync = () => setFits(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [wanted])
  const docked = wanted && fits
  // The canvas reads this to hold its own right edge clear of the sheet. On the document
  // element rather than a prop, because the thing that has to move is the scrolling area two
  // components up, and threading a boolean through the editor to reach it would put the same
  // fact in four files.
  useEffect(() => {
    if (!docked) return
    document.documentElement.dataset.adminSheet = 'docked'
    return () => { delete document.documentElement.dataset.adminSheet }
  }, [docked])
  return docked
}

export function SlideOver({
  label,
  intro,
  headerRight,
  footer,
  onClose,
  dock = false,
  children,
}: {
  label: string
  intro?: string
  headerRight?: ReactNode
  footer: ReactNode
  onClose: () => void
  /**
   * May this sheet stand BESIDE the page when the window is wide enough?
   *
   * False for the publish step, which is a set of questions being answered and belongs on top
   * of the work it is about ([ADR 0024](../../../docs/decisions/0024-the-editor-asks-at-publish.md)).
   * True for a sheet the writer opened themselves to change something while writing, where
   * covering the sentence they are editing is the whole complaint.
   */
  dock?: boolean
  children: ReactNode
}) {
  const panel = useRef<HTMLElement>(null)
  const docked = useDocked(dock)

  /**
   * The three things that make a panel a dialog, none of which this had.
   *
   * Escape closed nothing, so the only way out was the pointer. Focus stayed behind the
   * sheet, so a keyboard reader opened it and then tabbed through the toolbar underneath.
   * And it went back nowhere on close, which for a sheet opened by ⌘⇧A means the keyboard
   * lands on the body. `aria-modal` is the fourth: without it a screen reader walks straight
   * out of the panel into the page it is covering.
   */
  useEffect(() => {
    const el = panel.current
    const opener = document.activeElement as HTMLElement | null
    el?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('keydown', onKey)
      // Give focus back UNLESS something else has taken it: a close that followed a click on
      // a control elsewhere must not drag the keyboard away from it.
      //
      // The test is written against the body and not against the panel, because by the time
      // this runs the panel is already gone: React removes the DOM and clears the ref during
      // the commit, and only afterwards unmounts the effect. Asking whether the sheet still
      // holds focus therefore always answered no, and the keyboard was left on the body -
      // which is the whole failure this effect exists to prevent. What is left behind when a
      // focused element is removed IS the body, so that is what we look for.
      const now = document.activeElement
      const elsewhere = now && now !== document.body && !el?.contains(now)
      if (!elsewhere) opener?.focus()
    }
  }, [onClose])

  return (
    <>
      {/* A click anywhere off the sheet is "not now". A DIV, because as a button it was a
          focusable control whose accessible name was the panel's title and whose action was
          to dismiss it: Tab landed on "Attributes" and pressing it closed the attributes.
          No scrim when the sheet is docked: the page behind it is not "behind" any more, it
          is the other half of what the writer is looking at, and dimming the paragraph you
          opened the sheet to fix is the same mistake as covering it. */}
      {!docked && <div aria-hidden onClick={onClose} className="fixed inset-0 z-40 bg-black/20" />}
      <aside
        ref={panel}
        tabIndex={-1}
        role="dialog"
        // Modal only while it IS one. A docked sheet that claims `aria-modal` tells a screen
        // reader the rest of the page has gone, and the rest of the page is right there.
        aria-modal={docked ? undefined : 'true'}
        aria-label={label}
        className={`admin-sheet fixed inset-y-0 right-0 z-50 flex flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 ${docked ? '' : OVERLAY_LIFT}`}
      >
        <div className="border-b border-neutral-100 px-6 py-5 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{label}</h2>
            {headerRight && <div className="flex gap-3 text-xs">{headerRight}</div>}
          </div>
          {intro && <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{intro}</p>}
        </div>
        <div className="scroll-fade min-h-0 flex-1 overflow-y-auto px-6 py-5 pb-8">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-6 py-4 dark:border-neutral-800">
          {footer}
        </div>
      </aside>
    </>
  )
}
