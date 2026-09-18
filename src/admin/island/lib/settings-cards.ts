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
import { applyLiveGates } from './settings-controls'

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
      // ⚠️ A CARD CAN HOLD BOTH, and this was an either/or until 2026-09-15. The AI card stores
      // a credential at its own endpoint AND `ai.commentGuard` in the settings record, and its
      // own comment said "the card's Save now writes both, credentials first" while the code
      // wrote whichever one the route decided. Credentials go first, because a job switched on
      // against a key that did not store is a switch pointing at nothing.
      const sent = route ? await postCard(card, route) : { ok: true }
      const res = sent.ok ? await saveKeys(card, fields()) : sent
      if (res.ok) {
        settle(ownFields(card, fields()))
        // What is in the boxes now IS what is stored — including the password boxes `postCard`
        // has just cleared — so this is the new baseline. Without it the card would stay amber
        // for the rest of the page's life over an edit it had already saved.
        remember(card)
        // And the blocks that wait for a SAVED answer can open now, for the same reason: this
        // is the moment the form and the record agree. See `applyLiveGates`.
        applyLiveGates(card)
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

  /**
   * The card's own settings keys, if it has any.
   *
   * ⚠️ AN EMPTY PARTIAL IS "NOTHING TO SAY", NOT "SAVED". It answers ok so a credential card
   * with no settings keys does not report a failure — but on a card with a route that is only
   * true because the credentials went out above. Before the route existed on the three keys
   * cards, this was the WHOLE of their save: no fields, an empty partial, `ok: true`, and a
   * green lamp over a token that was never sent anywhere.
   */
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
    // ⚠️ AND A STORED CREDENTIAL SHIPS AS AN EMPTY BOX. The gate asks whether the field is
    // filled in, which is right for a card nobody has configured and wrong for every card that
    // already works: blank means KEEP, so on an install with a bucket the gate field was empty,
    // the test never ran, and the key that says "Save and test" went green saying the far end
    // had answered. A rotated secret would be reported as verified and discovered at the one
    // moment it matters. `data-card-test-stored` is the server's answer to "is there something
    // at the far end already", which is the question the gate meant to ask.
    const needs = card.dataset.cardTestWhen
    if (needs && card.dataset.cardTestStored === undefined) {
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

  /**
   * What the server drew in every credential box, so an edit to one can be seen.
   *
   * ⚠️ THE LAMP COULD NOT GO AMBER ON A CREDENTIAL CARD, which is this file's own first rule:
   * "A card with unsaved edits is amber even when the thing it configures is working." The
   * repaint below only looked at `[data-k]` settings controls and gave up on a card with none
   * — and a credential box deliberately carries no `data-k`, because it posts to its own
   * endpoint. So every card that holds a key (Cloudflare, the off-server copy, SMTP, the
   * comment keys) stayed green through any amount of typing. Paste a key, get distracted,
   * navigate away, and nothing on the screen had said it was unsaved.
   *
   * Compared against what was RENDERED rather than against `defaultValue`, because a `<select>`
   * has no such property and the AI card's provider menu is one.
   */
  const drawn = new Map<Element, string>()
  const boxes = (card: ParentNode) =>
    card.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-card-field]')
  const remember = (root: ParentNode) => { for (const el of boxes(root)) drawn.set(el, el.value) }
  remember(screen)

  /** A card goes amber the moment it holds an edit nobody has stored. */
  screen.addEventListener('input', () => repaint())
  screen.addEventListener('change', () => repaint())
  screen.addEventListener('click', () => repaint())

  function edited(card: HTMLElement): boolean {
    for (const el of boxes(card)) if (el.value !== (drawn.get(el) ?? '')) return true
    return false
  }

  function repaint(): void {
    for (const card of screen.querySelectorAll<HTMLElement>('[data-card]')) {
      const roots = (card.dataset.cardKeys ?? '').split(' ').filter(Boolean)
      const dirty = (roots.length > 0 && changedIn(fields(), ...roots)) || edited(card)
      if (!dirty) continue
      setLamp(card.querySelector('[data-card-lamp]'), 'attention', w.connectionDirty ?? '')
    }
  }
}
