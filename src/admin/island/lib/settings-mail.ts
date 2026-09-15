// THE SMTP CARD, which is the one card on this screen the server cannot draw filled.
//
// Everything else in Settings arrives finished (ADR 0054). This card's values are not in the
// site record at all — they are a credential set behind `GET /api/mail`, and the password never
// comes back from it — so the card ships as a waiting line with the form hidden behind it, the
// way React drew it, and this fills it in.
//
// ⚠️ THE WAITING LINE IS NOT THE EMPTY STATE. Until 2026-09-15 nothing wired this card and it
// said "Loading..." forever: every SMTP field the owner had stored was invisible on the screen
// whose job is showing them, and the only symptom was a word that is supposed to be brief.
//
// ⚠️ NO SECRET COMES BACK. `/api/mail` answers `hasPass`, never `pass`. A stored password shows
// as a placeholder in an EMPTY box, because a blank credential field means KEEP — sending the
// dots back would store the dots.
import type { MailWire } from '@/admin-shared/wire'
import { setLamp } from './settings-cards'

export type MailWords = Partial<Record<string, string>>

/**
 * Implicit TLS is a port-465 thing; 587 and 25 speak STARTTLS and must be sent in the clear
 * first. Getting the pair wrong fails with an opaque OpenSSL "wrong version number", so the
 * port drives the tick instead of leaving the two to drift apart.
 */
const secureForPort = (port: number): boolean => port === 465

const field = (card: HTMLElement, name: string): HTMLInputElement | null =>
  card.querySelector<HTMLInputElement>(`[data-card-field="${name}"]`)

export function wireMail(screen: HTMLElement, w: MailWords): void {
  const found = screen.querySelector<HTMLElement>('[data-mail-card]')
  if (!found) return
  const card: HTMLElement = found

  const tick = field(card, 'secure')
  const port = field(card, 'port')
  const host = field(card, 'host')

  /** The unusual pair, SAID rather than prevented: a port and a tick that disagree. */
  const mismatch = (): void => {
    const note = card.querySelector<HTMLElement>('[data-mail-tls]')
    if (!note || !tick || !port) return
    note.hidden = tick.checked === secureForPort(Number(port.value) || 0)
  }

  // The port is what moves the tick, never the other way round, because the port is the fact
  // the far end has an opinion about.
  port?.addEventListener('input', () => {
    if (tick) tick.checked = secureForPort(Number(port.value) || 587)
    mismatch()
  })
  tick?.addEventListener('change', mismatch)

  /**
   * ⚠️ NARROWED, NOT MERELY TRUTHY. Whatever came off the wire is read in five places here, so
   * anything that is not the shape this card knows leaves it in its waiting state rather than
   * throwing halfway through filling it — which would show a half-drawn form and no way to tell
   * that is what happened.
   */
  async function fill(): Promise<void> {
    const res = await fetch('/api/mail').catch(() => null)
    if (res?.status === 401) {
      location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
      return
    }
    const json = await res?.json().catch(() => null) as { success?: boolean; data?: MailWire } | null
    const cfg = json?.success ? json.data : null
    if (!cfg || typeof cfg.host !== 'string') {
      const waiting = card.querySelector<HTMLElement>('[data-mail-loading]')
      if (waiting) waiting.textContent = w.loadFailed ?? waiting.textContent
      return
    }

    if (host) host.value = cfg.host
    if (port) port.value = String(cfg.port)
    const user = field(card, 'user')
    if (user) user.value = cfg.user
    const from = field(card, 'from')
    if (from) from.value = cfg.from
    if (tick) tick.checked = cfg.secure
    // A stored password is a PLACEHOLDER on an empty box. `data-was` stays empty with it, so
    // the sheet's own diff never counts a password nobody typed.
    const pass = field(card, 'pass')
    if (pass) pass.placeholder = cfg.hasPass ? '••••••••' : ''

    // ⚠️ `defaultValue` TOO, not just `value`. The sheet's diff reads what a field WAS off the
    // browser's own baseline (`settings-form.ts`), and a value written by script moves `value`
    // while leaving `defaultValue` at the empty string the server shipped — so every filled box
    // on this card would read as an unsaved edit the moment the page settled, and the leave
    // question would ask about work nobody did.
    for (const el of card.querySelectorAll<HTMLInputElement>('[data-card-field]')) {
      if (el.type === 'checkbox') el.defaultChecked = el.checked
      else el.defaultValue = el.value
    }

    mismatch()
    show(card.querySelector('[data-mail-loading]'), false)
    show(card.querySelector('[data-mail-form]'), true)
    // THREE STATES, not two, and the middle one is the point. No host at all is OFF: an install
    // with no mail is not broken, it is a blog with no newsletter, and lighting a lamp for it
    // would be a lie. A host that is not yet a working configuration is AMBER — something to
    // finish — and only a complete one is green. React's `ConnectionCard` drew exactly these
    // three from `enabled` and `connected`.
    // ⚠️ FOUR STATES NOW, and the new one is not a fault. `SMTP_OFF=1` means this machine is
    // not ALLOWED to send: every field is right and nothing is unfinished, so the amber
    // "something to finish" lamp would send somebody looking for a setting that is already
    // correct. It reads as OFF, with the reason printed beside it.
    const off = cfg.blocked === 'smtp_off'
    const state = off || !cfg.host.trim() ? 'off' : cfg.configured ? 'good' : 'attention'
    const said = off
      ? w.mailSwitchedOff
      : state === 'good' ? w.connectionOk : state === 'off' ? w.connectionOff : w.connectionUntested
    setLamp(card.querySelector('[data-card-lamp]'), state, said ?? '')
    const key = card.querySelector<HTMLElement>('[data-card-save]')
    if (key && cfg.host.trim() && w.saveAndTest) key.textContent = w.saveAndTest
  }

  void fill()
}

const show = (el: Element | null, on: boolean): void => {
  if (el instanceof HTMLElement) el.hidden = !on
}
