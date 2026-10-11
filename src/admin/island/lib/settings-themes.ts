// THE INSTALLED THEMES on the Look card (ADR 0072, T2c): install one from a zip, roll one back,
// remove one. Choosing one needs nothing here: its tile is a `data-choice` key in the theme track,
// which `settings-controls.ts` already presses and the sheet's Save already stores.
//
// ⚠️ THE LIST IS REDRAWN BY THE SERVER, NOT BUILT HERE. After a write the picker is fetched again
// as part of a fresh draw of this screen and swapped in whole (`refresh`), the way the newsletter
// reads what its posts reached: a tile built in the browser would be a second copy of the server's
// markup, drifting from it in silence. What the swap must not lose is the owner's other work, so
// it touches only the `data-look-list` box (the warning and the tiles) and puts back an unsaved
// pick of a theme still on offer; every other control on all seven tabs, and the install key with
// its live region, is outside the box and never moves.
//
// ⚠️ NO RELOAD, for the reason `settings-import.ts` gives: this screen holds a leave-guard for a
// dirty form, and a reload would either raise the browser's warning or throw away unsaved edits.
//
// Every answer is said: an install in the card's own status line (installed, already there,
// refused with one line per finding, too large, unreachable, a server error with its status), a
// rollback or a removal as a toast. Every listener is on the screen, because the box it listens to
// is replaced after each write.
import { ask, owned, say } from './media-bridge'
import { pressKey } from './press-key'
import { isThemeId } from '@/content/themes-builtin'
import { applyGates } from './settings-controls'
import { swapOffers } from './settings-offers'

type Violation = { rule: string; file: string; line: number; col: number; subject: string }

type ThemeWords = Partial<Record<
  'fallback' | 'installedOk' | 'unchanged' | 'refusedHead' | 'tooBig' | 'network' | 'serverError'
  | 'rolledBack' | 'removed' | 'failed' | 'reload' | 'askTitle' | 'askBody' | 'yes' | 'no'
  | 'previewMissing' | 'previewUnreadable' | 'pickGone', string>>
  & { rules?: Record<string, string> }

/** The screen this card is drawn on, fetched again after a write to redraw the picker. */
const SCREEN_URL = '/admin/settings?tab=appearance'

const fill = (template: string | undefined, values: Record<string, string>): string =>
  (template ?? '').replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)

const pickerIn = (screen: HTMLElement): HTMLElement | null => screen.querySelector<HTMLElement>('[data-look-picker]')

function wordsOf(picker: HTMLElement | null): ThemeWords {
  try {
    return JSON.parse(picker?.dataset.themeWords ?? '{}') as ThemeWords
  } catch {
    console.error('settings: the Look card carries data-theme-words that is not JSON')
    return {}
  }
}

/** One finding as two lines: what the rule asks, then where, the code first. */
export function violationLines(v: Violation, w: ThemeWords): { what: string; where: string } {
  const what = w.rules?.[v.rule] ?? w.rules?.other ?? v.rule
  const place = v.file ? v.file + (v.line > 0 ? `:${v.line}${v.col > 0 ? `:${v.col}` : ''}` : '') : ''
  return { what, where: [v.rule, place, v.subject].filter(Boolean).join(' · ') }
}

/** How many redraws have been asked for; only the latest one's answer is swapped in. */
let redraws = 0

const listIn = (screen: HTMLElement): HTMLElement | null => screen.querySelector<HTMLElement>('[data-look-list]')

/**
 * A screenshot the browser could not decode is hidden, so the drawing under it shows instead of
 * the broken-image glyph. Asked of what is already in the page too: an image can fail before the
 * island runs, and then no `error` event is left to hear (`complete` with no width is that case).
 */
function hideBroken(root: ParentNode): void {
  for (const img of root.querySelectorAll<HTMLImageElement>('img[data-theme-shot]')) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) img.hidden = true
  }
}

