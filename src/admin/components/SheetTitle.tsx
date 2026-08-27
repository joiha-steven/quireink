// The title on the paper, with the meta line under it (the mock's `etitle` + `emeta`).
//
// One component because the post editor and the page editor rendered this block as two
// hand-rolled copies for exactly one render before they drifted — the "One of each" rule.
//
// The title is part of the WRITING SURFACE, not part of the form: it is the headline, set
// in the reading face, inside the sheet. No `tracking-tight` — that was the sans's
// -0.025em on a serif that publishes at -0.01em.
import { READING } from './kit'

export function SheetTitle({
  value,
  onChange,
  placeholder,
  metaLine,
}: {
  value: string
  onChange: (title: string) => void
  placeholder: string
  metaLine: string
}) {
  return (
    <div className="px-4 pt-6">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={1}
        className={`${READING} write-surface min-h-12 w-full resize-none overflow-hidden bg-transparent text-3xl font-semibold leading-tight [field-sizing:content] placeholder:italic placeholder:font-normal placeholder:text-neutral-300 dark:placeholder:text-neutral-600`}
      />
      <p className="mb-2 mt-1 text-xs text-neutral-500 dark:text-neutral-400">{metaLine}</p>
    </div>
  )
}
