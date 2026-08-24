// The slider. One setting uses it today (how loud a keystroke is); it is a primitive anyway,
// for the reason every other file in this directory is one — a second caller would otherwise
// re-type the accent and the two would disagree about which black the thumb is.
//
// The accent is `CHECK`, the same ink as a tick, and that is not a shortcut: a range with no
// `accent-color` is not unstyled, it is painted in the OS accent, which is blue, in an admin
// of black, white and neutrals. The checkbox rule in `scripts/checks/admin-kit.ts` was
// written after five controls shipped that way.
import type { InputHTMLAttributes, ReactNode } from 'react'
import { CHECK, NOTE, SETTING_LABEL } from '@/admin/components/kit'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  note?: ReactNode
  /** Drawn to the right of the track, in the tabular figures, so the number never dances. */
  readout?: ReactNode
}

// NOT `appearance-none`. Stripping the appearance off a range removes the TRACK and leaves
// the thumb alone in mid-air — photographed on 2026-08-25, a black dot floating in the card
// with no rail under it — and re-drawing a track means `::-webkit-slider-runnable-track` and
// `::-moz-range-track` and a thumb for each, four vendor pseudo-elements to hand-build
// something the browser already draws correctly. `accent-color` is the supported way to tint
// a native range, and it tints the filled half and the thumb together.
const TRACK =
  `${CHECK} h-6 w-48 cursor-pointer ` +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-700 ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

export function Range({ label, note, readout, className = '', ...props }: Props) {
  return (
    <label className="block">
      {label && <span className={SETTING_LABEL}>{label}</span>}
      {note && <span className={`${NOTE} block`}>{note}</span>}
      <span className={`flex items-center gap-3 ${label || note ? 'mt-2' : ''}`}>
        <input type="range" className={`${TRACK} ${className}`} {...props} />
        {readout !== undefined && (
          <span className="w-10 shrink-0 text-sm tabular-nums text-neutral-500 dark:text-neutral-400">{readout}</span>
        )}
      </span>
    </label>
  )
}
