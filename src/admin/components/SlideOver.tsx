// The right-hand sheet: a scrim, a fixed panel, a titled header, a footer for the
// buttons that end it (the Writing Desk mock's `pubsheet`).
//
// One component, because the post editor and the page editor both hang their attributes on
// it and the sheet chrome is exactly the kind of thing that drifts when each screen carries
// its own copy — see "One of each" in docs/admin-kit.md.
import { useEffect, useRef, type ReactNode } from 'react'
import { OVERLAY_LIFT } from './sheet'

export function SlideOver({
  label,
  intro,
  headerRight,
  footer,
  onClose,
  children,
}: {
  label: string
  intro?: string
  headerRight?: ReactNode
  footer: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLElement>(null)

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
          to dismiss it: Tab landed on "Attributes" and pressing it closed the attributes. */}
      <div aria-hidden onClick={onClose} className="fixed inset-0 z-40 bg-black/20" />
      <aside
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 ${OVERLAY_LIFT}`}
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
