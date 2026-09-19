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
//
// ⚠️ ONE REQUEST FOR THE WHOLE SELECTION, since 2026-09-19. This file used to fire one DELETE
// per ticked piece, because there was no other endpoint — and each of those goes through the
// owner gate, which flushes the page cache and purges the CDN on the way out (Invariant 1) and
// leaves a row in the activity log. Fifty ticks were fifty of each. `POST /api/content/bulk`
// is one of each, and it reports which pieces moved so the partial answer below survives.
import { say } from './media-bridge'
import { sayAcross } from './say-across'
import { BULK_MAX } from '@/admin-shared/write'

export type PickWords = Partial<Record<string, string>>

type Piece = { kind: string; slug: string }
type BulkAnswer = { done: Piece[]; failed: Piece[] }

/** `kind:slug`, the shape the ticks carry and the bulk route takes. */
const split = (key: string): Piece => {
  const [kind = '', slug = ''] = key.split(':')
  return { kind, slug }
}
const join = (piece: Piece): string => `${piece.kind}:${piece.slug}`

export function wirePicking(pane: HTMLElement, rows: HTMLElement[], after: () => void): void {
  const words = JSON.parse(pane.dataset.writeWords ?? '{}') as PickWords
  const start = pane.querySelector<HTMLElement>('[data-write-select]')
  const done = pane.querySelector<HTMLElement>('[data-write-done]')
  const bin = pane.querySelector<HTMLButtonElement>('[data-write-trash]')
  const up = pane.querySelector<HTMLButtonElement>('[data-write-publish]')
  const down = pane.querySelector<HTMLButtonElement>('[data-write-draft]')
  const every = pane.querySelector<HTMLButtonElement>('[data-write-all]')
  const tools = pane.querySelector<HTMLElement>('[data-write-tools]')
  const picking = pane.querySelector<HTMLElement>('[data-write-picking-tools]')
  if (!start || !done || !bin) return

  const ticks = (): HTMLInputElement[] => [...pane.querySelectorAll<HTMLInputElement>('[data-write-tick]')]
  /**
   * The ticks a filter is currently letting through, in the order they are drawn.
   *
   * ⚠️ VISIBLE, not all. The rows all ship and the island hides them (`docs/admin-one-dom.md`),
   * so "all" taken literally would tick two hundred rows of which the owner can see twelve —
   * and then publish them. What is on screen is what a selection may mean.
   */
  const shown = (): HTMLInputElement[] =>
    ticks().filter((t) => t.closest<HTMLElement>('[data-piece]')?.hidden === false)
  const chosen = (): HTMLInputElement[] => ticks().filter((t) => t.checked)

  /** Where the last tick was toggled, so a shift-click has a range to fill. */
  let anchor = -1

  function count(): void {
    const n = chosen().length
    for (const [key, word] of [[bin, words.trash], [up, words.publish], [down, words.draft]] as const) {
      if (!key) continue
      key.textContent = `${word ?? ''} (${n})`
      // Disabled rather than silently doing nothing: a key that can be pressed and answers
      // by not moving is a key that looks broken.
      key.disabled = n === 0
    }
    if (every) {
      const all = shown()
      const full = all.length > 0 && all.every((t) => t.checked)
      every.textContent = (full ? every.dataset.off : every.dataset.on) ?? ''
    }
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
    // The range anchor belongs to one visit to this mode. Kept across, a shift-click after
    // re-entering would fill from wherever the last session happened to stop.
    anchor = -1
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

    // SHIFT FILLS THE RANGE, which is the difference between picking twelve things and
    // picking twelve things one at a time. The range is over what is SHOWN, so a run that
    // looks unbroken on screen is unbroken — filling over hidden rows would tick pieces the
    // owner never saw between the two they clicked.
    const list = shown()
    const here = list.indexOf(tick)
    if ((e as MouseEvent).shiftKey && anchor >= 0 && here >= 0) {
      const [from, to] = anchor < here ? [anchor, here] : [here, anchor]
      for (let i = from; i <= to; i++) list[i]!.checked = tick.checked
    }
    if (here >= 0) anchor = here
    count()
  })

  every?.addEventListener('click', () => {
    const list = shown()
    // Pressing it when everything visible is already ticked clears, which is what its second
    // word says it will do.
    const next = !(list.length > 0 && list.every((t) => t.checked))
    for (const t of list) t.checked = next
    anchor = -1
    count()
  })

  bin.addEventListener('click', () => { void act('trash') })
  up?.addEventListener('click', () => { void act('publish') })
  down?.addEventListener('click', () => { void act('draft') })

  const keys = (): HTMLButtonElement[] =>
    [bin!, up, down].filter((k): k is HTMLButtonElement => k !== null)

  function busy(on: boolean): void {
    for (const key of keys()) key.disabled = on || chosen().length === 0
    for (const t of ticks()) t.disabled = on
  }

  /**
   * One request for the whole selection, and the partial answer is REPORTED rather than
   * rounded up. Nineteen of twenty moved is not "done", and it is not "failed" either: the
   * one that stayed is still on screen, still ticked, still there to try again.
   */
  async function act(action: 'trash' | 'publish' | 'draft'): Promise<void> {
    const picked = chosen().map((t) => t.dataset.writeTick ?? '').filter(Boolean)
    if (picked.length === 0) return
    busy(true)

    // ⚠️ IN RUNS OF `BULK_MAX`, NOT ONE REQUEST WHATEVER THE SIZE. The route refuses past that
    // number to protect a single thread, and "All" on a blog the owner has scrolled through
    // can name more — so a control that always sent one request would sometimes fire one its
    // own server refuses, and the owner would meet that as a red toast after doing the work of
    // selecting. Three requests for six hundred pieces; the per-piece way this replaced was
    // six hundred. SEQUENTIAL, because each run is a write and they queue on one writer anyway.
    const gone: string[] = []
    let broke = false
    for (let at = 0; at < picked.length; at += BULK_MAX) {
      const run = picked.slice(at, at + BULK_MAX)
      const res = await fetch('/api/content/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, pieces: run.map(split) }),
      }).catch(() => null)
      const answer = await res?.json().catch(() => null) as
        { success?: boolean; data?: BulkAnswer } | null
      // ⚠️ A BROKEN QUESTION IS NOT AN EMPTY ANSWER. A 500, an expired session or a refusal
      // has to say so; the React column this replaced returned here in silence, which left
      // the owner with a key that had simply stopped and no reason why. A run that fails
      // stops the rest: whatever is wrong will be wrong for them too.
      if (!res?.ok || !answer?.success || !answer.data) { broke = true; break }
      gone.push(...answer.data.done.map(join))
    }
    busy(false)

    if (broke && gone.length === 0) { say(words.bulkPartial ?? '', 'error'); return }
    const short = gone.length !== picked.length

    if (action !== 'trash') {
      // THE LIST IS THE SERVER'S. A status change moves a row's lamp, its label and which
      // filters it answers to, and nothing in this island builds markup — so the page comes
      // back rather than being patched into a shape only half of it believes. The sentence
      // travels with it (`say-across.ts`), because a toast dies with the page.
      if (gone.length === 0) { say(words.bulkPartial ?? '', 'error'); return }
      const said = (action === 'publish' ? words.published : words.drafted) ?? ''
      sayAcross({
        message: said.replace('{n}', String(gone.length))
          + (short ? ` · ${words.bulkPartial ?? ''}` : ''),
      })
      location.reload()
      return
    }

    // The rows that went, taken out here rather than by a reload — because a reload would take
    // the toast with it, and for the bin the toast is where the undo is. A piece that did NOT
    // go stays on screen, still ticked, which is the honest report of a partial answer.
    // Is one of the pieces just binned the one OPEN beside this column? `data-write-open` is
    // empty on the list screen, where nothing is open and nothing has to be left.
    const open = gone.includes(pane.dataset.writeOpen ?? '\u0000')
    for (const key of gone) pane.querySelector(`[data-piece="${CSS.escape(key)}"]`)?.remove()
    anchor = -1
    after()
    count()

    if (!short) {
      say((words.trashed ?? '').replace('{n}', String(gone.length)), undefined, {
        label: words.undo ?? '',
        run: () => { void restore(gone) },
      })
    } else {
      say(`${words.trashPartial ?? ''} (${gone.length}/${picked.length})`, 'error')
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
