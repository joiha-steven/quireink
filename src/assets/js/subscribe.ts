// Newsletter sign-up: the card at the foot of an article, and the header's overlay.
//
// The card is REAL: server-rendered, with a method and an action, and `/api/subscribe`
// answers a form post with an HTML page. So enhancing it is enhancement in the strict
// sense — with this file the reader stays on the article and sees the result inline;
// without it they get a page telling them to check their email. Neither path is broken.
//
// The header button is a different case. Its `href="#subscribe"` only lands on something at
// the foot of an ARTICLE, and the button is in the header of every page — so on a listing
// the fallback scrolls nowhere. The frozen tree solved that by having the overlay render its
// own copy of the form, and this does the same: same markup as `subscribeCard`, same
// handler, built on first open.

import { el, label, payload } from './dom'

/** Wire a form's submit to the API, so the reader never leaves the page. */
function enhance(form: HTMLFormElement): void {
  // The status line is a SIBLING of the form, inside the card. This used to look for it
  // inside the form, found nothing, and returned — so the in-page card was never enhanced
  // at all and every sign-up did a full page POST.
  const status = form.closest('.subscribe-card')?.querySelector<HTMLElement>('.subscribe-status')
  const button = form.querySelector<HTMLButtonElement>('button')
  if (!status || !button) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = new FormData(form)
    const email = data.get('email')
    if (typeof email !== 'string' || !email) return
    // The honeypot travels on this path too. It is empty for every human — the field has
    // no box — so forwarding it costs nothing and keeps a JS-running form filler caught.
    const website = data.get('website')

    button.disabled = true
    status.textContent = ''
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, website: typeof website === 'string' ? website : '' }),
      })
      const data = await payload<{ status?: string }>(res).catch(() => ({} as { status?: string }))
      if (!res.ok) {
        // 400 is a malformed address; anything else is the server's problem, not the
        // reader's, and saying "check your address" for a 500 sends them looking for a
        // typo that is not there.
        status.textContent = res.status === 400 ? label('nlInvalid') : label('nlError')
        return
      }
      // "Already subscribed" deliberately reads the same as a fresh sign-up. The server
      // does not distinguish them either, so that the endpoint cannot be used to test
      // whether a given address reads this blog.
      status.textContent = data.status === 'pending_no_mail' ? label('nlNoMail') : label('nlSuccess')
      form.reset()
    } catch {
      status.textContent = label('nlError')
    } finally {
      button.disabled = false
    }
  })
}

/** The same card `subscribeCard` renders, built client-side for the overlay. */
function card(): HTMLElement {
  const input = el('input', {
    type: 'email', name: 'email', required: '',
    'aria-label': label('nlPlaceholder'), placeholder: label('nlPlaceholder'),
  })
  const form = el('form', { class: 'subscribe', method: 'post', action: '/api/subscribe' },
    input, el('button', { type: 'submit' }, label('nlButton')),
    // The same honeypot the server-rendered card carries (see chrome.ts).
    el('input', { class: 'hp', type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }))
  const section = el('section', { class: 'subscribe-card' },
    el('h2', {}, label('nlHeading')), form, el('p', { class: 'subscribe-status', role: 'status' }))
  enhance(form)
  return section
}

function overlay(): void {
  const trigger = document.querySelector<HTMLAnchorElement>('[data-subscribe-open]')
  if (!trigger) return
  let dialog: HTMLDialogElement | null = null

  trigger.addEventListener('click', (e) => {
    e.preventDefault() // the href stays a working fallback for a middle-click or no JS
    if (dialog) {
      dialog.showModal()
      return
    }
    // A `<dialog>`, so Escape, the focus trap and the inert background are the browser's —
    // the same choice search and book mode make.
    const next = document.createElement('dialog')
    next.className = 'overlay subscribe-overlay'
    next.append(card())
    next.addEventListener('click', (ev) => { if (ev.target === next) next.close() })
    document.body.appendChild(next)
    dialog = next
    next.showModal()
    next.querySelector('input')?.focus()
  })
}

export function subscribe(): void {
  // The overlay goes on FIRST, and the two are independent. They are separate enhancements
  // of separate controls, and one must not be able to take the other out: with the in-page
  // card enhanced first, the header button worked on every listing and on no article, which
  // is precisely the shape of one enhancement disabling the other.
  overlay()
  const inPage = document.querySelector<HTMLFormElement>('form.subscribe')
  if (inPage) enhance(inPage)
}
