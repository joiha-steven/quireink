// THE BOXES A SETTING SITS IN: the panel list, the inset, the curtain, and the card that owns
// its own key because it can TEST what it stores.
//
// Three ranks, and each is quieter than the one outside it (`docs/admin-design.md`: enclosure
// weakens inward) — card, group, list. The card and the group are in `fields.ts`; what is here
// is everything below and beside them.
import { escapeAttr, escapeHtml } from '@/utils'
import { buttonClass } from '@/admin-shared/kit'
import { NOTE_ALERT } from '@/admin-shared/scale'
import { lamp } from '@/web/admin/kit'
import { panelCard } from '@/web/admin/fields'

/** Rows with a rule between them and no edge of their own — the third rank. */
export const PANEL_LIST = 'panel-list -mx-4 divide-y divide-neutral-100 dark:divide-neutral-800'

/** A bordered box that is not a card: one radius step in, and no title row. */
export const PANEL = 'overflow-hidden rounded-lg border border-neutral-100 dark:border-neutral-800'

/** The same box with its own padding, for a stretch that needs setting apart inside a card. */
export const INSET = 'rounded-lg border border-neutral-100 p-4 dark:border-neutral-800'

export const panelList = (rows: string[] | string, tag: 'div' | 'ul' = 'div', attrs = ''): string =>
  `<${tag} class="${PANEL_LIST}"${attrs ? ` ${attrs}` : ''}>`
  + `${Array.isArray(rows) ? rows.join('') : rows}</${tag}>`

/**
 * A CURTAIN: a row that is in the DOM whether or not it applies.
 *
 * The height animates from `grid-template-rows: 0fr` to `1fr` in `admin.css`, and the inner
 * element owns the `overflow: hidden` that makes it a curtain rather than a clip. `aria-hidden`
 * and `inert` while closed, because the row is still there: without them a screen reader and the
 * Tab key both find a control nobody can see.
 */
export const reveal = (open: boolean, body: string, attrs = ''): string =>
  `<div class="admin-reveal"${open ? ' data-open' : ''} aria-hidden="${!open}"${open ? '' : ' inert'}`
  + `${attrs ? ` ${attrs}` : ''}><div>${body}</div></div>`

/** Two columns that stay two on a phone, for pairs that are read together. */
export const pairGrid = (body: string, cls = 'grid grid-cols-2 gap-3'): string =>
  `<div class="${cls}">${body}</div>`

/**
 * A CARD THAT REACHES SOMETHING, and so keeps its own key.
 *
 * The page's Save stores the ordinary settings keys wherever they are rendered; a card that can
 * TRY the far end is doing something that key cannot do, so it has one of its own and a lamp
 * that reports what the last attempt found (ADR 0041).
 *
 * ⚠️ AMBER BEATS GREEN. A card with unsaved edits is amber even when the thing it configures is
 * working, because the question the lamp answers is "is what I am looking at what is stored",
 * and the honest answer to that outranks "the far end replied".
 *
 * The lamp, the button's label and the refusal under it are all the island's to write; every one
 * of them ships drawn in the state the server can see. The refusal is `NOTE_ALERT`, which is the
 * one note style `[data-explanations=off]` does not hide — the reason something is broken is not
 * an explanation somebody chose to switch off.
 */
export function connectionCard(c: {
  title: string
  /** Which settings keys belong to this card, so the island knows when it is dirty. */
  keys: string[]
  state: 'good' | 'attention' | 'off'
  lampTitle: string
  /**
   * The card's OWN key, for a card that can TRY the far end.
   *
   * Left out, the card has no key of its own and the sheet's Save stores it like every other
   * field on the screen — which is what six of these eleven cards were already doing the long
   * way round: no route, no test, a partial of their own settings keys to the same endpoint the
   * sheet posts to, under a second Save key three inches from the first (2026-09-19). The card
   * keeps its lamp either way; the lamp answers "is what I see what is stored", which is a
   * question a card without a key still has.
   */
  saveLabel?: string
  body: string
  actions?: string
  /**
   * The card's OWN endpoint, for one that stores a CREDENTIAL rather than a setting.
   *
   * A credential does not live in the settings record — it lives in `integration_keys` — so
   * those cards post to their own route and send only the fields that were typed into. With no
   * route the card sends a partial of its own settings keys to `PUT /api/settings`.
   */
  route?: string
  attrs?: string
}): string {
  const foot = c.saveLabel
    ? `<div class="mt-5 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4`
      + ` dark:border-neutral-800">`
      + `<button type="button" data-card-save class="${buttonClass('primary', 'sm')}">`
      + `${escapeHtml(c.saveLabel)}</button></div>`
      + `<p class="${NOTE_ALERT} mt-2" data-card-error hidden></p>`
    : ''
  return panelCard({
    title: c.title,
    // ⚠️ THE OFF LAMP SHIPS HIDDEN. `kit.ts` states the rule — a lamp with nothing to say draws
    // nothing at all — and a card header is where it was being broken: a screen of twenty-two
    // cards drew grey marks on the handful that CAN report, so the eye read the mark itself as
    // the message and the colour as noise. Off is not news; the switch inside the card already
    // says it. Drawn and hidden rather than left out, because `setLamp` has to find it the
    // moment a save turns the card on.
    lampHtml: lamp({
      state: c.state, title: c.lampTitle,
      // `data-lamp-rest` is the state the SERVER drew, and it is what the island puts back when
      // a card stops being dirty. Without it an edit painted the lamp amber and nothing ever
      // painted it back: saving from the sheet's own key leaves the card's own save untouched,
      // so the amber outlived the change it was reporting.
      attrs: `data-card-lamp data-lamp-rest="${c.state}"`
        + ` data-lamp-rest-title="${escapeAttr(c.lampTitle)}"`
        + (c.state === 'off' ? ' hidden' : ''),
    }),
    actions: c.actions,
    body: c.body + foot,
    attrs: `data-card data-card-keys="${escapeAttr(c.keys.join(' '))}"`
      + (c.route ? ` data-card-route="${escapeAttr(c.route)}"` : '')
      + (c.attrs ? ` ${c.attrs}` : ''),
  })
}

/**
 * WHAT A LIST SAYS WHEN THE QUESTION BROKE, which is not what it says when the answer was empty.
 *
 * Three React components once rendered both as the same sentence, and a refused request printed
 * "nothing here" to somebody whose rows were all still on the server — a failure that reads as
 * a fact. The two lists on this screen that arrive after the page does (the MCP tokens and the
 * snapshots on disk) can both still fail that way, so both get this box and the island shows it
 * instead of the empty state.
 *
 * It ships drawn and hidden, like every other state under ADR 0054, and it carries its own way
 * out: a key that asks again IN PLACE. A failure whose only remedy is reloading the admin is a
 * failure that costs the owner every unsaved field on the screen.
 */
export const loadFailure = (t: { loadFailed: string; retry: string }, hook: string): string =>
  `<div class="rounded-lg border border-neutral-900 p-4 dark:border-white" ${hook} hidden>`
  + `<p class="text-sm text-neutral-700 dark:text-neutral-300">${escapeHtml(t.loadFailed)}</p>`
  + `<button type="button" data-load-retry class="${buttonClass('secondary', 'sm', 'mt-3')}">`
  + `${escapeHtml(t.retry)}</button></div>`
