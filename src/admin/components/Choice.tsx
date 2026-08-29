// One setting whose answer is a short closed list.
//
// Not a new control: it is `Setting` above the kit's own segmented track, with the buttons
// built from the options instead of mapped by hand at the call site. Ten screens already
// build that chooser out of `SEGMENT_TRACK` + `tabItemClass` directly (`admin-design.md`
// records the audit that found them), and the three cards added on 2026-08-29 — post
// pictures, shape, and the choosers inside them — would have made seven more copies of the
// same eight lines. A copy is where a `flex-wrap`, a `key` or the `type="button"` goes
// missing, so the eight lines live here once.
//
// It draws NOTHING of its own: every class comes from the kit, which is what keeps
// `check:admin-kit` meaningful and what makes this a reduction rather than an eleventh
// variant of a control the admin already has.
import { SEGMENT_TRACK, Setting, tabItemClass } from './kit'

export type ChoiceOption<T extends string> = { value: T; label: string }

export function Choice<T extends string>({ label, note, value, options, onChange }: {
  label: string
  note?: string
  value: T
  options: readonly ChoiceOption<T>[]
  onChange: (value: T) => void
}) {
  return (
    <Setting label={label} note={note}>
      {/* `flex-wrap`: five short options in eleven languages do not all fit one line, and a
          track that cannot wrap scrolls sideways inside a card instead. */}
      <div className={`${SEGMENT_TRACK} flex-wrap`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={tabItemClass(value === o.value, 'sm')}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Setting>
  )
}
