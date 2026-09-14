// A subscriber list that narrows, pages, picks, drops and exports, over rows the server drew.
//
// In `island/lib/` rather than beside the entries, and that is load-bearing: `build-admin.ts`
// globs `*.ts` in `src/admin/island` and makes an ENTRY of each match. The glob does not
// recurse, so a module down here is a module — imported into an island and bundled with it —
// while the same file one directory up would become a browser entry point nobody ever loads.
//
// It is its own file because the newsletter island reached the 400-line ceiling with it
// inline, and because this is the shape the media library will want when it converts: a list
// the server draws whole, narrowed and paged by hiding, with a selection bar over it.
//
// ⚠️ IT BUILDS NOTHING. Every row arrived as markup, twice — a table row from 640px up and a
// card below it — and both faces of one subscriber are hidden and shown together. The only
// text written here is a count and the "showing 1-50 of 200" line.
import type { SiteLang } from '@/types'
import { formatCount } from '@/i18n/format'

const PER_PAGE = 50

export type SubscriberWords = { showing?: string; deleteFailed?: string }

export function wireSubscribers(screen: HTMLElement, opts: {
  lang: SiteLang
  words: SubscriberWords
  say: (message: string, kind?: 'error') => void
}): void {
  const { words, say } = opts
  const n = (x: number): string => formatCount(x, opts.lang)
  const pick = <T extends HTMLElement>(sel: string): T | null => screen.querySelector<T>(sel)

  type Entry = { id: number; find: string; status: string; tr: HTMLElement; li: HTMLElement | null }
  const entries: Entry[] = [...screen.querySelectorAll<HTMLElement>('[data-sub]')].map((tr) => ({
    id: Number(tr.dataset.id),
    find: tr.dataset.find ?? '',
    status: tr.dataset.status ?? '',
    tr,
    li: screen.querySelector<HTMLElement>(`[data-sub-card][data-id="${tr.dataset.id}"]`),
  }))
  const gone = new Set<number>()
  let page = 0
  let scope = 'all'

  const search = pick<HTMLInputElement>('[data-sub-search]')
  const scopeStrip = pick('[data-sub-scope]')
  const nomatch = pick('[data-sub-nomatch]')
  const rowsBox = pick('[data-sub-rows]')
  const paging = pick('[data-sub-paging]')
  const showing = pick('[data-sub-showing]')
  const prev = pick<HTMLButtonElement>('[data-sub-prev]')
  const next = pick<HTMLButtonElement>('[data-sub-next]')
  const bar = pick('[data-sub-bar]')
  const picked = pick('[data-pick-count]')
  const band = [...screen.querySelectorAll<HTMLElement>('[data-nl-panel="people"] .flex-1 b')]
  const SCOPE_ON = scopeStrip?.querySelector<HTMLElement>('[aria-pressed="true"]')?.className ?? ''
  const SCOPE_OFF = scopeStrip?.querySelector<HTMLElement>('[aria-pressed="false"]')?.className ?? ''

  const boxes = (): HTMLInputElement[] =>
    [...screen.querySelectorAll<HTMLInputElement>('[data-sub-pick]')]
  const chosen = (): number[] =>
    boxes().filter((b) => b.checked && b.closest('tr')?.hidden !== true).map((b) => Number(b.dataset.id))

  function countPicked(): void {
    const many = chosen().length
    if (picked) picked.textContent = String(many)
    if (bar) bar.hidden = many === 0
  }

  function apply(): void {
    const needle = (search?.value ?? '').trim().toLowerCase()
    const hit = entries.filter((e) => !gone.has(e.id)
      && (scope === 'all' || e.status === scope)
      && (!needle || e.find.includes(needle)))
    const pages = Math.max(1, Math.ceil(hit.length / PER_PAGE))
    // Clamped rather than reset: filtering down to two pages while standing on page five
    // should land on the last page that exists, not throw you back to the first.
    if (page > pages - 1) page = pages - 1
    const from = page * PER_PAGE
    const on = new Set(hit.slice(from, from + PER_PAGE).map((e) => e.id))
    for (const e of entries) {
      e.tr.hidden = !on.has(e.id)
      if (e.li) e.li.hidden = !on.has(e.id)
    }
    if (nomatch) nomatch.hidden = hit.length > 0
    if (rowsBox) rowsBox.hidden = hit.length === 0
    if (paging) paging.hidden = pages <= 1
    if (showing) {
      showing.textContent = (words.showing ?? '')
        .replace('{from}', n(from + 1)).replace('{to}', n(from + on.size)).replace('{n}', n(hit.length))
    }
    if (prev) prev.disabled = page === 0
    if (next) next.disabled = page >= pages - 1
    countPicked()
  }

  search?.addEventListener('input', () => { page = 0; apply() })
  scopeStrip?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
    if (!b?.dataset.tab) return
    scope = b.dataset.tab
    page = 0
    for (const tab of scopeStrip.querySelectorAll<HTMLElement>('[data-tab]')) {
      const on = tab.dataset.tab === scope
      tab.setAttribute('aria-pressed', String(on))
      tab.className = on ? SCOPE_ON : SCOPE_OFF
    }
    apply()
  })
  prev?.addEventListener('click', () => { page = Math.max(0, page - 1); apply() })
  next?.addEventListener('click', () => { page += 1; apply() })
  screen.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).hasAttribute('data-sub-pick')) countPicked()
  })
  pick('[data-pick-clear]')?.addEventListener('click', () => {
    for (const b of boxes()) b.checked = false
    countPicked()
  })

  /**
   * Remove one address. The row is HIDDEN rather than the page reloaded, which is what the
   * React face did and for its reason: the row is gone from the server either way, and a
   * reload would throw away the scroll position for one deleted line.
   *
   * The band above IS revised, which the React face did not do. Its three numbers are server
   * figures, and a total that sits unchanged beside a list you just shortened is the screen
   * telling you something it knows to be false.
   */
  async function drop(id: number): Promise<boolean> {
    const res = await fetch(`/api/subscribers/${id}`, { method: 'DELETE' })
    const body = await res.json().catch(() => null) as { success?: boolean } | null
    if (!body?.success) return false
    const was = entries.find((e) => e.id === id)?.status
    gone.add(id)
    const cell = band[was === 'confirmed' ? 0 : was === 'pending' ? 1 : 2]
    if (cell) cell.textContent = n(Math.max(0, Number(cell.textContent?.replace(/\D/g, '') ?? 0) - 1))
    return true
  }

  screen.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('[data-sub-drop]')
    if (!button?.dataset.id) return
    void drop(Number(button.dataset.id)).then((ok) => {
      if (ok) apply()
      else say(words.deleteFailed ?? '', 'error')
    })
  })

  pick('[data-pick-delete]')?.addEventListener('click', () => {
    const ids = chosen()
    void (async () => {
      let bad = 0
      for (const id of ids) if (!(await drop(id))) bad += 1
      for (const b of boxes()) b.checked = false
      apply()
      if (bad) say(words.deleteFailed ?? '', 'error')
    })()
  })

  /**
   * The selection, as a file, built here.
   *
   * No endpoint: the rows are already on the page, and a server route for this would be a
   * second place that decides what a subscriber export contains. RFC 4180 quoting, because a
   * CSV that is right only for well-behaved input is a CSV that corrupts somebody's file.
   */
  pick('[data-sub-export]')?.addEventListener('click', () => {
    const table = screen.querySelector('[data-nl-panel="people"] thead tr')
    const head = [...(table?.children ?? [])].map((th) => th.textContent?.trim() ?? '')
      .filter(Boolean)
    const cell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const lines = [head.map(cell).join(',')]
    for (const id of chosen()) {
      const tr = entries.find((e) => e.id === id)?.tr
      if (!tr) continue
      lines.push([tr.dataset.email ?? '', tr.dataset.status ?? '', tr.dataset.joined ?? '',
        tr.dataset.sent ?? '0', tr.dataset.rate ?? ''].map(cell).join(','))
    }
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  })

  apply()

  apply()
}
