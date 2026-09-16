// PICKING SEVERAL PIECES AT ONCE, and binning them.
//
// Selection is a MODE, not a permanent control on every row. A trash icon that lives on the row
// sits a few pixels from the title you click dozens of times a day, and it has to appear on
// hover to stay out of the way — which on a touch screen means it never appears at all. Behind
// a mode the row stays a plain link until you ask for something else.
//
// ⚠️ A ROW BEING PICKED IS NOT A LINK, and this takes its `href` away to make that true for
// everyone. An `<a>` without one is not focusable, is not announced as a link, and cannot be
// followed — so the row stops being a way out of the page for the keyboard and for a screen
// reader at the same moment it stops being one for the mouse. Setting `pointer-events: none` in
// CSS would have fixed the mouse alone and left Tab walking forty-eight links that go nowhere.
//
// ⚠️ AND IT IS ONE ELEMENT, NOT TWO. React swapped a `<Link>` for a `<label>`; drawing both
// under this ADR would mean every row in the markup twice, on a list that already ships whole.
//
// BINNING ASKS NOTHING, and the whole argument for asking nothing is that the undo is in the
// toast — which is why `say` carries an action.
import { say } from './media-bridge'

export type PickWords = Partial<Record<string, string>>

/** `kind:slug` split the way the routes want it: three kinds, three endpoints. */
const ROUTE: Record<string, string> = { post: '/api/posts/', page: '/api/pages/', note: '/api/notes/' }

export function wirePicking(pane: HTMLElement, rows: HTMLElement[], after: () => void): void {
  const words = JSON.parse(pane.dataset.writeWords ?? '{}') as PickWords
  const start = pane.querySelector<HTMLElement>('[data-write-select]')
  const done = pane.querySelector<HTMLElement>('[data-write-done]')
  const bin = pane.querySelector<HTMLButtonElement>('[data-write-trash]')
  const tools = pane.querySelector<HTMLElement>('[data-write-tools]')
  const picking = pane.querySelector<HTMLElement>('[data-write-picking-tools]')
  if (!start || !done || !bin) return

  const ticks = (): HTMLInputElement[] => [...pane.querySelectorAll<HTMLInputElement>('[data-write-tick]')]
  const chosen = (): HTMLInputElement[] => ticks().filter((t) => t.checked)

  function count(): void {
    const n = chosen().length
    bin!.textContent = `${words.trash ?? ''} (${n})`
    for (const t of ticks()) {
      const row = t.closest<HTMLElement>('[data-piece]')
      if (row) row.toggleAttribute('data-picked', t.checked)
    }
  }

  function enter(on: boolean): void {
    pane.toggleAttribute('data-picking', on)
    if (tools) tools.hidden = on
    if (picking) picking.hidden = !on
    for (const row of rows) {
      if (on) {
        row.removeAttribute('href')
        row.removeAttribute('data-write-row')
        row.setAttribute('data-write-pick', row.dataset.piece ?? '')
      } else {
        row.setAttribute('href', row.dataset.href ?? '')
        row.setAttribute('data-write-row', '')
        row.removeAttribute('data-write-pick')
        row.removeAttribute('data-picked')
      }
    }
    if (!on) for (const t of ticks()) t.checked = false
    count()
    after()
  }

  start.addEventListener('click', () => enter(true))
  done.addEventListener('click', () => enter(false))

  // The whole row is the target, not the 14px box: a tap anywhere ticks. The tick itself is a
  // real checkbox and stays the keyboard's way in, so this only has to catch the rest of the row
  // — and must not double-toggle when the tick was what was clicked.
  pane.addEventListener('click', (e) => {
    if (!pane.hasAttribute('data-picking')) return
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-write-pick]')
    if (!row) return
    const tick = row.querySelector<HTMLInputElement>('[data-write-tick]')
    if (!tick) return
    if (e.target !== tick) {
      e.preventDefault()
      tick.checked = !tick.checked
    }
    count()
  })

  bin.addEventListener('click', () => { void trash() })

  /**
   * ⚠️ ONE REQUEST PER PIECE, because there is no bulk endpoint — and the partial answer is
   * reported rather than rounded up. Three of five binned is not "done", and it is not "failed"
   * either: the two that stayed are still there to try again.
   */
  async function trash(): Promise<void> {
    const keys = chosen().map((t) => t.dataset.writeTick ?? '').filter(Boolean)
    if (keys.length === 0) return
    bin!.disabled = true
    for (const t of ticks()) t.disabled = true
    const gone: string[] = []
    await Promise.all(keys.map(async (key) => {
      const [kind = '', slug = ''] = key.split(':')
      const base = ROUTE[kind]
      if (!base) return
      const res = await fetch(base + encodeURIComponent(slug), { method: 'DELETE' }).catch(() => null)
      if (res?.ok) gone.push(key)
    }))
    bin!.disabled = false
    for (const t of ticks()) t.disabled = false

    // The rows that went, taken out here rather than by a reload — because a reload would take
    // the toast with it, and the toast is where the undo is. A piece that did NOT go stays on
    // screen, still ticked, which is the honest report of a partial answer.
    // Is one of the pieces just binned the one OPEN beside this column? `data-write-open` is
    // empty on the list screen, where nothing is open and nothing has to be left.
    const open = gone.includes(pane.dataset.writeOpen ?? '\u0000')
    for (const key of gone) pane.querySelector(`[data-piece="${CSS.escape(key)}"]`)?.remove()
    after()

    if (gone.length === keys.length) {
      say((words.trashed ?? '').replace('{n}', String(gone.length)), undefined, {
        label: words.undo ?? '',
        run: () => { void restore(gone) },
      })
    } else {
      say(`${words.trashPartial ?? ''} (${gone.length}/${keys.length})`, 'error')
    }

    // The sheet beside this column was showing one of them. There is nothing to edit any more,
    // so the reader goes back to the list rather than sitting on a piece that is in the bin.
    if (open) location.href = '/admin/content'
  }

  /**
   * Undo: the trash's own restore, then a reload, because the list is the server's.
   *
   * ⚠️ THE RELOAD IS CONDITIONAL, and it did not used to be. Every answer was discarded and
   * the page came back regardless, so a refused restore and a done one were the same second:
   * the toast carrying the undo was gone, the pieces were still in the Trash, and nothing on
   * screen said which of those two things had happened. The reload is what makes the
   * difference invisible — it takes away the only place the failure could have been reported.
   */
  async function restore(keys: string[]): Promise<void> {
    const byKind = new Map<string, string[]>()
    for (const key of keys) {
      const [kind = '', slug = ''] = key.split(':')
      byKind.set(`${kind}s`, [...(byKind.get(`${kind}s`) ?? []), slug])
    }
    const answers = await Promise.all([...byKind].map(([kind, ids]) => fetch('/api/trash', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, action: 'restore', ids }),
    }).catch(() => null)))
    if (answers.some((res) => !res?.ok)) { say(words.restoreFailed ?? '', 'error'); return }
    location.reload()
  }

  count()
}
