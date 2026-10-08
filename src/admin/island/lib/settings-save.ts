// STORING THE FORM, and the question it asks when somebody tries to walk away from it.
//
// ⚠️ THE THREE-WAY QUESTION SURVIVES THE CONVERSION, and it very nearly did not.
// `docs/admin-one-dom.md` records that a converted screen's links are real navigations, so
// leaving a dirty form would raise the BROWSER's generic warning — a dialog with two buttons,
// neither of which can save. That is a real loss on the one screen in the admin where leaving
// without saving throws away work.
//
// So this island catches the click itself. Every anchor into `/admin` is intercepted while the
// form is dirty, the product's own question is asked through `quire:confirm`, and only then does
// the navigation happen. `beforeunload` stays underneath it for the ways out a click handler
// cannot see: a typed address, a closed tab, a reload.
import type { SiteLang } from '@/types'
import { plural } from '@/i18n/plural'
import { changedCount, fieldsIn, partialOf, settle, type Field } from './settings-form'
import { applyLiveGates } from './settings-controls'
import { show } from './list-dom'
import { isoToZonedInput } from '@/utils'
import { pageZone } from './page-lang'

export type SaveWords = Partial<Record<string, string>>

const say = (message: string, kind?: 'error'): void => {
  window.dispatchEvent(new CustomEvent('quire:toast', { detail: { message, kind } }))
}

/** `HH:mm`, because the useful fact a minute later is the time and not the word "saved". */
const clock = (): string => {
  // The site's clock, like the stamps the server drew on this screen.
  return isoToZonedInput(new Date().toISOString(), pageZone()).slice(11, 16)
}

/**
 * The server's refusal, said under the field it names — the same line `field-check.ts` fills on
 * blur, so a refused address reads exactly like a number below its floor. Fields with no such
 * line (the repository name keeps its own) still get the toast and the focus.
 */
function refuseUnder(screen: HTMLElement, k: string, said: string): void {
  const slot = screen.querySelector<HTMLElement>(`[data-field-check="${CSS.escape(k)}"]`)
  if (!slot) return
  slot.textContent = said
  show(slot, said !== '')
  const field = screen.querySelector<HTMLElement>(`[data-k="${CSS.escape(k)}"]`)
  field?.setAttribute('aria-invalid', 'true')
  // Held until the value is edited: `field-check.ts` would otherwise clear it on the next blur,
  // since the browser may call this value valid (`ftp://…`).
  if (field) field.dataset.refused = ''
}

/** A dotted key's value in the record the save answered with, or undefined. */
function storedAt(data: unknown, k: string): unknown {
  let at: unknown = data
  for (const part of k.split('.')) {
    if (at === null || typeof at !== 'object') return undefined
    at = (at as Record<string, unknown>)[part]
  }
  return at
}

/**
 * WHAT WAS KEPT, shown in the box that asked for it.
 *
 * The save normalises a few one-line fields on purpose: an address is kept as its origin
 * (`https://example.com/blog` is stored `https://example.com`), a handle loses what the fediverse
 * cannot carry, a title is trimmed. The box went on showing what was typed while the record held
 * something else, until the next load quietly swapped it. After a save the record is the answer,
 * so a text box whose stored value differs takes it. Only plain one-line inputs: a picture's
 * hidden input carries an address the server expands, and a textarea is the owner's own layout.
 */
function showKept(fields: Field[], data: unknown): void {
  for (const el of fields) {
    if (!(el instanceof HTMLInputElement) || !['text', 'url', 'email'].includes(el.type)) continue
    const kept = storedAt(data, el.dataset.k ?? '')
    if (typeof kept === 'string' && kept !== el.value) el.value = kept
  }
}

/**
 * The machine doors' addresses, redrawn from what the save stored (`machineAddress` in
 * `screens/settings-server-api.ts` draws both faces). A Site address set on the Blog tab used to
 * leave the Server tab saying "set the site address first" until a reload.
 */
function paintAddresses(root: HTMLElement, data: unknown): void {
  const site = storedAt(data, 'siteUrl')
  if (typeof site !== 'string') return
  for (const box of root.querySelectorAll<HTMLElement>('[data-machine-address]')) {
    const origin = (site || box.dataset.fallback || '').replace(/\/+$/, '')
    const code = box.querySelector('[data-machine-known] code')
    if (code && origin) code.textContent = `${origin}${box.dataset.path ?? ''}`
    show(box.querySelector('[data-machine-known]'), origin !== '')
    show(box.querySelector('[data-machine-unknown]'), origin === '')
  }
}

export type Form = {
  fields: () => Field[]
  count: () => number
  recount: () => void
  save: () => Promise<boolean>
}