/**
 * Draw the tiles again from the server and swap them in. The owner's unsaved pick of a theme that
 * is still on offer is pressed again; one that was removed is gone, and the stored choice shows.
 * Then focus lands on `focusId`'s tile, or the pressed one: the key that was pressed has just been
 * replaced, and focus left on a node that is gone falls back to the page.
 *
 * ⚠️ THE LIST IS FOUND AFTER THE FETCH, NOT BEFORE. Two writes in a row (Rollback on one theme,
 * then on another) overlap here; a box taken before the first answer is the one the first swap
 * already took out of the page, and the second swap into it showed nothing.
 */
export async function refresh(screen: HTMLElement, focusId = ''): Promise<boolean> {
  const asked = ++redraws
  const res = await fetch(SCREEN_URL).catch(() => null)
  const doc = res?.ok ? new DOMParser().parseFromString(await res.text(), 'text/html') : null
  const fresh = doc?.querySelector('[data-look-list]') ?? null
  // A later redraw was asked for while this one was out: its answer is the newer list, so an
  // older answer arriving after it must not be swapped in over it.
  if (asked !== redraws) return true
  const old = listIn(screen)
  if (!old || !fresh) {
    // A sign-in page after an expired session has no list either, and comes back 200.
    console.error(`settings: could not redraw the theme list (${res ? res.status : 'no answer'}${res?.ok ? ', no list in the page' : ''})`)
    return false
  }
  const track = old.querySelector<HTMLElement>('[data-choice-track][data-k="theme"]')
  const was = track?.dataset.was ?? ''
  const pick = track?.querySelector<HTMLElement>('[aria-pressed="true"]')?.dataset.choice ?? ''
  const box = document.importNode(fresh, true) as HTMLElement
  old.replaceWith(box)
  const next = box.querySelector<HTMLElement>('[data-choice-track][data-k="theme"]')
  const keys = [...(next?.querySelectorAll<HTMLElement>('[data-choice]') ?? [])]
  if (pick !== was && keys.some((k) => k.dataset.choice === pick)) for (const k of keys) pressKey(k, k.dataset.choice === pick)
  // The palettes and fonts the themes add to the pickers, outside this box, drawn again with it.
  if (doc) swapOffers(screen, doc)
  hideBroken(box)
  applyGates(screen)
  // The Save key counts again: the baseline may have moved (a removed theme puts the blog on plain).
  next?.dispatchEvent(new Event('input', { bubbles: true }))
  const target = keys.find((k) => k.dataset.choice === focusId) ?? keys.find((k) => k.getAttribute('aria-pressed') === 'true')
  target?.focus()
  return true
}

/** The card's three answer slots, all hidden. */
function clearAnswers(picker: HTMLElement | null): void {
  for (const hook of ['data-theme-status', 'data-theme-error', 'data-theme-refusal']) {
    const el = picker?.querySelector<HTMLElement>(`[${hook}]`)
    if (el) el.hidden = true
  }
}

function answer(screen: HTMLElement, hook: 'data-theme-status' | 'data-theme-error', text: string): void {
  const picker = pickerIn(screen)
  clearAnswers(picker)
  const el = picker?.querySelector<HTMLElement>(`[${hook}]`)
  if (!el) return
  el.textContent = text
  el.hidden = false
}

function refused(screen: HTMLElement, violations: Violation[], w: ThemeWords): void {
  const picker = pickerIn(screen)
  clearAnswers(picker)
  const box = picker?.querySelector<HTMLElement>('[data-theme-refusal]')
  const list = box?.querySelector<HTMLElement>('[data-theme-violations]')
  const row = box?.querySelector<HTMLTemplateElement>('template[data-theme-violation]')?.content.firstElementChild
  if (!box || !list || !row) return
  const head = box.querySelector<HTMLElement>('[data-theme-refusal-head]')
  if (head) head.textContent = fill(w.refusedHead, { n: String(violations.length) })
  list.replaceChildren(...violations.map((v) => {
    const li = row.cloneNode(true) as HTMLElement
    const { what, where } = violationLines(v, w)
    const put = (hook: string, text: string) => { const el = li.querySelector(`[${hook}]`); if (el) el.textContent = text }
    put('data-theme-violation-what', what)
    put('data-theme-violation-where', where)
    return li
  }))
  box.hidden = false
}

