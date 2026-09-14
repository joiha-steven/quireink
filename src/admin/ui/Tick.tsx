// The admin's checkbox, drawn.
//
// Every box in this admin was the browser's own until now — `accent-neutral-900` on a native
// `input[type=checkbox]`, which is the platform widget in the platform's shape with the
// platform's border. Beside 14px type in a 320px column that reads as a form pasted into a
// page of writing: the native box carries a heavy two-tone border, it does not take the
// hairline the rest of the admin is built from, and `accent-` can colour its fill and nothing
// else. `Switch` was drawn for the same reason and is the precedent for this file.
//
// It is still a real `input[type=checkbox]`. `appearance-none` removes the widget and leaves
// the element — so it stays focusable, keyboard-operable, announced as a checkbox, and
// nameable by a wrapping `<label>`. The tick is an overlaid SVG with `pointer-events-none`,
// which is why the input alone is the hit target and why the check cannot swallow a click.
//
// `rounded` is 4px, not the 6px control step: on a 16px box 6px is a 38% corner, which reads
// as a blob rather than as a checkbox. That exception is `CheckField`'s, from 2026-08-27,
// and it is the same exception for the same measurement.
//
// The class strings moved to `@/admin-shared/kit` when the trash became a page (ADR 0054), so
// the server can draw the same box without importing React.
import type { InputHTMLAttributes } from 'react'
import { TICK_BOX, TICK_MARK, TICK_PATH, TICK_WRAP } from '@/admin-shared/kit'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>

/**
 * `className` lands on the WRAPPER, not the box: every caller that has wanted to touch this
 * control has wanted to place it (`mt-0.5`, `self-start`), and a margin on the input would
 * move the box out from under the tick drawn over it.
 */
export function Tick({ className = '', ...props }: Props & { className?: string }) {
  return (
    <span className={`${TICK_WRAP} ${className}`}>
      <input type="checkbox" className={TICK_BOX} {...props} />
      <svg viewBox="0 0 16 16" aria-hidden className={TICK_MARK}>
        <path
          d="M4 8.4 6.6 11 12 5"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={TICK_PATH}
        />
      </svg>
    </span>
  )
}
