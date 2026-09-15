// The trash's behaviour, over seven lists the server already sent (ADR 0054).
//
// It switches, it filters, and it ACTS — and that last one is what makes this island different
// from the log's. The log writes once (clear it), the trash writes five ways: restore a row,
// restore everything ticked, delete a row forever, empty a kind, and the second, stronger
// question a picture still in use asks before either delete goes through.
//
// WHAT IT DOES NOT DO is build a row. Every row for all seven kinds is in the markup with its
// id, its kind and its folded name on it, so switching a tab moves an attribute and filtering
// hides rows. Nothing here knows what a trashed post looks like.
//
// AFTER A WRITE, THE PAGE RELOADS. `router.refresh()` was the React face of this and it meant
// the same thing: the server is the source of truth for what is in the trash, and the counts on
// the tabs are part of that truth. Recomputing them here would be a second implementation of
// the list, which is the thing this conversion exists to stop having.
// The search is the blog's own accent rule, not a plain fold: a word typed without accents
// matches any accents in the text, a word typed WITH them means them. Five Vietnamese words
// live inside one folded spelling, so folding both sides makes a search for "lề" return "lệ".
import { indexIn, lanes, type Lanes } from '@/accent'
import { showTab } from './lib/tab-strip'

const root = document.querySelector<HTMLElement>('[data-screen="trash"]')

