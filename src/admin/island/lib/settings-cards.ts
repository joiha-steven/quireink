// A CARD THAT REACHES SOMETHING, and so keeps its own key.
//
// The sheet's Save stores the ordinary settings keys wherever they are rendered. A card that can
// TRY the far end is doing something that key cannot do, so it has one of its own, a lamp that
// reports what the last attempt found, and a refusal line under it (ADR 0041).
//
// ⚠️ AMBER BEATS GREEN, and the order is the decision. A card with unsaved edits is amber even
// when the thing it configures is working, because the question the lamp answers is "is what I
// am looking at what is stored", and the honest answer to that outranks "the far end replied".
//
// ⚠️ WRITE-TO-SET SECRETS. A blank credential field means KEEP, never wipe. Only non-empty
// fields are sent, which is why a stored key ships as an empty box with a placeholder rather
// than as dots: sending the dots back would store the dots.
import { LAMP_HUES, LAMP_SHAPE } from '@/admin-shared/kit'
import { changedIn, partialOf, settle, type Field } from './settings-form'

export type CardWords = Partial<Record<string, string>>

export type Lamp = 'good' | 'attention' | 'off'

export const setLamp = (el: Element | null, state: Lamp, title: string): void => {
  if (!(el instanceof HTMLElement)) return
  el.className = `${LAMP_SHAPE} ${LAMP_HUES[state]}`
  if (title) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', title); el.title = title }
}

const show = (el: Element | null, message: string): void => {
  if (!(el instanceof HTMLElement)) return
  el.textContent = message
  el.hidden = message === ''
}

/**
 * One card's own save.
 *
 * Two shapes go out of here. A card of ordinary settings keys sends a partial of just ITS keys
 * to `PUT /api/settings` — the endpoint deep-merges, which is what lets one screen hold
 * twenty-two cards and still send only what moved. A card that stores a CREDENTIAL posts to its
 * own route instead, because a credential is not a setting and does not live in that record.
 */
