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
import { changedCount, fieldsIn, partialOf, settle, type Field } from './settings-form'

export type SaveWords = Partial<Record<string, string>>

const say = (message: string, kind?: 'error'): void => {
  window.dispatchEvent(new CustomEvent('quire:toast', { detail: { message, kind } }))
}

/** `HH:mm`, because the useful fact a minute later is the time and not the word "saved". */
const clock = (): string => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export type Form = {
  fields: () => Field[]
  count: () => number
  recount: () => void
  save: () => Promise<boolean>
}

export function wireSave(screen: HTMLElement, w: SaveWords): Form {
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
        : n === 0 ? (w.save ?? '') : (w.saveCount ?? '').replace('{n}', String(n))
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
      const json = await res.json() as { success?: boolean; error?: string }
      if (!json.success) {
        // The one field the server refuses by name: a list path a post already holds. It is on
        // ONE tab, and not necessarily the tab being looked at, so the screen opens that tab
        // before pointing at the field.
        const taken = json.error?.startsWith('list_path_taken')
        say(taken ? (w.listTaken ?? '') : (w.failed ?? ''), 'error')
        if (taken) screen.dispatchEvent(new CustomEvent('settings:field-error', { detail: { k: 'home.listPath' } }))
        return false
      }
      settle(moved)
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
          title: (w.leaveTitle ?? '').replace('{n}', String(count())),
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
