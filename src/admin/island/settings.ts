// The settings screen's behaviour (ADR 0054): seven tabs, one Save, and the way past them.
//
// EVERY CONTROL ON ALL SEVEN TABS ARRIVED AS MARKUP, and so did all 113 rows of the search.
// This file moves the five controls a browser cannot move on its own (`lib/settings-controls`),
// counts what has changed and stores it (`lib/settings-save`), swaps which panel is on screen,
// and narrows a list that is already there. It builds nothing.
//
// ⚠️ ALL SEVEN PANELS ARE IN THE PAGE AT ONCE, which is not the newsletter's three tabs written
// larger: the Save key stores the WHOLE form. An owner changes the blog's name on one tab, the
// front page's shape on another and a palette on a third, and presses Save once. Drawing one tab
// and navigating between them would make every switch a page load, and a page load with unsaved
// work either loses it or raises the browser's own warning.
import { fold } from '@/admin-shared/fold'
import { wireFieldChecks } from './lib/field-check'
import { resolveTab, type Tab } from '@/admin-shared/settings-tabs'
import { wireAi } from './lib/settings-ai'
import { wireCards } from './lib/settings-cards'
import { wireCode } from './lib/settings-code'
import { wireFont } from './lib/settings-font'
import { wireHome } from './lib/settings-home'
import { wireImport } from './lib/settings-import'
import { wireControls } from './lib/settings-controls'
import { wireLists } from './lib/settings-lists'
import { wireMail } from './lib/settings-mail'
import { wireNotes } from './lib/settings-notes'
import { showTab } from './lib/tab-strip'
import { wirePics } from './lib/settings-pics'
import { wireSave, type SaveWords } from './lib/settings-save'
import { wireSecurity } from './lib/settings-security'
import { wireSound } from './lib/settings-sound'
import { wireTheme } from './lib/settings-theme'
import { wireType } from './lib/settings-type'

const root = document.querySelector<HTMLElement>('[data-screen="settings"]')

const NOTES_KEY = 'quireink-admin-settings-notes'

