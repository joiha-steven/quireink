// Shared on/off switch primitives for the settings forms.

import type { ReactNode } from 'react'
import { Setting } from '@/admin/components/kit'
import { Tick } from './Tick'

type SwitchProps = { checked: boolean; onChange: (v: boolean) => void }

// The bare toggle.
//
// `disabled` is not decoration either: a switch whose feature has no engine behind it —
// the AI jobs with no model connected — has to look unavailable rather than off, or the
// owner flips it, sees it flip back, and concludes the admin is broken.
//
// `label` is REQUIRED, and that is the point of it. The switch draws no text of its own, so
// its name has to be handed to it; the row's own label is a SIBLING, and a sibling names
// nothing — a `<label>` element cannot name a `<button>` either, which is why wrapping the
// one in ToggleField was not enough. Every switch in Settings announced itself as "switch,
// on" with no word for WHAT was on, measured 2026-08-27 across twenty-six of them. Required
// rather than optional so the next one cannot be added without a name.
export function Switch({ checked, onChange, label, disabled = false }: SwitchProps & { label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,.3)] ${checked ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'}`}
    >
      {/* The groove is carved (the inset above); the knob stands proud of it — lit on top,
          shaded underneath — so the control reads as a physical slide in both themes. */}
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all dark:bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,.35),inset_0_1px_1px_rgba(255,255,255,.45),inset_0_-1.5px_2px_rgba(0,0,0,.2)] ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/**
 * One row inside a bordered list: label, note, switch.
 *
 * Built on `Setting` rather than laid out here, so the label size, the note style and the
 * gap between them are the ones every other setting uses. It was three hand-written
 * classes that had already drifted from the fields beside them.
 *
 * A disabled row dims as ONE thing — label, note and switch together. Dimming only the
 * control leaves a black label over a grey switch, which reads as a rendering fault.
 */
export function ToggleRow({
  label,
  desc,
  badge,
  checked,
  onChange,
  disabled = false,
  // `ReactNode`, because one row's note is a disclosure rather than a sentence: the update
  // check's is a 700-character promise about what leaves the machine, folded into a
  // `<details>` so it stays verbatim without printing eleven lines under a switch.
}: SwitchProps & { label: string; desc?: ReactNode; badge?: string; disabled?: boolean }) {
  return (
    <Setting label={label} note={desc} badge={badge} inline className={`p-4 ${disabled ? 'opacity-50' : ''}`}>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </Setting>
  )
}

// A boolean with no note of its own, inside a denser group (the palette cards, a form row).
export function ToggleField({ label, checked, onChange }: SwitchProps & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  )
}

/**
 * A checkbox, for the two places a boolean sits inside a tight grid where a 44px switch
 * would not fit: the palette cards' "show to readers", and the SMTP TLS row. Those were
 * raw `<input type="checkbox">` with browser-default chrome, which is why they looked like
 * a different application from the switches above them.
 *
 * The box is `ui/Tick` and no longer a styled native widget: `accent-` colours a fill and
 * nothing else, so these two kept the platform's own border and shape while the switch above
 * them was drawn. One drawn box, one look, and the label handling stays here.
 */
export function CheckField({
  label,
  checked,
  onChange,
  disabled = false,
}: SwitchProps & { label: string; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2 text-xs ${disabled ? 'cursor-default text-neutral-400 dark:text-neutral-600' : 'cursor-pointer text-neutral-600 dark:text-neutral-300'}`}>
      <Tick checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
