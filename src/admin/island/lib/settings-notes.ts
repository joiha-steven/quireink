// TWO THINGS ON THIS SCREEN THE SERVER CANNOT KNOW, and one it can but must not act on yet.
//
// ⚠️ BOTH WERE DRAWN AND READ BY NOTHING UNTIL 2026-09-15, and both are the quiet kind: the
// markup is correct, the page looks finished, and what is missing is only true.
import { show } from './list-dom'

export function wireNotes(screen: HTMLElement): void {
  originPath(screen)
  languageNote(screen)
}

/**
 * THE REDIRECT ADDRESS A COMMENT SIGN-IN NEEDS, whole.
 *
 * ⚠️ THE ORIGIN IS THE BROWSER'S, NOT A SETTING. A typo in what the owner pastes into Google's
 * console fails the flow AFTER the reader has left, on an error page on Google's side that names
 * no cause — so the address is shown rather than described. React read `location.origin`; the
 * server has no origin to read, so it ships the PATH and this writes the rest.
 *
 * Until this existed the owner was shown `/comment-auth/google/callback` and nothing else, which
 * is not an address and is refused by every console that asks for one.
 */
function originPath(screen: HTMLElement): void {
  for (const slot of screen.querySelectorAll<HTMLElement>('[data-origin-path]')) {
    const path = slot.textContent?.trim() ?? ''
    if (path.startsWith('/')) slot.textContent = `${location.origin}${path}`
  }
}

/**
 * WHICH OF TWO SENTENCES IS TRUE ABOUT THE LANGUAGE MENU.
 *
 * ⚠️ CHOOSING A LANGUAGE DOES NOT APPLY IT. It used to re-letter the whole admin on the change
 * event, before anything was stored, so somebody looking at what Vietnamese would be like got a
 * Vietnamese admin, an unsaved form, and a Save key they now had to find in a language they were
 * only trying on. Both sentences ship drawn and this picks — and until it did, the screen always
 * showed the first one, so a changed menu said "changes the interface language" while the admin
 * stayed in English with no explanation.
 */
function languageNote(screen: HTMLElement): void {
  const field = screen.querySelector<HTMLSelectElement>('[data-lang-field]')
  if (!field) return
  const pick = (): void => {
    const moved = field.value !== (field.dataset.saved ?? '')
    show(screen.querySelector('[data-lang-note-same]'), !moved)
    show(screen.querySelector('[data-lang-note-moved]'), moved)
  }
  field.addEventListener('change', pick)
  pick()
}
