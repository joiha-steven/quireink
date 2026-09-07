// Labeled text input + textarea primitives.
//
// `note` is not decoration: it is the reason the settings screens drifted. The primitive
// carried a label and nothing else, so every hint had to be hand-placed by its caller and
// they disagreed — above the control here, below it there, styled three ways. With a slot
// for it the order is decided ONCE, here, and no call site can hold a different opinion.
// The order is the one rule: what it is, what to know about it, then the control.
import { useId, useState, type FocusEvent, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { CONTROL, FIELD_W, NOTE, SETTING_LABEL } from '@/admin/components/kit'
import { NOTE_ALERT } from '@/admin/components/scale'
import { useAdminT } from '@/admin/components/I18nProvider'

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
 * retention, autosave seconds. Reported as many short settings breaking onto a new line,
 * a lot of empty space, and hard on the eyes.
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
  /**
   * A refusal to print under the field, from OUTSIDE — usually the server's.
   *
   * Separate from the check the field runs on itself, and it outranks it: a value the
   * browser is happy with can still be one this blog cannot take (a list path a post already
   * holds), and that answer only exists after a round trip.
   */
  error?: string
}

/** The ballpoint on the edge of a field the reader has to come back to. */
const INVALID = 'border-[var(--pen-red)] focus:border-[var(--pen-red)]'

/**
 * WHY THE LABEL POINTS AT THE FIELD INSTEAD OF WRAPPING IT.
 *
 * A `<label>` around the control takes ALL of its text into the control's accessible name,
 * so a field with a hint and a refusal announced itself as one run-on sentence: its label,
 * then the explanation, then the refusal, with no way to tell which part was which and no
 * way for the refusal to arrive on its own once it changed. Naming the control with `for`
 * and describing it with `aria-describedby` gives the same three pieces the roles they had
 * on screen all along: a name, a description, and a message that is read when it appears.
 */
function describedBy(...ids: unknown[]): string | undefined {
  const on = ids.filter((id): id is string => typeof id === 'string' && id !== '')
  return on.length ? on.join(' ') : undefined
}

export function Input({ label, note, className = '', inline, error, onBlur, ...props }: InputProps) {
  const t = useAdminT()
  const auto = useId()
  const id = props.id ?? auto
  const noteId = `${auto}-note`
  const msgId = `${auto}-msg`
  /**
   * WHAT THE FIELD FINDS OUT ABOUT ITSELF, ON BLUR.
   *
   * Not while typing: "not a valid address" appearing on the second keystroke of an email is
   * a screen arguing with somebody who is halfway through. Blur is the moment they have
   * finished saying it. The browser already knows the answer — `min`, `max`, `type=email`
   * and `type=url` are on the element — and `validity` reports it; what it does NOT have is
   * a sentence in the owner's language, which is the whole of what is added here.
   */
  const [found, setFound] = useState<string | null>(null)
  const check = (e: FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    const v = el.validity
    setFound(
      v.valid ? null
      : v.rangeUnderflow ? t.fieldMin.replace('{n}', el.min)
      : v.rangeOverflow ? t.fieldMax.replace('{n}', el.max)
      : v.typeMismatch && el.type === 'email' ? t.fieldEmail
      : v.typeMismatch && el.type === 'url' ? t.fieldUrl
      : v.valueMissing ? t.fieldRequired
      : t.fieldInvalid,
    )
    onBlur?.(e)
  }
  const shown = error ?? found
  const described = describedBy(note && noteId, shown && msgId, props['aria-describedby'])
  const field = (
    <input
      className={`${FIELD} ${widthFor(props.type, className)} ${shown ? INVALID : ''} ${className}`}
      aria-invalid={shown ? true : undefined}
      onBlur={check}
      {...props}
      id={id}
      aria-describedby={described}
    />
  )
  // `role=alert`: a refusal that appears after the field has been left, or after a round
  // trip, is new information arriving on a screen the reader may have moved on from.
  const message = shown ? <span id={msgId} role="alert" className={`${NOTE_ALERT} mt-1 block`}>{shown}</span> : null
  const title = label && <label htmlFor={id} className={SETTING_LABEL}>{label}</label>
  const hint = note && <span id={noteId} className={`${NOTE} block`}>{note}</span>
  const beside = inline ?? props.type === 'number'
  if (beside && (label || note)) {
    return (
      // `flex-wrap` + `basis-48`, matching `Setting`'s inline row: a short field stays beside
      // its label, and one that would leave the sentence under 12rem wraps under it instead.
      <div className="setting-row flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <span className="min-w-0 flex-1 basis-48">
          {title}
          {hint}
          {/* The message goes with the LABEL on an inline row, not under the field: the field
              is 5rem wide at the right-hand edge and a sentence there wraps to four lines. */}
          {message}
        </span>
        <span className="shrink-0">{field}</span>
      </div>
    )
  }
  return (
    <div className="block">
      {title}
      {hint}
      <input
        className={`${FIELD} ${widthFor(props.type, className)} ${label || note ? 'mt-2' : ''} ${shown ? INVALID : ''} ${className}`}
        aria-invalid={shown ? true : undefined}
        onBlur={check}
        {...props}
        id={id}
        aria-describedby={described}
      />
      {message}
    </div>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; note?: ReactNode }

export function Textarea({ label, note, className = '', ...props }: TextareaProps) {
  const auto = useId()
  const id = props.id ?? auto
  const noteId = `${auto}-note`
  return (
    <div className="block">
      {label && <label htmlFor={id} className={SETTING_LABEL}>{label}</label>}
      {note && <span id={noteId} className={`${NOTE} block`}>{note}</span>}
      <textarea
        className={`${FIELD} ${FIELD_W.full} resize-y ${label || note ? 'mt-2' : ''} ${className}`}
        {...props}
        id={id}
        aria-describedby={describedBy(note && noteId, props['aria-describedby'])}
      />
    </div>
  )
}
