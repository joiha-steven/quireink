// THE TWO DRAWERS' BEHAVIOUR: renaming and removing a term or a series, and reordering a
// series' parts.
//
// Both bodies arrive drawn, so nothing here fetches to open one. What it does is ask the
// question, send the write, and reload — because every one of these rewrites the front matter
// of posts that are not on screen, and a list patched in place after that would be showing
// counts the server no longer agrees with.
//
// ⚠️ EVERY ACTION HERE REACHES BEYOND WHAT IS VISIBLE. Renaming a category rewrites every post
// carrying it and MERGES on a collision; deleting one strips it from all of them. That is why
// both ask first, and why the question names the term rather than the action.
import { say } from './media-bridge'

type Words = Partial<Record<string, string>>

/**
 * The product's own question, with an optional field in it.
 *
 * ⚠️ IF NOTHING ANSWERS, NOTHING HAPPENS. `ConfirmProvider` is still React and still mounted
 * beside this page; an island that imported it would pull React in behind it, so the ask goes
 * out as an event. An unheard question is a REFUSAL — which is the only outcome that cannot be
 * regretted in front of a control that rewrites forty posts.
 */
function askDialog(
  request: Record<string, unknown>,
): Promise<{ ok: boolean; value: string }> {
  return new Promise((resolve) => {
    const unheard = window.dispatchEvent(new CustomEvent('quire:confirm', {
      cancelable: true,
      detail: {
        request,
        respond: (answer: string, value?: string) =>
          resolve({ ok: answer === 'confirm', value: value ?? '' }),
      },
    }))
    if (unheard) resolve({ ok: false, value: '' })
  })
}

const fill = (s: string, name: string): string => s.replace('{name}', name)

export function wireDrawers(screen: HTMLElement): void {
  const box = screen.querySelector<HTMLElement>('[data-write-drawers]')
  const pane = screen.querySelector<HTMLElement>('[data-write-pane]')
  if (!box || !pane) return
  const w = JSON.parse(pane.dataset.writeWords ?? '{}') as Words
  const scrim = box.querySelector<HTMLElement>('[data-drawer-scrim]')
  const panels = [...box.querySelectorAll<HTMLElement>('[data-drawer]')]

  /** The element that had focus before a drawer opened, so Escape can hand it back. */
  let cameFrom: HTMLElement | null = null

  function open(name: string | null): void {
    if (name) cameFrom = document.activeElement instanceof HTMLElement ? document.activeElement : null
    for (const p of panels) p.hidden = p.dataset.drawer !== name
    if (scrim) scrim.hidden = name === null
    // THE PAGE UNDER A MODAL DOES NOT SCROLL. Without this the drawer's own scroll chains into
    // the column behind it the moment it reaches its end, so closing the drawer leaves the list
    // somewhere nobody moved it to.
    document.documentElement.style.overflow = name ? 'hidden' : ''
    if (name) panels.find((p) => p.dataset.drawer === name)?.focus?.()
    else { cameFrom?.focus(); cameFrom = null }
  }

  for (const key of pane.querySelectorAll<HTMLElement>('[data-write-drawer]')) {
    key.addEventListener('click', () => open(key.dataset.writeDrawer ?? null))
  }
  scrim?.addEventListener('click', () => open(null))
  for (const key of box.querySelectorAll('[data-drawer-close]')) {
    key.addEventListener('click', () => open(null))
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panels.some((p) => !p.hidden)) open(null)
  })

  // ---- the writes ---------------------------------------------------------------------

  async function send(url: string, body: unknown, done: string): Promise<void> {
    const res = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null)
    if (res?.status === 401) {
      location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
      return
    }
    const json = await res?.json().catch(() => null) as { success?: boolean } | null
    if (!json?.success) { say(w.saveFailed ?? '', 'error'); return }
    say(done)
    // Every write here changes posts that are not on this screen — a term's count, a series'
    // order, the rows the column is filed under. The server owns all of it.
    location.reload()
  }

  box.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const row = target.closest<HTMLElement>('li, [data-series] > div')
    const facts = row?.querySelector<HTMLElement>('[data-term-kind]')
    const kind = facts?.dataset.termKind
    const name = facts?.dataset.termName

    if (target.closest('[data-term-rename]') && kind && name) {
      void (async () => {
        const asked = await askDialog({
          title: fill(kind === 'series' ? (w.renameSeriesTitle ?? '') : (w.renameTermTitle ?? ''), name),
          input: { label: w.renamePrompt ?? '', initial: name },
          confirmLabel: w.save ?? '',
          cancelLabel: w.askCancel ?? '',
        })
        const next = asked.value.trim()
        if (!asked.ok || !next || next === name) return
        if (kind === 'series') await send('/api/series', { action: 'rename', name, newName: next }, w.renamed ?? '')
        else await send('/api/taxonomy', { kind, name, action: 'rename', newName: next }, w.renamed ?? '')
      })()
      return
    }

    if (target.closest('[data-term-delete]') && kind && name) {
      void (async () => {
        const asked = await askDialog({
          title: fill(kind === 'series' ? (w.askRemoveSeriesTitle ?? '') : (w.askRemoveTermTitle ?? ''), name),
          body: kind === 'series' ? w.askRemoveSeriesBody : w.askRemoveTermBody,
          confirmLabel: w.askRemove ?? '',
          cancelLabel: w.askCancel ?? '',
          danger: true,
        })
        if (!asked.ok) return
        if (kind === 'series') await send('/api/series', { action: 'delete', name }, w.deleted ?? '')
        else await send('/api/taxonomy', { kind, name, action: 'delete' }, w.deleted ?? '')
      })()
      return
    }

    // ⚠️ REORDERING ASKS NOTHING, and it is the one write in this drawer that does not: moving
    // part three above part two is a thing anybody can see and put straight back.
    const step = target.closest('[data-part-up]') ? -1 : target.closest('[data-part-down]') ? 1 : 0
    if (step === 0) return
    const group = target.closest<HTMLElement>('[data-series]')
    const parts = [...(group?.querySelectorAll<HTMLElement>('[data-part]') ?? [])]
    const here = parts.findIndex((p) => p === target.closest('[data-part]'))
    const there = here + step
    if (!group?.dataset.series || here < 0 || there < 0 || there >= parts.length) return
    const order = parts.map((p) => p.dataset.part ?? '')
    const a = order[here] ?? ''
    order[here] = order[there] ?? ''
    order[there] = a
    void send('/api/series', { action: 'reorder', name: group.dataset.series, order }, w.seriesReordered ?? '')
  })
}
