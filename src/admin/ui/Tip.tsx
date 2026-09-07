// A tooltip that arrives when somebody has stopped, and not before.
//
// `title=` was doing this job everywhere in the editor's toolbar, and it has two faults that
// only matter on a bar of twenty-five glyph buttons. It waits about a second — long enough
// that a writer hunting for the underline key gives up and clicks to find out — and it is
// drawn by the operating system, so the one piece of chrome that explains this product is
// the one piece not set in its type.
//
// 400ms is the number: fast enough to answer a deliberate hover, slow enough that sweeping
// the pointer across a row of buttons on the way somewhere lights up none of them.
//
// ⚠️ `title` IS STILL SET by the caller for the accessibility tree and for touch, where
// there is no hover at all. What this replaces is the sighted-pointer experience only.
import { useEffect, useRef, useState, type ReactNode } from 'react'

const DELAY_MS = 400

export function Tip({ label, children, className = '' }: {
  label: string
  children: ReactNode
  className?: string
}) {
  const [shown, setShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const arm = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setShown(true), DELAY_MS)
  }
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    setShown(false)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <span
      className={`relative inline-flex ${className}`}
      onPointerEnter={arm}
      onPointerLeave={cancel}
      // Focus shows it AT ONCE. A keyboard user has already committed to this control by
      // tabbing to it, so there is no sweep to protect them from.
      onFocusCapture={() => setShown(true)}
      onBlurCapture={cancel}
    >
      {children}
      {shown && (
        // `aria-hidden`: the button already carries this string as its accessible name, and
        // a tooltip that repeats it makes a screen reader say everything twice.
        <span
          aria-hidden
          // 4px, one step tighter than a control's radius, and deliberately not the
          // button's: `check:admin-kit` owns that pair of classes for `Button`, and it is
          // right to — a tooltip wearing a key's silhouette is one somebody tries to click.
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 rounded whitespace-nowrap bg-neutral-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-neutral-700"
        >
          {label}
        </span>
      )}
    </span>
  )
}
