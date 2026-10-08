// The sign-in page's only script.
//
// Both behaviours here are CONVENIENCES. The form is a real form with a method and an
// action, so sign-in works with this file blocked, failed or switched off — which matters
// more on this page than anywhere else on the site, because it is the one page you cannot
// route around.

import { passkeySignIn } from './passkey-signin'

/** Show/hide the password, and keep the button's label honest about what it will do. */
function reveal(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-reveal]')
  const input = document.querySelector<HTMLInputElement>('#password')
  if (button === null || input === null) return

  button.addEventListener('click', () => {
    const nowVisible = input.type === 'password'
    input.type = nowVisible ? 'text' : 'password'
    // The label describes the ACTION, so it is the opposite of the current state.
    button.setAttribute('aria-label', nowVisible ? button.dataset.hide ?? '' : button.dataset.show ?? '')
    // The icon follows the same rule; the sheet decides which glyph that means.
    button.toggleAttribute('data-shown', nowVisible)
    // Focus returns to the field with the caret where it was. Without this the button
    // keeps focus and the next keystroke goes nowhere.
    const at = input.value.length
    input.focus()
    input.setSelectionRange(at, at)
  })
}

/**
 * Warn about Caps Lock.
 *
 * `getModifierState` is the only reliable way: inferring it from the case of typed
 * characters fails for anyone whose password has no letters, and fails differently on
 * every keyboard layout.
 */
function capsLock(): void {
  const notice = document.querySelector<HTMLElement>('[data-caps]')
  const input = document.querySelector<HTMLInputElement>('#password')
  if (notice === null || input === null) return

  const update = (event: KeyboardEvent): void => {
    notice.hidden = !event.getModifierState('CapsLock')
  }
  input.addEventListener('keydown', update)
  input.addEventListener('keyup', update)
  // Hidden on blur: the warning is about what is being typed, and leaving it on screen
  // after the field is abandoned is just noise.
  input.addEventListener('blur', () => { notice.hidden = true })
}

/**
 * Let a pasted code submit itself.
 *
 * A six-digit code copied from a notification is a paste followed by a hunt for the
 * button. This removes the hunt, and only fires on a complete code, so it cannot submit
 * something half-entered.
 */
function otpPaste(): void {
  const input = document.querySelector<HTMLInputElement>('#code[inputmode="numeric"]')
  if (input === null) return

  input.addEventListener('input', () => {
    // Strip whatever the source wrapped it in: some apps copy "123 456".
    const digits = input.value.replace(/\D/g, '')
    if (digits !== input.value) input.value = digits
    if (digits.length === 6) input.form?.requestSubmit()
  })
}

/**
 * Fill the time zone on the first-run site step, from the one place that knows it.
 *
 * The server cannot: a page is rendered once and cached, so it would be guessing from
 * whoever asked first. Asking the owner to pick their own zone out of four hundred IANA
 * names is a worse question than not asking. The browser has the answer already.
 *
 * Only when the field is EMPTY. A blog that already has a zone set has an owner who chose
 * it, possibly deliberately different from the machine they happen to be sitting at, and
 * overwriting that would be the island deciding something it was not asked to decide.
 */
function timezone(): void {
  const input = document.querySelector<HTMLInputElement>('input[data-tz]')
  if (input === null || input.value !== '') return
  try {
    input.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  } catch {
    // An engine without a full ICU build has no zone to give. The field stays empty and
    // typeable, which is what it was before this function existed.
  }
}

/**
 * Switch the setup step's own language the moment it is picked.
 *
 * The select is a real form field and saves with the form either way; this only reloads
 * the page with `?lang=` so the QUESTIONS immediately speak the language that was just
 * chosen — a person who picked Русский should not have to finish setup in English. The
 * field sits first in the form, so nothing typed is lost to the reload.
 */
function setupLanguage(): void {
  const select = document.querySelector<HTMLSelectElement>('select[data-setup-lang]')
  if (select === null) return
  select.addEventListener('change', () => {
    const url = new URL(location.href)
    url.searchParams.set('lang', select.value)
    location.assign(url.toString())
  })
}

/**
 * The recovery-codes step: Continue waits for the box, and says so; Copy puts the codes on the
 * clipboard.
 *
 * Both are conveniences over a form that already works without script (the checkbox is `required`),
 * so the button is only disabled here, and the line that says why appears with it. Copy is shipped
 * hidden and shown only when this runs, so a blocked script never leaves a button that does nothing.
 * Where the clipboard API is refused (an http address, a locked-down browser) the codes are
 * SELECTED instead, which leaves the last step to the person's own copy shortcut.
 */
function recoveryCodes(): void {
  const box = document.querySelector<HTMLInputElement>('input[name="saved"]')
  const go = document.querySelector<HTMLButtonElement>('[data-needs-saved]')
  const why = document.querySelector<HTMLElement>('[data-needs-saved-why]')
  if (box !== null && go !== null) {
    const sync = (): void => {
      go.disabled = !box.checked
      if (why === null) return
      why.hidden = box.checked
      if (box.checked) go.removeAttribute('aria-describedby')
      else go.setAttribute('aria-describedby', why.id)
    }
    box.addEventListener('change', sync)
    sync()
  }

  const copy = document.querySelector<HTMLButtonElement>('[data-copy-codes]')
  const list = document.querySelector<HTMLElement>('.login-codes')
  if (copy === null || list === null) return
  copy.hidden = false
  const label = copy.textContent ?? ''
  const status = document.querySelector<HTMLElement>('[data-copy-status]')
  const select = (): void => {
    if (status !== null) status.textContent = copy.dataset.select ?? ''
    const range = document.createRange()
    range.selectNodeContents(list)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  copy.addEventListener('click', () => {
    const text = [...list.querySelectorAll('code')].map((c) => c.textContent ?? '').join('\n')
    const done = (): void => {
      const said = copy.dataset.done ?? label
      copy.textContent = said
      if (status !== null) status.textContent = said
      window.setTimeout(() => { copy.textContent = label; if (status !== null) status.textContent = '' }, 2000)
    }
    if (navigator.clipboard === undefined) { select(); return }
    navigator.clipboard.writeText(text).then(done, select)
  })
}

/**
 * `__Host-` cookies need a secure context, so on plain HTTP sign-in cannot finish. The
 * browser is the only thing that knows; the server sees plain HTTP behind every TLS proxy
 * too. `http://localhost` counts as secure, so a local trial is not warned at.
 */
if (!window.isSecureContext) document.querySelector('[data-insecure]')?.removeAttribute('hidden')

reveal()
capsLock()
otpPaste()
timezone()
setupLanguage()
recoveryCodes()
passkeySignIn()
