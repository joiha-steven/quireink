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

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; note?: ReactNode }

export function Input({ label, note, className = '', ...props }: InputProps) {
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
