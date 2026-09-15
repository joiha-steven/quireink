// THE ADMIN'S OWN WAY OF ASKING BEFORE SOMETHING IS LOST, and the replacement for
// `window.confirm`.
//
// Twenty native prompts were counted in `src/admin` on 2026-09-07 — sixteen `confirm()` and
// four `prompt()` — and every one cost the same three things. The browser draws them, so a
// dialog that decides whether a post is destroyed forever wears none of this product's grammar.
// They name nothing: `confirm()` takes one string, so "Delete this?" is the whole question and
// the title of the thing being deleted is left to whatever row the pointer was over. And they
// BLOCK the main thread for as long as somebody thinks about it.
//
// It carries a THIRD answer as well as yes and no, because leaving a screen with unsaved work
// is a three-way question — save, discard, stay — and a two-button dialog answers it by
// throwing one of the three away.
//
// ⚠️ THE ASK ARRIVES AS AN EVENT and `cancelable` is how the caller learns whether anybody was
// listening: no `preventDefault` means no dialog, and the caller falls back to the browser's own
// question rather than deleting something in silence.
export type ConfirmAnswer = 'confirm' | 'alt' | 'cancel'

export type ConfirmRequest = {
  /** Names the OBJECT, not the action: "Delete 'Notes on a printing glossary' forever?" */
  title: string
  /** What happens, in one sentence. */
  body?: string
  confirmLabel: string
  cancelLabel: string
  /** A third answer, between the two — "Save" beside "Discard" and "Stay". */
  altLabel?: string
  /** Whether the yes button is the red ballpoint. True whenever the answer destroys something. */
  danger?: boolean
  /** Ask for a VALUE as well as an answer — the replacement for `window.prompt`. */
  input?: { label: string; initial?: string; placeholder?: string }
}

export function wireConfirm(): () => void {
  const at = <T extends HTMLElement>(hook: string): T | null => document.querySelector<T>(hook)
  const box = at('[data-confirm]')
  const scrim = at('[data-confirm-scrim]')
  const title = at('[data-confirm-title]')
  const body = at('[data-confirm-body]')
  const form = at<HTMLFormElement>('[data-confirm-form]')
  const label = at('[data-confirm-label]')
  const field = at<HTMLInputElement>('[data-confirm-input]')
  const no = at<HTMLButtonElement>('[data-confirm-no]')
  const alt = at<HTMLButtonElement>('[data-confirm-alt]')
  const yesPlain = document.querySelector<HTMLButtonElement>('[data-confirm-yes]:not([data-confirm-danger])')
  const yesDanger = at<HTMLButtonElement>('[data-confirm-yes][data-confirm-danger]')
  if (!box || !title || !no || !yesPlain || !yesDanger) return () => {}

  let settle: ((answer: ConfirmAnswer, value: string) => void) | null = null
  let opener: HTMLElement | null = null

  const answer = (a: ConfirmAnswer): void => {
    const done = settle
    settle = null
    box.hidden = true
    if (scrim) scrim.hidden = true
    opener?.focus()
    done?.(a, field?.value ?? '')
  }

  const ask = (req: ConfirmRequest, respond: (a: ConfirmAnswer, value: string) => void): void => {
    // A question asked over an open one answers the first as a refusal: two dialogs on one
    // screen is a state this admin has no drawing for, and a caller left waiting for ever is
    // worse than one told no.
    if (settle) answer('cancel')
    settle = respond
    opener = document.activeElement as HTMLElement | null

    title.textContent = req.title
    if (body) {
      body.textContent = req.body ?? ''
      body.hidden = !req.body
    }
    if (form && label && field) {
      form.hidden = !req.input
      label.textContent = req.input?.label ?? ''
      field.value = req.input?.initial ?? ''
      if (req.input?.placeholder) field.setAttribute('placeholder', req.input.placeholder)
      else field.removeAttribute('placeholder')
    }
    no.textContent = req.cancelLabel
    if (alt) {
      alt.textContent = req.altLabel ?? ''
      alt.hidden = !req.altLabel
    }
    const yes = req.danger ? yesDanger : yesPlain
    const quiet = req.danger ? yesPlain : yesDanger
    yes.textContent = req.confirmLabel
    yes.hidden = false
    quiet.hidden = true

    if (scrim) scrim.hidden = false
    box.hidden = false
    // ⚠️ FOCUS OPENS ON THE SAFE ANSWER, never on the destructive one: a dialog that opens with
    // Delete focused turns a stray Return — the key somebody was already pressing to submit the
    // form behind it — into a deletion. Unless there is a field, which is what was asked for.
    if (req.input && field) { field.focus(); field.select() }
    else no.focus()
  }

  no.addEventListener('click', () => answer('cancel'))
  alt?.addEventListener('click', () => answer('alt'))
  for (const key of [yesPlain, yesDanger]) key.addEventListener('click', () => answer('confirm'))
  // A click off the sheet is "not now" — the same reading the attributes panel gives it.
  scrim?.addEventListener('click', () => answer('cancel'))
  form?.addEventListener('submit', (e) => { e.preventDefault(); answer('confirm') })

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !settle) return
    e.preventDefault()
    answer('cancel')
  }
  document.addEventListener('keydown', onKey)

  const onAsk = (e: Event): void => {
    const detail = (e as CustomEvent<{
      request?: ConfirmRequest
      respond?: (a: ConfirmAnswer, value?: string) => void
    }>).detail
    if (!detail?.request || typeof detail.respond !== 'function') return
    e.preventDefault()
    // ⚠️ THE TYPED VALUE TRAVELS BACK TOO, as a second argument every yes/no caller ignores.
    // Without it the one question that HAS an answer — renaming a category is a dialog with a
    // field in it — could only report that somebody pressed Save.
    ask(detail.request, (a, value) => detail.respond?.(a, value))
  }
  window.addEventListener('quire:confirm', onAsk)

  return () => {
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('quire:confirm', onAsk)
  }
}
