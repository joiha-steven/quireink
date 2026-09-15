// WHY A VALUE WAS REFUSED, said in the admin's own language.
//
// ⚠️ THE BROWSER WILL NOT SAY IT HERE. Native constraint validation surfaces only on a form
// submit or an explicit `reportValidity()`, and this admin has NO `<form>` anywhere — every
// screen says so in its own header, because one form would let Return in any box fire whichever
// route the nearest button belonged to. So `min`, `max`, `step` and `type="url"` were attributes
// the markup carried and nothing ever read: between ADR 0054 and 2026-09-15 a number outside its
// range was accepted without a word, `clampNumber` rewrote it on save, and the screen reported
// success. The owner typed 5 into a field whose floor is 10 and was told nothing at all.
//
// The React admin had checked on BLUR and that is kept: checking while somebody types tells them
// "3" is too short before they have finished typing "30".
//
// ⚠️ IT REPORTS, IT DOES NOT CORRECT. The value stays exactly as typed and the save still clamps
// it — the sentence is what was missing, not the clamp. Silently rewriting the box under the
// cursor is the other way to lose what somebody meant.
import { show } from './list-dom'

export type CheckWords = Partial<Record<string, string>>

/** The six answers, in the order the DOM settles them. Each one is a locale key already. */
function why(el: HTMLInputElement, w: CheckWords): string {
  const v = el.validity
  if (v.valid) return ''
  if (v.valueMissing) return w.fieldRequired ?? ''
  if (v.rangeUnderflow) return (w.fieldMin ?? '').replace('{n}', el.min)
  if (v.rangeOverflow) return (w.fieldMax ?? '').replace('{n}', el.max)
  if (v.typeMismatch && el.type === 'email') return w.fieldEmail ?? ''
  if (v.typeMismatch && el.type === 'url') return w.fieldUrl ?? ''
  // Everything else — a step that does not divide, a pattern that does not match — shares one
  // sentence, because naming the rule would mean naming it in eleven languages for each field.
  return w.fieldInvalid ?? ''
}

/**
 * Watch every field that can refuse a value, anywhere under `root`.
 *
 * Delegated and on the CAPTURE phase, because `blur` does not bubble. One listener rather than
 * one per field: rows come and go on this screen, and a listener added per element is a listener
 * this file would have to remember to take away.
 */
export function wireFieldChecks(root: HTMLElement, w: CheckWords): void {
  const settle = (el: HTMLInputElement): void => {
    const slot = root.querySelector<HTMLElement>(`[data-field-check="${CSS.escape(el.dataset.k ?? '')}"]`)
    if (!slot) return
    const said = why(el, w)
    slot.textContent = said
    show(slot, said !== '')
    // `aria-invalid` so a screen reader hears it too, and `aria-describedby` is not needed: the
    // line is `role="alert"`, which announces itself when it appears.
    if (said) el.setAttribute('aria-invalid', 'true')
    else el.removeAttribute('aria-invalid')
  }

  const looked = (e: Event): void => {
    const el = e.target
    if (el instanceof HTMLInputElement && el.dataset.k) settle(el)
  }
  root.addEventListener('blur', looked, true)
  // And on the way back to valid, so a corrected field stops complaining before it is left.
  root.addEventListener('input', (e) => {
    const el = e.target
    if (el instanceof HTMLInputElement && el.dataset.k && el.validity.valid) settle(el)
  })
}
