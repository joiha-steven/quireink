// THE ACCOUNT'S FOUR FLOWS: the password, the recovery codes, the second factor, and the devices
// that are signed in.
//
// ⚠️ NOTHING HERE IS A SETTING. Not one control in this card carries `data-k`, and that is the
// rule rather than an accident: `data-k` is what puts a value into the form's diff and into the
// payload the sheet's Save sends, and a password does not live in the settings record. They
// carry `data-sec-*` hooks, which `settings-form.ts` does not look at.
//
// ⚠️ EVERY ONE OF THESE ROUTES IS IRREVERSIBLE IN THE WAY THAT MATTERS. Changing the password
// signs out every other device; new recovery codes invalidate the old set, used or not;
// confirming a new authenticator replaces the old secret, so the app on the old phone stops
// working. Each one therefore asks for the CURRENT PASSWORD first — being signed in is not
// enough, because a stolen session is exactly the thing that must not be able to lock the owner
// out of their own blog.
//
// ⚠️ A SECRET IS SHOWN ONCE AND NEVER AGAIN. The recovery codes and the TOTP secret exist in
// the reply that mints them and nowhere else; the markup ships empty and this writes them in.
import type { SecurityWire } from '@/admin-shared/wire'
import { formatDateTimeShort } from '@/admin-shared/when'
import { say } from './media-bridge'

export type SecWords = Partial<Record<string, string>>

const show = (el: Element | null, on: boolean): void => {
  if (el instanceof HTMLElement) el.hidden = !on
}