export function wireCards(screen: HTMLElement, fields: () => Field[], w: CardWords, after: () => void): void {
  screen.addEventListener('click', (e) => {
    const key = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-card-save]')
    const card = key?.closest<HTMLElement>('[data-card]')
    if (!key || !card) return
    void run(card, key)
  })

  async function run(card: HTMLElement, key: HTMLButtonElement): Promise<void> {
    const lamp = card.querySelector('[data-card-lamp]')
    const error = card.querySelector('[data-card-error]')
    const route = card.dataset.cardRoute
    const label = key.textContent
    key.disabled = true
    key.textContent = w.saving ?? ''
    show(error, '')
    try {
      const res = route ? await postCard(card, route) : await saveKeys(card, fields())
      if (res.ok) {
        settle(ownFields(card, fields()))
        // A card that TESTED and passed is green; one that only stored is green too, because
        // there was nothing at the far end to be wrong about.
        setLamp(lamp, 'good', w.connectionOk ?? '')
        after()
      } else {
        setLamp(lamp, 'attention', w.connectionBad ?? '')
        show(error, res.error || (w.saveFailed ?? ''))
      }
    } catch {
      setLamp(lamp, 'attention', w.connectionBad ?? '')
      show(error, w.saveFailed ?? '')
    } finally {
      key.disabled = false
      key.textContent = label
    }
  }

  /** The fields this card owns, by the top-level names the server wrote on it. */
  function ownFields(card: HTMLElement, all: Field[]): Field[] {
    const roots = (card.dataset.cardKeys ?? '').split(' ').filter(Boolean)
    const inside = new Set(card.querySelectorAll<HTMLElement>('[data-k]'))
    return all.filter((el) => inside.has(el)
      || roots.some((r) => el.dataset.k === r || (el.dataset.k ?? '').startsWith(`${r}.`)))
  }

  async function saveKeys(card: HTMLElement, all: Field[]): Promise<{ ok: boolean; error?: string }> {
    const partial = partialOf(ownFields(card, all))
    if (Object.keys(partial).length === 0) return { ok: true }
    const res = await fetch('/api/settings', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(partial),
    })
    if (res.status === 401) { toLogin(); return { ok: false } }
    const json = await res.json() as { success?: boolean; error?: string }
    return { ok: Boolean(json.success), error: json.error }
  }

  /**
   * A card with a route of its own: every non-empty field it holds, by the name on it.
   *
   * ⚠️ ONLY THE NON-EMPTY ONES. A blank credential box means "leave the stored one alone", and
   * `saveIntegrationKeys` reads an empty string as "clear it" — so sending every box would wipe
   * a key the moment anybody saved a card without retyping it.
   */
  async function postCard(card: HTMLElement, route: string): Promise<{ ok: boolean; error?: string }> {
    const body: Record<string, unknown> = {}
    for (const el of card.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-card-field]')) {
      const name = el.dataset.cardField
      if (!name) continue
      const value = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value
      if (value === '' ) continue
      // ⚠️ A NUMBER WHERE THE ROUTE READS A NUMBER. `type="number"` still hands back a STRING,
      // and a route that narrows with `typeof input.port === 'number'` drops it without a word:
      // the field looks saved, the card goes green, and the port is whatever it was before.
      // The field says which of the two it is, because only the route knows.
      body[name] = el.dataset.cardFieldNumber !== undefined && typeof value === 'string'
        ? Number(value)
        : value
    }
    const res = await fetch(route, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.status === 401) { toLogin(); return { ok: false } }
    const json = await res.json() as { success?: boolean; error?: string }
    // A credential that stored is no longer typed into: clearing the box is what makes the
    // placeholder ("a key is stored") true again, and what stops the next save resending it.
    if (json.success) {
      for (const el of card.querySelectorAll<HTMLInputElement>('[data-card-field][type=password]')) el.value = ''
    }
    if (!json.success) return { ok: false, error: json.error }
    return tried(card)
  }

  /**
   * STORING IS NOT SENDING (ADR 0041), so a card that can try its far end does.
   *
   * "Why did my newsletter not send" was the question the SMTP card could not answer: it had a
   * Save key, a success toast, and no way to find out that port 587 was blocked or that the
   * password had gone stale. The test route's own sentence is what gets shown — "535
   * authentication failed" is a password and "ENOTFOUND" is a hostname, and neither survives
   * being renamed "Could not save".
   *
   * ⚠️ ONLY WITH SOMETHING TO TRY. `data-card-test-when` names the field that has to be filled
   * in first: an install with no mail host is not broken, it is a blog with no newsletter, and
   * lighting the lamp for it would be a lie.
   */
  async function tried(card: HTMLElement): Promise<{ ok: boolean; error?: string }> {
    const route = card.dataset.cardTest
    if (!route) return { ok: true }
    const needs = card.dataset.cardTestWhen
    if (needs) {
      const gateField = card.querySelector<HTMLInputElement>(`[data-card-field="${needs}"]`)
      if (!gateField?.value.trim()) return { ok: true }
    }
    const res = await fetch(route, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: card.dataset.cardTestBody ?? '{}',
    })
    if (res.status === 401) { toLogin(); return { ok: false } }
    const json = await res.json().catch(() => null) as { success?: boolean; error?: string } | null
    return { ok: Boolean(json?.success), error: json?.error }
  }

  const toLogin = (): void => {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
  }

  /** A card goes amber the moment it holds an edit nobody has stored. */
  screen.addEventListener('input', () => repaint())
  screen.addEventListener('click', () => repaint())

  function repaint(): void {
    for (const card of screen.querySelectorAll<HTMLElement>('[data-card]')) {
      const roots = (card.dataset.cardKeys ?? '').split(' ').filter(Boolean)
      if (roots.length === 0) continue
      const dirty = changedIn(fields(), ...roots)
      if (!dirty) continue
      setLamp(card.querySelector('[data-card-lamp]'), 'attention', w.connectionDirty ?? '')
    }
  }
}
