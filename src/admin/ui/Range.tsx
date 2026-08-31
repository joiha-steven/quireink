// The slider. One setting uses it today (how loud a keystroke is); it is a primitive anyway,
// for the reason every other file in this directory is one — a second caller would otherwise
// re-type the accent and the two would disagree about which black the thumb is.
//
// It is drawn (`.fader` in admin.css), not tinted: a bare range is painted in the OS
// accent, which is blue, in an admin of black, white and neutrals — and `accent-color`,
// the tinting fix that shipped first, cannot give the knob a face or the track a groove.
import type { InputHTMLAttributes, ReactNode } from 'react'
import { NOTE, SETTING_LABEL } from '@/admin/components/kit'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  note?: ReactNode
  /** Drawn to the right of the track, in the tabular figures, so the number never dances. */
  readout?: ReactNode
}

// `.fader` in admin.css draws the whole control: a carved groove and a rectangular knob
// standing proud of it — the hi-fi slide. That DOES mean `appearance-none` plus the four
// vendor pseudo-elements this file once refused (2026-08-25 it left a thumb floating in
// mid-air with no rail); the difference now is that the track is drawn on purpose, in the
// same stylesheet, with the same groove the segmented strip wears — not stripped and
// forgotten. `accent-color` cannot shade a knob, and the knob is the point.
const TRACK =
  'fader h-6 w-48 cursor-pointer ' +
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