if (root) {
  const screen: HTMLElement = root
  const words = JSON.parse(screen.dataset.settingsWords ?? '{}') as SaveWords
  const panels = [...screen.querySelectorAll<HTMLElement>('[data-settings-panel]')]
  const notesRows = [...screen.querySelectorAll<HTMLElement>('[data-notes-row]')]
  const box = screen.querySelector<HTMLElement>('[data-settings-panels]')
  const strip = screen.querySelector<HTMLElement>('[data-settings-tabs]')
  const ON = strip?.querySelector<HTMLElement>('[aria-selected="true"]')?.className ?? ''
  const OFF = strip?.querySelector<HTMLElement>('[aria-selected="false"]')?.className ?? ''

  const form = wireSave(screen, words)
  if (box) wireControls(box, form.recount)
  // The eleven cards that keep their own key, because they can TRY the far end — which is the
  // one thing the sheet's Save cannot do.
  wireCards(screen, form.fields, words, form.recount)
  // And the pieces that are not a control at all: the pictures, the two code boxes with their
  // gutters, the type scale and its live specimens, the palette editor, and the three lists the
  // server could not draw because it had not called their routes.
  wirePics(screen, words)
  wireCode(screen)
  wireType(screen)
  wireTheme(screen)
  wireLists(screen, words)
  wireMail(screen, words)
  // The importer and the key-sound previews, both of which were drawn and wired to nothing
  // until 2026-09-15. `check:admin-wired` is the guard that will not let that happen twice.
  wireImport(screen, words)
  wireSound(screen)
  wireFont(screen, words)
  // The Home tab's four lists. Each is one `data-k-json` value this owns, not a field per row.
  wireHome(screen, words)
  // The model card's own request, which is also the only test of the key it holds.
  wireAi(screen, words)
  // The Google redirect address, and which of the language menu's two sentences is true.
  wireNotes(screen)
  // And the six sentences that say why a number or an address was refused. The browser will not
  // say them: this screen has no `<form>` for native validation to fire from.
  wireFieldChecks(screen, words)
  // The account's four flows, none of which is a setting and every one of which asks for the
  // current password first: being signed in is not enough.
  wireSecurity(screen, words)

  // ---- which tab is open ------------------------------------------------------------------

  function swap(tab: string): void {
    screen.dataset.settingsTab = tab
    // `replaceState`, not `pushState`: seven tabs are one screen, and Back should leave
    // settings rather than walk the ones clicked through.
    const url = new URL(location.href)
    if (tab === 'blog') url.searchParams.delete('tab')
    else url.searchParams.set('tab', tab)
    history.replaceState(history.state, '', url)
    for (const p of panels) p.hidden = p.dataset.settingsPanel !== tab
    for (const r of notesRows) r.hidden = r.dataset.notesRow !== tab
    for (const b of strip?.querySelectorAll<HTMLElement>('[data-tab]') ?? []) {
      const on = b.dataset.tab === tab
      b.setAttribute('aria-selected', String(on))
      // ROVING: one keyboard stop, so Tab reaches the paper rather than walking seven buttons.
      b.tabIndex = on ? 0 : -1
      b.className = on ? ON : OFF
    }
    showTab(strip)
    measure()
  }

  strip?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
    if (b?.dataset.tab) swap(b.dataset.tab)
  })

  // A KEY ON ONE TAB THAT OPENS ANOTHER. "How readers sign in →" sits beside the comments
  // switch on Posts because how a commenter proves they are a person is a connection, and lives
  // with the keys for it — one click rather than three tabs of hunting. It was drawn and read by
  // nothing since the conversion: the React face called `setTab` on state it owned, and the
  // server has no state. Delegated from the screen rather than the strip, because the key is
  // inside a panel, not in the tab row.
  screen.addEventListener('click', (e) => {
    const to = (e.target as HTMLElement).closest<HTMLElement>('[data-settings-goto]')?.dataset.settingsGoto
    if (to) swap(to)
  })

  // ⚠️ ON ARRIVAL TOO, not only on a swap. The server draws the selected tab, so `swap` has
  // never run when the page opens — and arriving on `?tab=account` at 375px is exactly the case
  // this exists for: four tabs past the right edge, with the strip apparently showing "Blog".
  showTab(strip)

  /**
   * THE ARROWS WALK THE STRIP, which is what makes it a tablist rather than seven buttons.
   *
   * Left and Right move one, Home and End reach the ends, and the tab that arrives takes the
   * focus with it — a strip that moves the selection and leaves the focus behind is a strip a
   * keyboard cannot use twice.
   */
  strip?.addEventListener('keydown', (e) => {
    const keys = [...strip.querySelectorAll<HTMLElement>('[data-tab]')]
    const here = keys.findIndex((b) => b.getAttribute('aria-selected') === 'true')
    if (here < 0) return
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    const to = step !== undefined
      ? (here + step + keys.length) % keys.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? keys.length - 1 : -1
    if (to < 0) return
    e.preventDefault()
    const next = keys[to]
    if (next?.dataset.tab) { swap(next.dataset.tab); next.focus() }
  })

  /**
   * A refused field is on ONE tab, and not necessarily the one being looked at.
   *
   * The Save key stores the whole form, so the server's one named refusal — a list path a post
   * already holds — can come back while somebody is on a different tab. Opening that tab is the
   * least the screen can do before pointing at the field.
   */
  screen.addEventListener('settings:field-error', (e) => {
    const k = (e as CustomEvent).detail?.k as string | undefined
    if (!k) return
    const field = screen.querySelector<HTMLElement>(`[data-k="${CSS.escape(k)}"]`)
    const panel = field?.closest<HTMLElement>('[data-settings-panel]')
    if (panel?.dataset.settingsPanel) swap(panel.dataset.settingsPanel)
    // BY THE KEY, not by walking up to a wrapper. This read `field.closest('[data-field-box]')`
    // and nothing in `web/admin/` has ever drawn `data-field-box`, so `closest` returned null
    // and the server's named refusal stayed hidden on every screen that raised one. The
    // paragraph carries the same key the event does (`screens/settings-home.ts`), so ask for it.
    const note = screen.querySelector<HTMLElement>(`[data-field-error="${CSS.escape(k)}"]`)
    if (note) note.hidden = false
    field?.focus()
  })

  // ---- the explanations --------------------------------------------------------------------

  /**
   * SHOWN OR HIDDEN, and the default is MEASURED rather than fixed.
   *
   * The reason to hide the explanations is BULK. The sheet has a 60vh floor; a tab whose content
   * stops above it leaves blank paper below, and taking the guidance away to make room in a
   * space that is already empty buys nothing and costs the guidance. So a short tab opens with
   * them shown, a long one without — until the owner touches the switch, and from then on their
   * answer is the answer everywhere.
   *
   * ⚠️ MEASURED WITH THEM HIDDEN, always. Measuring the tab as drawn would be a loop: a short
   * tab is given its explanations, grows past the floor, measures as long on the next pass, and
   * has them taken away again. The attribute is set, the height read, and the attribute put back
   * inside one frame, so nothing is ever painted in the measuring state.
   */
  let chosen: boolean | null = null
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    chosen = raw === '1' ? true : raw === '0' ? false : null
  } catch { /* a browser with storage refused: the measurement decides */ }

  function paintNotes(on: boolean): void {
    if (box) box.dataset.explanations = on ? 'on' : 'off'
    for (const b of screen.querySelectorAll<HTMLElement>('[data-notes-toggle]')) {
      b.textContent = (on ? b.dataset.on : b.dataset.off) ?? ''
    }
  }

  function measure(): void {
    if (chosen !== null) { paintNotes(chosen); return }
    const panel = panels.find((p) => !p.hidden)
    if (!panel || !box) return
    const was = box.dataset.explanations
    box.dataset.explanations = 'off'
    const bare = panel.getBoundingClientRect().height
    if (was) box.dataset.explanations = was
    paintNotes(bare < window.innerHeight * 0.6)
  }

  screen.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-notes-toggle]')) return
    const on = box?.dataset.explanations !== 'on'
    chosen = on
    try { localStorage.setItem(NOTES_KEY, on ? '1' : '0') } catch { /* nothing to remember with */ }
    paintNotes(on)
  })

  // ---- the way past the tabs ---------------------------------------------------------------

  const find = screen.querySelector<HTMLInputElement>('[data-settings-find]')
  const results = screen.querySelector<HTMLElement>('[data-settings-results]')
  const found = screen.querySelector<HTMLElement>('[data-settings-found]')
  const none = screen.querySelector<HTMLElement>('[data-settings-none]')

  find?.addEventListener('input', () => {
    const q = fold(find.value.trim())
    // Two characters is where it starts answering: below that the panel would flash open on the
    // first keystroke with the whole index in it.
    const asking = q.length >= 2
    let hits = 0
    for (const row of found?.querySelectorAll<HTMLElement>('[data-found]') ?? []) {
      const hit = asking && (row.dataset.find ?? '').includes(q)
      row.hidden = !hit
      if (hit) hits += 1
    }
    if (results) results.hidden = !asking
    if (none) none.hidden = hits > 0
    if (found) found.hidden = hits === 0
    find.setAttribute('aria-expanded', String(asking))
  })

  /** One row is one jump: it names the setting AND the tab, and clicking it does both halves. */
  found?.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-found]')
    if (!row?.dataset.found) return
    swap(row.dataset.found)
    if (find) { find.value = ''; find.dispatchEvent(new Event('input', { bubbles: true })) }
    jump(row.dataset.label ?? '')
  })

  /**
   * Land ON the setting, not on the tab that holds it.
   *
   * By the label's own text, which is what the index knows about a row. The whole screen is
   * already in the page, so there is nothing to wait for — the React face spent up to forty
   * frames watching for the target to render.
   */
  function jump(label: string): void {
    if (!label) return
    const target = [...screen.querySelectorAll<HTMLElement>('label, .block')]
      .find((el) => el.textContent?.trim() === label)
    const row = target?.closest<HTMLElement>('.setting-row, .block, [data-k]') ?? target
    if (!row) return
    row.scrollIntoView({ block: 'center', behavior: 'smooth' })
    // `.setting-found` is the same ring the React face drew, and it is in `admin.css` already:
    // a 2px outline that fades out over 1.6s, which is the animation's own length.
    row.classList.add('setting-found')
    setTimeout(() => row.classList.remove('setting-found'), 1600)
  }

  // ---- open on the tab the address names ---------------------------------------------------

  // The server already resolved `?tab=`, including the eight old ids. This only has to catch an
  // address that changed under the page — a Back that walked out of the search, say.
  const open: Tab = resolveTab(new URL(location.href).searchParams.get('tab'))
  if (screen.dataset.settingsTab !== open) swap(open)
  else measure()
}