if (root) {
  type Words = Record<string, string>
  const words = JSON.parse(root.dataset.trashAsk ?? '{}') as Words
  // A NARROWED ALIAS, because `root` is narrowed by the guard above and a hoisted `function`
  // declaration inside the block does not inherit that narrowing — only the arrow functions do.
  // One name for the screen rather than a non-null assertion at each use.
  const screen: HTMLElement = root
  const panels = [...root.querySelectorAll<HTMLElement>('[data-trash-panel]')]
  const strip = root.querySelector<HTMLElement>('[data-trash-tabs]')
  const search = root.querySelector<HTMLInputElement>('[data-trash-search]')
  const emptyKey = root.querySelector<HTMLButtonElement>('[data-trash-empty]')
  const restoreKey = root.querySelector<HTMLButtonElement>('[data-trash-restore-picked]')
  const pickedCount = root.querySelector<HTMLElement>('[data-trash-picked]')

  /**
   * THE TWO CLASS STRINGS A TAB CAN WEAR, read off the markup the server drew rather than
   * re-typed here. One of the seven is pressed on the first frame and six are not, so both
   * answers are already on the page — and taking them from there is the only way this island
   * cannot drift from `tabItemClass`, which is where the strings actually live.
   */
  const anyTab = strip?.querySelector<HTMLElement>('[data-tab]')
  const ON = strip?.querySelector<HTMLElement>('[aria-pressed="true"]')?.className ?? ''
  const OFF = strip?.querySelector<HTMLElement>('[aria-pressed="false"]')?.className ?? anyTab?.className ?? ''

  const panelFor = (kind: string): HTMLElement | undefined =>
    panels.find((p) => p.dataset.trashPanel === kind)

  /** Every row of the kind on screen. The other six kinds' rows are in the markup and hidden. */
  const rowsOf = (kind: string): HTMLElement[] =>
    [...(panelFor(kind)?.querySelectorAll<HTMLElement>('[data-trash-row]') ?? [])]

  const current = (): string => root.dataset.trashTab ?? 'posts'
  const ticked = (): HTMLInputElement[] =>
    [...(panelFor(current())?.querySelectorAll<HTMLInputElement>('[data-trash-pick]') ?? [])]
      .filter((box) => box.checked && !(box.closest('[data-trash-row]') as HTMLElement).hidden)

  /**
   * The three lanes of a row's name, built ONCE and kept.
   *
   * Lazily, and that is the whole reason it is a cache rather than a pass at startup: almost
   * nobody searches the trash, and building lanes for every row of seven kinds on a screen that
   * is usually opened to press Restore once would be work done for nothing. The first keystroke
   * pays for it, and only for the kind on screen.
   */
  const laneCache = new WeakMap<HTMLElement, Lanes>()
  const lanesOf = (row: HTMLElement): Lanes => {
    const had = laneCache.get(row)
    if (had) return had
    const made = lanes(row.dataset.find ?? '')
    laneCache.set(row, made)
    return made
  }

  /** The search narrows the kind on screen; the tools follow what is left of it. */
  function apply(): void {
    const q = search?.value.trim() ?? ''
    let shown = 0
    for (const row of rowsOf(current())) {
      const hide = !!q && indexIn(lanesOf(row), q) === -1
      row.hidden = hide
      if (!hide) shown++
    }
    // The list and the lens are mutually exclusive: one of the two is on screen, never both and
    // never neither. `shown` is counted here rather than asked of the DOM afterwards, because a
    // `hidden` row still answers `querySelectorAll`.
    const none = screen.querySelector<HTMLElement>(`[data-trash-nomatch="${current()}"]`)
    if (none) none.hidden = shown > 0
    countPicked()
  }

  function countPicked(): void {
    const n = ticked().length
    if (pickedCount) pickedCount.textContent = String(n)
    if (restoreKey) restoreKey.hidden = n === 0
  }

  /**
   * SWITCHING A KIND CLEARS THE SELECTION, and it has to.
   *
   * Ids are only unique WITHIN a kind — a post's slug and a file's URL are different namespaces
   * — so a tick carried across tabs would restore something nobody pointed at. The search box is
   * cleared for the same reason in reverse: a query typed about posts means nothing about files,
   * and leaving it would show an empty list of a kind that is not empty.
   */
  function swap(kind: string): void {
    screen.dataset.trashTab = kind
    // THE ADDRESS FOLLOWS THE STRIP, because every write here ends in a reload and the server
    // reads `?tab=` to decide which kind to draw. `replaceState` rather than `pushState`: the
    // seven kinds are one screen, and Back should leave the trash rather than walk the tabs
    // somebody clicked through on the way to the one they wanted.
    const url = new URL(location.href)
    if (kind === 'posts') url.searchParams.delete('tab')
    else url.searchParams.set('tab', kind)
    history.replaceState(history.state, '', url)
    for (const box of screen.querySelectorAll<HTMLInputElement>('[data-trash-pick]')) box.checked = false
    for (const p of panels) p.hidden = p.dataset.trashPanel !== kind
    for (const tab of strip?.querySelectorAll<HTMLElement>('[data-tab]') ?? []) {
      const on = tab.dataset.tab === kind
      tab.setAttribute('aria-pressed', String(on))
      tab.className = on ? ON : OFF
    }
    showTab(strip)
    if (search) { search.value = ''; search.hidden = rowsOf(kind).length === 0 }
    if (emptyKey) emptyKey.hidden = rowsOf(kind).length === 0
    apply()
  }

  strip?.addEventListener('click', (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
    if (tab?.dataset.tab) swap(tab.dataset.tab)
  })

  // On arrival too: the server draws the selected tab, so the painter above has never run
  // when the page opens, and a strip too wide for a phone opens showing the wrong end.
  showTab(strip)
  search?.addEventListener('input', apply)
  root.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).hasAttribute('data-trash-pick')) countPicked()
  })

  /**
   * The question, in the product's own grammar rather than the browser's.
   *
   * ⚠️ IF NOTHING ANSWERS, NOTHING HAPPENS. `ConfirmProvider` is still React and still mounted
   * beside this page; an island that imported it would pull React in behind it, so the ask goes
   * out as an event. An unheard question is a REFUSAL — the only outcome that cannot be
   * regretted on the one screen whose actions cannot be walked back.
   */
  const ask = (title: string, body: string): Promise<boolean> =>
    new Promise((resolve) => {
      const unheard = window.dispatchEvent(new CustomEvent('quire:confirm', {
        cancelable: true,
        detail: {
          request: { title, body, confirmLabel: words.yes, cancelLabel: words.no, danger: true },
          respond: (answer: string) => resolve(answer === 'confirm'),
        },
      }))
      if (unheard) resolve(false)
    })

  const say = (message: string, kind?: 'error'): void => {
    window.dispatchEvent(new CustomEvent('quire:toast', { detail: { message, kind } }))
  }

  /** Every write on this screen is this one request, which is the endpoint's own shape. */
  async function act(
    kind: string, action: 'restore' | 'purge' | 'empty', ids?: string[], force?: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/trash', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, action, ids, force }),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      return json.success ? { ok: true } : { ok: false, error: json.error }
    } catch {
      return { ok: false }
    }
  }

  /**
   * A media delete can come back `in_use:<n>`: the picture is still on a live page. That is not
   * a failure, it is a second question — and declining it leaves the file in the trash with no
   * error toast, because nothing went wrong.
   */
  async function askInUse(error: string | undefined): Promise<boolean> {
    if (!error?.startsWith('in_use')) return false
    return await ask(words.inUseTitle.replace('{n}', error.split(':')[1] ?? ''), words.inUseBody)
  }

  /** A write that landed reloads the page; one that did not says so and leaves the screen. */
  async function finish(r: { ok: boolean }, done: string, failed: string): Promise<void> {
    if (!r.ok) return say(failed, 'error')
    say(done)
    location.reload()
  }

  root.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement
    const put = el.closest<HTMLElement>('[data-trash-restore]')
    if (put) {
      await finish(await act(put.dataset.kind ?? '', 'restore', [put.dataset.id ?? '']),
        words.restored, words.restoreFailed)
      return
    }
    const gone = el.closest<HTMLElement>('[data-trash-purge]')
    if (gone) {
      const kind = gone.dataset.kind ?? ''
      const id = gone.dataset.id ?? ''
      if (!await ask(words.purgeTitle.replace('{name}', gone.dataset.name ?? ''), words.noUndo)) return
      let r = await act(kind, 'purge', [id])
      if (!r.ok && r.error?.startsWith('in_use')) {
        if (!await askInUse(r.error)) return
        r = await act(kind, 'purge', [id], true)
      }
      await finish(r, words.purged, words.purgeFailed)
      return
    }
    if (el.closest('[data-trash-empty]')) {
      const kind = current()
      if (!await ask(words.emptyTitle, words.emptyBody)) return
      let r = await act(kind, 'empty')
      if (!r.ok && r.error?.startsWith('in_use')) {
        if (!await askInUse(r.error)) return
        r = await act(kind, 'empty', undefined, true)
      }
      await finish(r, words.emptied, words.purgeFailed)
      return
    }
    if (el.closest('[data-trash-restore-picked]')) {
      // ONE REQUEST, not a loop of them: `/api/trash` already takes an array of ids, so putting
      // back twenty rows either all lands or none of it does.
      const ids = ticked().map((box) => box.dataset.id ?? '')
      if (ids.length === 0) return
      await finish(await act(current(), 'restore', ids), words.restored, words.restoreFailed)
    }
  })

  apply()
}
