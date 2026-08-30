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
import type { InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>

const BOX =
  'peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-neutral-300 bg-white transition-colors ' +
  'checked:border-neutral-900 checked:bg-neutral-900 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'dark:border-neutral-600 dark:bg-neutral-900 dark:checked:border-white dark:checked:bg-white ' +
  'dark:focus-visible:ring-neutral-700'

/**
 * `className` lands on the WRAPPER, not the box: every caller that has wanted to touch this
 * control has wanted to place it (`mt-0.5`, `self-start`), and a margin on the input would
 * move the box out from under the tick drawn over it.
 */
export function Tick({ className = '', ...props }: Props & { className?: string }) {
  return (
    <span className={`relative inline-flex h-4 w-4 shrink-0 ${className}`}>
      <input type="checkbox" className={BOX} {...props} />
      {/* The stroke is the GROUND the box fills with, so it reads in both themes without a
          second rule: white on the dark fill, dark on the white one. */}
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="pointer-events-none absolute inset-0 h-4 w-4 opacity-0 transition-opacity peer-checked:opacity-100"
      >
        <path
          d="M4 8.4 6.6 11 12 5"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-white dark:stroke-neutral-900"
        />
      </svg>
    </span>
  )
}