const isViolation = (v: unknown): v is Violation =>
  typeof v === 'object' && v !== null && typeof (v as Violation).rule === 'string'

type Installed = { id: string; version: string; changed: boolean }

/** Send the zip, and say what came of it. */
export async function install(screen: HTMLElement, file: File): Promise<void> {
  const w = wordsOf(pickerIn(screen))
  const body = new FormData()
  // No `content-type` header: the browser writes the multipart boundary itself.
  body.append('file', file)
  const res = await fetch('/api/themes', { method: 'POST', body }).catch(() => null)
  if (!res) return answer(screen, 'data-theme-error', w.network ?? '')
  if (!await owned(res)) return
  const json = await res.json().catch(() => null) as
    { success?: boolean; data?: Installed; error?: string; violations?: unknown } | null
  if (res.ok && json?.success && json.data) {
    const { id, version, changed } = json.data
    const drawn = await refresh(screen, id)
    const name = listIn(screen)?.querySelector<HTMLElement>(`[data-choice="${CSS.escape(id)}"]`)?.dataset.name ?? id
    const done = fill(changed ? w.installedOk : w.unchanged, { theme: name, version })
    // Installed, but the tiles could not be drawn again: the owner is told where to look.
    return answer(screen, 'data-theme-status', drawn ? done : `${done} ${w.reload ?? ''}`)
  }
  if (res.status === 422 && Array.isArray(json?.violations)) return refused(screen, json.violations.filter(isViolation), w)
  if (res.status === 413) return answer(screen, 'data-theme-error', w.tooBig ?? '')
  console.error(`settings: installing a theme answered ${res.status} ${json?.error ?? ''}`)
  answer(screen, 'data-theme-error', fill(w.serverError, { status: String(res.status) }))
}

/** A rollback or a removal: the request, the redraw, and one sentence either way. */
async function act(
  screen: HTMLElement, key: HTMLButtonElement, url: string, method: string,
  said: (data: unknown) => string, focusId = '',
): Promise<void> {
  const w = wordsOf(pickerIn(screen))
  key.disabled = true
  try {
    const res = await fetch(url, { method }).catch(() => null)
    if (res && !await owned(res)) return
    const json = await res?.json().catch(() => null) as { success?: boolean; data?: unknown } | null
    if (!res?.ok || !json?.success) {
      console.error(`settings: ${method} ${url} answered ${res ? res.status : 'nothing'}`)
      return say(w.failed ?? '', 'error')
    }
    const drawn = await refresh(screen, focusId)
    say(drawn ? said(json.data) : `${said(json.data)} ${w.reload ?? ''}`)
  } finally {
    // A key the redraw replaced is gone; the one still here (a failure) is pressable again.
    key.disabled = false
  }
}

/** The name the card shows for `id`: its tile's, or the id when no tile carries it any more. */
const nameOn = (screen: HTMLElement, id: string): string =>
  [...screen.querySelectorAll<HTMLElement>('[data-theme-cell] [data-name]')].find((el) =>
    el.closest('[data-theme-cell]')?.getAttribute('data-theme-cell') === id)?.dataset.name ?? id

/** The address without `names`, put back in place so a reload does not act on them again. */
function dropParams(url: URL, ...names: string[]): void {
  for (const name of names) url.searchParams.delete(name)
  history.replaceState(history.state, '', url)
}

/**
 * Arriving from a preview: "Choose this theme" on its bar (`?pick-theme=<id>`) presses that tile as
 * the owner's own click would, so its suggestions move and Save counts it, and nothing is stored
 * until Save. A Preview the server refused (`?preview-refused=<id>&why=`, `web/theme-preview.ts`)
 * says why on the card. Either way the parameters leave the address.
 */