export function wireSecurity(screen: HTMLElement, w: SecWords): void {
  const card = screen.querySelector<HTMLElement>('[data-security-current]')?.closest('section')
  if (!card) return
  const box = card as HTMLElement

  const current = (): string =>
    box.querySelector<HTMLInputElement>('[data-security-current]')?.value ?? ''

  /** Nothing in this card can be pressed until the current password is in the box beside it. */
  function arm(): void {
    const ready = current().length > 0
    for (const key of box.querySelectorAll<HTMLButtonElement>(
      '[data-sec-change], [data-sec-recovery], [data-sec-reenrol]')) {
      key.disabled = !ready
    }
  }

  box.addEventListener('input', (e) => {
    if ((e.target as HTMLElement).matches('[data-security-current]')) arm()
  })
  arm()

  async function post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch(`/api/security${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null)
    if (!res) { say(w.saveFailed ?? '', 'error'); return null }
    if (res.status === 401) {
      location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
      return null
    }
    const json = await res.json().catch(() => null) as { success?: boolean; error?: string; data?: Record<string, unknown> } | null
    if (!json?.success) {
      // The server's own refusals, in the words the card already carries: a wrong password, one
      // guess too many, a code that is not right, or a password the strength rule will not take.
      say(said(box, json?.error) || (w.saveFailed ?? ''), 'error')
      return null
    }
    return json.data ?? {}
  }

  /** The refusal sentences ride as attributes, because the island has no dictionary. */
  const said = (el: HTMLElement, code?: string): string =>
    code ? (el.dataset[`say${code.replace(/(^|_)([a-z])/g, (_, __, c: string) => c.toUpperCase())}`] ?? '') : ''

  // ---- the password -----------------------------------------------------------------------

  box.querySelector('[data-sec-change]')?.addEventListener('click', async () => {
    const next = box.querySelector<HTMLInputElement>('[data-sec-new]')
    if (!next?.value) return
    const out = await post('/password', { current: current(), next: next.value })
    if (!out) return
    next.value = ''
    const other = typeof out.signedOut === 'number' ? out.signedOut : 0
    say((w.passwordChanged ?? '').replace('{n}', String(other)))
    void refresh()
  })

  // ---- the recovery codes -----------------------------------------------------------------

  box.querySelector('[data-sec-recovery]')?.addEventListener('click', async () => {
    const out = await post('/recovery', { current: current() })
    if (!out) return
    const codes = Array.isArray(out.codes) ? out.codes as string[] : []
    const list = box.querySelector<HTMLElement>('[data-security-codes]')
    if (list) {
      // WRITTEN AS TEXT, one per row, because this is the only time they exist. A row is a
      // `<li>` the server never drew — there is no template for ten strings with no classes on
      // them beyond the list's own.
      list.replaceChildren(...codes.map((code) => {
        const li = document.createElement('li')
        li.textContent = code
        return li
      }))
    }
    show(box.querySelector('[data-sec-codes-panel]'), codes.length > 0)
    void refresh()
  })

  // ---- the second factor ------------------------------------------------------------------

  box.querySelector('[data-sec-reenrol]')?.addEventListener('click', async () => {
    const out = await post('/totp/start', { current: current() })
    if (!out) return
    const secret = box.querySelector<HTMLElement>('[data-sec-secret]')
    if (secret) secret.textContent = typeof out.secret === 'string' ? out.secret : ''
    show(box.querySelector('[data-sec-enrol]'), true)
  })

  box.querySelector('[data-sec-otp-confirm]')?.addEventListener('click', async () => {
    const code = box.querySelector<HTMLInputElement>('[data-sec-otp]')
    if (!code?.value) return
    const out = await post('/totp/confirm', { current: current(), code: code.value })
    if (!out) return
    code.value = ''
    show(box.querySelector('[data-sec-enrol]'), false)
    say(w.totpDone ?? '')
    void refresh()
  })

  box.querySelector('[data-sec-otp-close]')?.addEventListener('click', () => {
    show(box.querySelector('[data-sec-enrol]'), false)
  })

  // ---- the devices ------------------------------------------------------------------------

  box.addEventListener('click', (e) => {
    const end = (e.target as HTMLElement).closest<HTMLElement>('[data-sec-end]')
    const row = end?.closest<HTMLElement>('[data-security-session]')
    const id = row?.dataset.securitySession
    if (!id) return
    void fetch(`/api/security/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then((res) => {
        // Ending the CURRENT device is signing yourself out, and the honest answer to that is
        // the sign-in page rather than a row quietly disappearing.
        if (row.querySelector('[data-sec-this]:not([hidden])')) { location.href = '/login'; return }
        if (res.ok) row.remove()
        else say(w.saveFailed ?? '', 'error')
      })
      .catch(() => say(w.saveFailed ?? '', 'error'))
  })

  box.querySelector('[data-sec-signout-others]')?.addEventListener('click', async () => {
    const out = await post('/sessions/revoke-others', {})
    if (!out) return
    say((w.signedOut ?? '').replace('{n}', String(out.count ?? 0)))
    void refresh()
  })

  // ---- what the page could not know at render time ----------------------------------------

  /**
   * The devices, the code count and whether a second factor is on.
   *
   * None of it is in `settingsView()`: the React card fetched `/api/security` on mount and this
   * conversion does not change where the fact comes from, only who asks.
   */
  async function refresh(): Promise<void> {
    const res = await fetch('/api/security').catch(() => null)
    const json = await res?.json().catch(() => null) as { success?: boolean; data?: SecurityWire } | null
    if (!json?.success || !json.data) return
    const { sessions, recoveryLeft, totpEnabled } = json.data

    const note = box.querySelector<HTMLElement>('[data-sec-recovery-note]')
    if (note) note.textContent = (note.dataset.tpl ?? '').replace('{n}', String(recoveryLeft))

    show(box.querySelector('[data-sec-totp-on]'), totpEnabled)
    show(box.querySelector('[data-sec-totp-off]'), !totpEnabled)

    const list = box.querySelector<HTMLElement>('[data-sec-sessions]')
    const tpl = box.querySelector('template')
    if (!list || !tpl) return
    const rows = sessions.map((s) => {
      const clone = tpl.content.firstElementChild?.cloneNode(true)
      if (!(clone instanceof HTMLElement)) return null
      clone.dataset.securitySession = s.id
      const device = clone.querySelector<HTMLElement>('[data-sec-device]')
      if (device) device.textContent = s.device || device.textContent
      const seen = clone.querySelector<HTMLElement>('[data-sec-seen]')
      // THE ADMIN'S OWN STAMP, not string arithmetic on the field. `lastSeenAt` is epoch
      // milliseconds (`admin-shared/wire.ts`), and the same words the React card printed.
      if (seen) seen.textContent = formatDateTimeShort(s.lastSeenAt)
      show(clone.querySelector('[data-sec-this]'), s.current)
      show(clone.querySelector('[data-sec-end-this]'), s.current)
      show(clone.querySelector('[data-sec-end-other]'), !s.current)
      return clone
    }).filter((el): el is HTMLElement => el !== null)
    list.replaceChildren(...rows)
    show(box.querySelector('[data-sec-signout-others]'), sessions.filter((s) => !s.current).length > 0)
  }

  void refresh()
}
