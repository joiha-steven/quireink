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
  // Off says nothing a card header needs to say, so it shows nothing — the same rule the
  // server draws by (`connectionCard` in `web/admin/fields-box.ts`). Hidden rather than
  // removed: the next save may turn the card on, and this is the element that reports it.
  el.hidden = state === 'off'
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
/**
 * WHAT A GREEN LAMP MAY SAY, once a card's own Save has come back without an error.
 *
 * Three different silences end the same colour, and only one of them is a reply:
 *  - `asked` — a test route was called and it answered. The ONLY case anything may say so.
 *  - a far end nobody asked (the gate found nothing to try, or the card stores a credential
 *    without testing it) — saved, not tried.
 *  - no far end at all (a switch, and nothing behind it) — on.
 *
 * Extracted and named because the choice is the whole of the fix and the alternative was a
 * ternary buried in a click handler, which needs a DOM and a network to assert.
 */
export const goodTitle = (
  w: CardWords, asked: boolean, hasFarEnd: boolean,
): string => (asked ? w.connectionOk : hasFarEnd ? w.connectionUntested : w.connectionOn) ?? ''

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
      const sent = route ? await postCard(card, route) : { ok: true, asked: false }
      // Kept before the next line, which is allowed to replace `sent` with the settings save's
      // own answer and would drop it.
      const asked = sent.asked === true
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
        // ⚠️ GREEN EITHER WAY, BUT NOT THE SAME SENTENCE. A card that tested and passed is the
        // one case anything here may say the far end answered. A card that only stored is green
        // too — there was nothing at the far end to be wrong about — and it says which of the
        // two silences it is: a card that HAS a far end nobody asked is "saved, not tried yet",
        // and a card with no far end at all is simply on.
        setLamp(lamp, 'good', goodTitle(w, asked, card.dataset.cardTest !== undefined))
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
  async function postCard(
    card: HTMLElement, route: string,
  ): Promise<{ ok: boolean; error?: string; asked?: boolean }> {
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
    return tried(card, toLogin)
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

  /**
   * ⚠️ AND IT PAINTS BACK. Going amber was all this did until 2026-09-19, which held while every
   * card had a key of its own to put the lamp right again. Six of them have none — the sheet's
   * Save stores them — so an edit lit the lamp and nothing ever put it out: the card read
   * "you have unsaved work here" for the rest of the session over a change that was stored
   * seconds later. The lamp goes back to the state the server drew it in, which rides on the
   * mark itself as `data-lamp-rest`.
   */
  function repaint(): void {
    for (const card of screen.querySelectorAll<HTMLElement>('[data-card]')) {
      const roots = (card.dataset.cardKeys ?? '').split(' ').filter(Boolean)
      const dirty = (roots.length > 0 && changedIn(fields(), ...roots)) || edited(card)
      const mark = card.querySelector<HTMLElement>('[data-card-lamp]')
      if (dirty) { setLamp(mark, 'attention', w.connectionDirty ?? ''); continue }
      const rest = mark?.dataset.lampRest
      if (rest === 'good' || rest === 'attention' || rest === 'off') {
        setLamp(mark, rest, mark?.dataset.lampRestTitle ?? '')
      }
    }
  }
}

/**
 * STORING IS NOT SENDING (ADR 0041), so a card that can try its far end does — and this reports
 * whether it actually did. `toLogin` is an argument rather than a closed-over helper so that the
 * three answers below can be asserted without a page: they are the whole of what the lamp's
 * sentence turns on, and two of them are successes that asked nobody anything.
 */
export async function tried(
  card: HTMLElement, toLogin: () => void,
): Promise<{ ok: boolean; error?: string; asked?: boolean }> {
  const route = card.dataset.cardTest
  // ⚠️ `asked` IS WHAT THE LAMP'S SENTENCE TURNS ON, and the two `{ ok: true }` answers below
  // are the ones that make it necessary: both mean "nothing went wrong", and neither means
  // anybody replied. Reported as green with "the far end answered" they were a claim about a
  // service this code had not contacted.
  if (!route) return { ok: true, asked: false }
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
    if (!gateField?.value.trim()) return { ok: true, asked: false }
  }
  const res = await fetch(route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: card.dataset.cardTestBody ?? '{}',
  })
  if (res.status === 401) { toLogin(); return { ok: false } }
  const json = await res.json().catch(() => null) as { success?: boolean; error?: string } | null
  return { ok: Boolean(json?.success), error: json?.error, asked: true }
}
