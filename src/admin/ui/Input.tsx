// Labeled text input + textarea primitives.
//
// `note` is not decoration: it is the reason the settings screens drifted. The primitive
// carried a label and nothing else, so every hint had to be hand-placed by its caller and
// they disagreed — above the control here, below it there, styled three ways. With a slot
// for it the order is decided ONCE, here, and no call site can hold a different opinion.
// The order is the one rule: what it is, what to know about it, then the control.
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { CONTROL, FIELD_W, NOTE, SETTING_LABEL } from '@/admin/components/kit'

// `CONTROL`, not a copy of it. This file used to declare its own `FIELD` with the same
// twenty-odd classes, under a comment in `kit.tsx` promising the two matched — which is a
// promise nothing checked and which had to be re-kept by hand on every change.
const FIELD = CONTROL

/**
 * How wide a field is, when nobody said.
 *
 * A number field is the case worth naming: the excerpt-length box held two digits in 580px,
 * next to a site title in 580px and a description in 580px, so three answers of wildly
 * different shape were drawn as the same question. A field whose content has a known size
 * gets a width to match; free text still fills its card.
 *
 * A caller that states a width keeps it — two competing width classes in one list resolve by
 * stylesheet order, which is not something a call site can reason about, so exactly one is
 * ever emitted.
 */
const widthFor = (type: string | undefined, className: string): string =>
  /(^|\s|:)(w-|max-w-)/.test(className) ? '' : type === 'number' ? FIELD_W.short : FIELD_W.full

/**
 * A SHORT ANSWER SITS BESIDE ITS QUESTION.
 *
 * A two-digit number on its own line under a label and a sentence is three stacked rows to
 * say "10", and a settings tab is full of them: posts per page, site width, excerpt length,
 * most-viewed count, related count, upload limit, storage limit, backup interval and
 * retention, autosave seconds. The owner's words were *"nhiều tuỳ chỉnh ngắn ngưng xuống
 * hàng, khoảng trống nhiều, tối mắt"* — many short settings breaking onto a new line, a lot
 * of empty space, hard on the eyes.
 *
 * This file already made exactly this judgement about WIDTH: `widthFor` gives a number field
 * `FIELD_W.short` because a field should be as wide as its answer. A field should also not
 * take a whole row to hold one. So the same test now decides the layout, in the same place,
 * and no call site has to remember — which is this primitive's whole argument for existing.
 *
 * `inline={false}` opts out for a number that is genuinely a long answer; `inline` opts a
 * text field IN.
 */
type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  note?: ReactNode
  inline?: boolean
}

export function Input({ label, note, className = '', inline, ...props }: InputProps) {
  const field = (
    <input className={`${FIELD} ${widthFor(props.type, className)} ${className}`} {...props} />
  )
  const beside = inline ?? props.type === 'number'
  if (beside && (label || note)) {
    return (
      // `flex-wrap` + `basis-48`, matching `Setting`'s inline row: a short field stays beside
      // its label, and one that would leave the sentence under 12rem wraps under it instead.
      <label className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <span className="min-w-0 flex-1 basis-48">
          {label && <span className={SETTING_LABEL}>{label}</span>}
          {note && <span className={`${NOTE} block`}>{note}</span>}
        </span>
        <span className="shrink-0">{field}</span>
      </label>
    )
  }
  return (
    <label className="block">
      {label && <span className={SETTING_LABEL}>{label}</span>}
      {note && <span className={`${NOTE} block`}>{note}</span>}
      <input className={`${FIELD} ${widthFor(props.type, className)} ${label || note ? 'mt-2' : ''} ${className}`} {...props} />
    </label>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; note?: ReactNode }

export function Textarea({ label, note, className = '', ...props }: TextareaProps) {
  return (
    <label className="block">
      {label && <span className={SETTING_LABEL}>{label}</span>}
      {note && <span className={`${NOTE} block`}>{note}</span>}
      <textarea className={`${FIELD} ${FIELD_W.full} resize-y ${label || note ? 'mt-2' : ''} ${className}`} {...props} />
    </label>
  )
}