export function arriveFromPreview(screen: HTMLElement): void {
  const url = new URL(location.href)
  const w = wordsOf(pickerIn(screen))
  // Only an id is ever said on the card: the address is anyone's to write, and a link carrying
  // `?preview-refused=Your session expired…` must not put a stranger's sentence in the alert.
  const refused = url.searchParams.get('preview-refused')
  if (refused !== null) {
    const why = url.searchParams.get('why') === 'unreadable' ? w.previewUnreadable : w.previewMissing
    dropParams(url, 'preview-refused', 'why')
    if (isThemeId(refused)) answer(screen, 'data-theme-error', fill(why, { theme: nameOn(screen, refused) }))
  }
  const id = url.searchParams.get('pick-theme')
  if (id === null) return
  dropParams(url, 'pick-theme')
  if (!isThemeId(id)) return
  const keys = [...screen.querySelectorAll<HTMLElement>('[data-choice-track][data-k="theme"] [data-choice]')]
  const key = keys.find((k) => k.dataset.choice === id)
  if (!key) {
    // Removed in another tab while the preview was open: the stored choice stays, and the card says so.
    console.warn(`settings: the previewed theme ${id} is not on the Look card any more`)
    answer(screen, 'data-theme-error', fill(w.pickGone, { theme: id }))
    return
  }
  if (key.getAttribute('aria-pressed') !== 'true') key.click()
  key.scrollIntoView?.({ block: 'center' })
  key.focus()
}

export function wireThemes(screen: HTMLElement): void {
  if (!pickerIn(screen)) return
  let busy = false

  // `error` does not bubble, so it is heard on the way down; and what failed before this ran is
  // found by asking.
  screen.addEventListener('error', (e) => {
    if (e.target instanceof HTMLImageElement && e.target.matches('[data-theme-shot]')) e.target.hidden = true
  }, true)
  hideBroken(screen)

  screen.addEventListener('change', (e) => {
    const input = e.target
    if (!(input instanceof HTMLInputElement) || !input.matches('[data-theme-file]')) return
    const file = input.files?.[0]
    if (!file || busy) return
    const key = pickerIn(screen)?.querySelector<HTMLButtonElement>('[data-theme-choose]') ?? null
    busy = true
    clearAnswers(pickerIn(screen))
    if (key) { key.disabled = true; key.textContent = key.dataset.labelBusy ?? key.textContent }
    pickerIn(screen)?.setAttribute('aria-busy', 'true')
    void install(screen, file).finally(() => {
      busy = false
      // The key and the input sit outside the list a redraw replaces, so they are the ones on screen.
      if (key) { key.disabled = false; key.textContent = key.dataset.labelIdle ?? key.textContent }
      input.value = ''
      pickerIn(screen)?.removeAttribute('aria-busy')
    })
  })

  arriveFromPreview(screen)

  screen.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-theme-choose]')) {
      if (!busy) pickerIn(screen)?.querySelector<HTMLInputElement>('[data-theme-file]')?.click()
      return
    }
    const back = target.closest<HTMLButtonElement>('[data-theme-rollback]')
    if (back && !back.disabled) {
      const id = back.dataset.themeRollback ?? ''
      const name = back.closest('[data-theme-cell]')?.querySelector<HTMLElement>('[data-choice]')?.dataset.name ?? id
      void act(screen, back, `/api/themes/${encodeURIComponent(id)}/rollback`, 'POST', (data) =>
        fill(wordsOf(pickerIn(screen)).rolledBack, { theme: name, version: (data as { current?: { version?: string } })?.current?.version ?? '' }), id)
      return
    }
    const gone = target.closest<HTMLButtonElement>('[data-theme-remove]')
    if (gone && !gone.disabled) {
      const id = gone.dataset.themeRemove ?? ''
      const name = gone.dataset.name ?? id
      const w = wordsOf(pickerIn(screen))
      void ask({ yes: w.yes, no: w.no }, fill(w.askTitle, { theme: name }), fill(w.askBody, { fallback: w.fallback ?? '' })).then((yes) => {
        if (yes) return act(screen, gone, `/api/themes/${encodeURIComponent(id)}`, 'DELETE', () => fill(w.removed, { theme: name }))
      })
    }
  })
}
