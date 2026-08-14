// Shared on/off switch primitives for the settings forms.

import { CHECK, Setting } from '@/admin/components/kit'

type SwitchProps = { checked: boolean; onChange: (v: boolean) => void }

// The bare toggle.
export function Switch({ checked, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all dark:bg-neutral-900 ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

/**
 * One row inside a bordered list: label, note, switch.
 *
 * Built on `Setting` rather than laid out here, so the label size, the note style and the
 * gap between them are the ones every other setting uses. It was three hand-written
 * classes that had already drifted from the fields beside them.
 */
export function ToggleRow({
  label,
  desc,
  badge,
  checked,
  onChange,
}: SwitchProps & { label: string; desc?: string; badge?: string }) {
  return (
    <Setting label={label} note={desc} badge={badge} inline className="p-4">
      <Switch checked={checked} onChange={onChange} />
    </Setting>
  )
}

// A boolean with no note of its own, inside a denser group (the palette cards, a form row).
export function ToggleField({ label, checked, onChange }: SwitchProps & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </label>
  )
}

/**
 * A checkbox, for the two places a boolean sits inside a tight grid where a 44px switch
 * would not fit: the palette cards' "show to readers", and the SMTP TLS row. Those were
 * raw `<input type="checkbox">` with browser-default chrome, which is why they looked like
 * a different application from the switches above them.
 */
export function CheckField({
  label,
  checked,
  onChange,
  disabled = false,
}: SwitchProps & { label: string; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-2 text-xs ${disabled ? 'cursor-default text-neutral-400 dark:text-neutral-600' : 'cursor-pointer text-neutral-600 dark:text-neutral-300'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-4 w-4 shrink-0 rounded border-neutral-300 dark:border-neutral-600 ${CHECK}`}
      />
      {label}
    </label>
  )
}