export function wireSave(screen: HTMLElement, w: SaveWords): Form {
  const lang = (screen.dataset.lang ?? 'en') as SiteLang
  /**
   * ⚠️ A LEAVE THE OWNER HAS ALREADY AGREED TO IS NOT ASKED ABOUT AGAIN.
   *
   * `beforeunload` cannot tell a deliberate navigation from an accidental one, so without this
   * flag choosing "Discard" asked the product's question and then the BROWSER's — two dialogs
   * for one decision, the second of them the generic one this whole interception exists to
   * avoid. Found by the tour: headless Chrome does not dismiss a `beforeunload` prompt on its
   * own, so the run stopped dead on the flow after the one that discards.
   */
  let leaving = false
  const key = screen.querySelector<HTMLButtonElement>('[data-settings-save]')
  const said = screen.querySelector<HTMLElement>('[data-settings-said]')
  const panels = screen.querySelector<HTMLElement>('[data-settings-panels]')
  let saving = false
  let savedAt = ''

  const fields = (): Field[] => panels ? fieldsIn(panels) : []
  const count = (): number => changedCount(fields())

  /**
   * ⚠️ DISABLED WITH NOTHING TO SAVE, and that is not tidiness: a Save key that is always
   * pressable answers "did I change anything?" with a shrug, and pressing it wrote the same
   * record back and printed a success toast for work nobody did. The COUNT is what makes it
   * worth pressing — "Save settings" says only that saving exists.
   */
  function recount(): void {
    const n = count()
    if (key) {
      key.disabled = saving || n === 0
      key.textContent = saving
        ? (w.saving ?? '')
        : n === 0 ? (w.save ?? '') : plural(w.saveCount ?? '', n, lang)
    }
    // The receipt clears the moment the form is dirty again: a stale "Saved at 14:02" beside
    // three unsaved changes is a lie.
    if (said) said.textContent = saving ? (w.saving ?? '') : (savedAt && n === 0 ? `${w.savedAt ?? ''} ${savedAt}` : '')
  }

  async function save(): Promise<boolean> {
    const moved = fields()
    const partial = partialOf(moved)
    if (Object.keys(partial).length === 0) return true
    saving = true
    recount()
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(partial),
      })
      if (res.status === 401) {
        location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
        return false
      }
      const json = await res.json() as { success?: boolean; error?: string; data?: unknown }
      if (!json.success) {
        // The fields the server refuses by name: a list path a post already holds, an emptied
        // title, and an address or repository name that does not read (`field_<why>: <key>`,
        // `content/settings-refuse.ts`). Each is on ONE tab, and not necessarily the tab being
        // looked at, so the screen opens that tab before pointing at the field.
        const taken = json.error?.startsWith('list_path_taken')
        const untitled = json.error === 'title_required'
        const named = /^field_(url|invalid): ([\w.]+)$/.exec(json.error ?? '')
        const why = named ? (named[1] === 'url' ? w.fieldUrl : w.fieldInvalid) : undefined
        say((taken ? w.listTaken : untitled ? w.titleRequired : why ?? w.failed) ?? '', 'error')
        const k = taken ? 'home.listPath' : untitled ? 'title' : named?.[2] ?? ''
        if (named && k) refuseUnder(screen, k, why ?? '')
        if (k) screen.dispatchEvent(new CustomEvent('settings:field-error', { detail: { k } }))
        return false
      }
      showKept(moved, json.data)
      settle(moved)
      // The blocks that wait for a SAVED answer (`data-gate-live`, the MCP address and its token
      // manager) open now: the sheet has just written what is in the form, so the form IS the
      // record. Only a card's own Save did this, and the MCP card no longer has one, so switching
      // the server on and pressing this key left both blocks shut until a reload.
      if (panels) applyLiveGates(panels)
      if (panels) paintAddresses(panels, json.data)
      // The zone may be what this very save changed: move the page's before the clock reads it,
      // and everything the island draws from here on (backups, tokens, sessions) follows.
      const zone = (json.data as { zone?: unknown } | undefined)?.zone
      if (typeof zone === 'string' && zone) document.documentElement.dataset.tz = zone
      savedAt = clock()
      say(w.saved ?? '')
      return true
    } catch {
      say(w.failed ?? '', 'error')
      return false
    } finally {
      saving = false
      recount()
    }
  }

  key?.addEventListener('click', () => { void save() })

  /**
   * THE WAY OUT, asked about rather than taken.
   *
   * Three answers, in the order every footer in this admin uses: back out, the alternative, then
   * the one that acts. A failed save blocks the navigation — walking away from work the server
   * refused is the one outcome nobody wants.
   */
  document.addEventListener('click', (e) => {
    if (count() === 0 || e.defaultPrevented) return
    const mouse = e as MouseEvent
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey || mouse.button !== 0) return
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]')
    const href = link?.getAttribute('href')
    if (!href || !href.startsWith('/') || link!.target === '_blank') return
    // A link to somewhere on THIS screen is not leaving it.
    if (href.startsWith(location.pathname) && href.includes('?tab=')) return
    e.preventDefault()
    const unheard = window.dispatchEvent(new CustomEvent('quire:confirm', {
      cancelable: true,
      detail: {
        // The SAME three labels in the same three places as the React face: stay, save, then
        // discard. `alt` is Save and `confirm` is Discard — the order every footer in this
        // admin uses is back out, the alternative, then the answer that acts, and here the
        // answer that acts is the one that throws work away.
        request: {
          title: plural(w.leaveTitle ?? '', count(), lang),
          body: w.leaveBody ?? '',
          altLabel: w.leaveSave ?? '',
          confirmLabel: w.leaveDiscard ?? '',
          cancelLabel: w.leaveStay ?? '',
          danger: true,
        },
        respond: (answer: string) => {
          if (answer === 'cancel') return
          // ⚠️ Save-and-go goes only if the save SUCCEEDED. Letting the navigation through on a
          // refused save is how a form is lost by the button that promised to keep it.
          if (answer === 'alt') {
            void save().then((ok) => { if (ok) { leaving = true; location.href = href } })
            return
          }
          leaving = true
          location.href = href
        },
      },
    }))
    // Nothing heard the question, so nothing is risked on an answer nobody gave: stay put.
    if (unheard) say(w.leaveBody ?? '', 'error')
  }, true)

  // The ways out a click handler cannot see: a typed address, a closed tab, a reload.
  window.addEventListener('beforeunload', (e) => {
    if (leaving || count() === 0) return
    e.preventDefault()
    e.returnValue = ''
  })

  recount()
  return { fields, count, recount, save }
}
