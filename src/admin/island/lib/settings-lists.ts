// THE THREE LISTS THE SERVER COULD NOT DRAW, and the one it could.
//
// MCP tokens and backups come from routes the page has not called when it is rendered, so both
// ship as an empty list plus a `<template>` holding one row — every class and every translated
// word already in it, written by the server. Redirects DO come with the page, and their template
// is there only for rows added afterwards.
//
// ⚠️ A ROW IS CLONED, NEVER BUILT. `settings-controls.ts` says the island builds no markup, and
// a row assembled in JavaScript is a second copy of this screen's classes that drifts from the
// server's in silence. The template is how a list that arrives later keeps one source.
import type { BackupListWire, McpTokenWire, SnapshotWire } from '@/admin-shared/wire'
import { formatDateTimeShort } from '@/admin-shared/when'
import { say } from './media-bridge'

export type ListWords = Partial<Record<string, string>>

const show = (el: Element | null, on: boolean): void => {
  if (el instanceof HTMLElement) el.hidden = !on
}

/**
 * One row from the list's own template, with its fields filled in.
 *
 * ⚠️ THE `<tr>` FIRST, AND THE TEMPLATE'S FIRST CHILD ONLY AS A FALLBACK. A table row cannot be
 * a template's first child and survive every parser — `settings-server-mcp.ts` explains why it
 * ships wrapped in a `<table><tbody>` skeleton — so taking `firstElementChild` there clones the
 * whole SKELETON and drops a nested table inside the real `<tbody>`. It fills, and the fields
 * read back, and every assertion on text passes: what is wrong is only that the row is its own
 * table and its columns no longer line up with the header above them. A list whose rows are
 * `<li>` has no `tr` and falls through to the first child, which is the row itself.
 */
function row(list: HTMLElement, fill: (el: HTMLElement) => void): HTMLElement | null {
  const tpl = list.closest('section')?.querySelector('template')
  const source = tpl?.content.querySelector('tr') ?? tpl?.content.firstElementChild
  const clone = source?.cloneNode(true)
  if (!(clone instanceof HTMLElement)) return null
  fill(clone)
  return clone
}

const put = (el: HTMLElement, hook: string, text: string): void => {
  const slot = el.querySelector<HTMLElement>(`[${hook}]`)
  if (slot) slot.textContent = text
}

/**
 * ⚠️ NULL IS "THE QUESTION BROKE", NOT "THE ANSWER WAS EMPTY", and every caller has to keep
 * them apart. A list that prints its empty state after a refused request tells the owner their
 * rows are gone when all of them are still on the server — and on the backups card that same
 * sentence says there is no copy of the blog anywhere. Each filler below shows the failure box
 * the server drew for exactly this, and the box carries a key that asks again in place.
 */
async function read<T>(url: string): Promise<T | null> {
  const res = await fetch(url).catch(() => null)
  if (!res) return null
  if (res.status === 401) {
    location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
    return null
  }
  const json = await res.json().catch(() => null) as { success?: boolean; data?: T } | null
  return json?.success && json.data !== undefined ? json.data : null
}

/** Show the failure box, and hide everything that would otherwise claim to be the answer. */
function broke(card: Element | null, hook: string, faces: string[]): void {
  for (const face of faces) show(card?.querySelector(`[${face}]`) ?? null, false)
  show(card?.querySelector<HTMLElement>(`[${hook}]`) ?? null, true)
}

/**
 * The keys that ask again, armed ONCE at wiring time.
 *
 * ⚠️ NOT ARMED INSIDE THE FAILURE PATH. A listener added when the request fails is a listener
 * added AGAIN on the second failure, and the third — so one click then fires three refetches
 * and the box flickers back after it cleared. Arming here also means the key works the first
 * time it is ever pressed, which is the only time it matters.
 *
 * It refetches IN PLACE: a failure whose only remedy is reloading the admin costs the owner
 * every unsaved field on the screen.
 */
function wireRetries(screen: HTMLElement): void {
  const again: [string, () => void][] = [
    ['data-mcp-failed', () => { void fillTokens(screen) }],
    ['data-backup-failed', () => { void fillBackups(screen) }],
  ]
  for (const [hook, run] of again) {
    const box = screen.querySelector<HTMLElement>(`[${hook}]`)
    box?.querySelector('[data-load-retry]')?.addEventListener('click', () => {
      show(box, false)
      run()
    })
  }
}


export function wireLists(screen: HTMLElement, w: ListWords): void {
  void fillTokens(screen)
  void fillBackups(screen)
  wireRedirects(screen, w)
  wireBackupKeys(screen, w)
  wireRetries(screen)
}

/**
 * TAKING AN ARCHIVE AWAY IS THE BROWSER'S JOB, NOT THE TAB'S.
 *
 * ⚠️ A SYNTHETIC ANCHOR, NEVER `fetch().blob()`. Reading a whole archive into memory to hand it
 * back undoes the streaming the route exists for: measured on 2026-09-13, a 262 MB snapshot was
 * held in the tab, with no progress and no way to cancel. A link hands the URL over and the
 * browser does what browsers do with a download.
 */
function wireBackupKeys(screen: HTMLElement, w: ListWords): void {
  screen.addEventListener('click', (e) => {
    const target = e.target as HTMLElement

    if (target.closest('[data-backup-export]')) {
      hand('/api/backup/export')
      return
    }

    const run = target.closest<HTMLButtonElement>('[data-backup-run]')
    if (run) { void take(screen, run, w); return }

    const gone = target.closest<HTMLElement>('[data-backup-delete]')
    const row = gone?.closest<HTMLElement>('[data-backup]')
    if (gone && row?.dataset.backup) void dropBackup(row, row.dataset.backup, w)
  })
}

/** Hand a URL to the browser and let it decide what a download looks like. */
function hand(href: string): void {
  const link = document.createElement('a')
  link.href = href
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function take(screen: HTMLElement, key: HTMLButtonElement, w: ListWords): Promise<void> {
  const label = key.textContent ?? ''
  key.disabled = true
  key.textContent = w.saving ?? label
  try {
    const res = await fetch('/api/backup/run', { method: 'POST' })
    if (!res.ok) throw new Error('failed')
    await fillBackups(screen)
    say(w.saved ?? '')
  } catch {
    say(w.saveFailed ?? '', 'error')
  } finally {
    key.disabled = false
    key.textContent = label
  }
}

async function dropBackup(row: HTMLElement, name: string, w: ListWords): Promise<void> {
  const res = await fetch('/api/backup/delete', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
  }).catch(() => null)
  if (res?.ok) { row.remove(); say(w.deleted ?? '') }
  else say(w.deleteFailed ?? '', 'error')
}

/**
 * THE MCP TOKENS.
 *
 * A token's plaintext exists only in the reply that mints it — the table holds a prefix and
 * nothing else — so the "copy it now" box is shown once and never again.
 */
async function fillTokens(screen: HTMLElement): Promise<void> {
  const rows = screen.querySelector<HTMLElement>('[data-mcp-rows]')
  if (!rows) return
  const tokens = await read<McpTokenWire[]>('/api/mcp/tokens')
  if (!tokens) {
    broke(rows.closest('section'), 'data-mcp-failed', ['data-mcp-none', 'data-mcp-table'])
    return
  }
  show(rows.closest('section')?.querySelector('[data-mcp-failed]') ?? null, false)
  paintTokens(rows, tokens)
}

function paintTokens(rows: HTMLElement, tokens: McpTokenWire[]): void {
  const made = tokens.map((tk) => row(rows, (el) => {
    el.dataset.mcpTokenRow = String(tk.id)
    put(el, 'data-mcp-name', tk.name)
    put(el, 'data-mcp-prefix', tk.prefix)
    // The admin's own stamp in all three columns, which is what the React table printed. Cut
    // to ten characters they were a different format from every other date on this screen.
    put(el, 'data-mcp-made', formatDateTimeShort(tk.createdAt))
    // NEVER-USED IS A DRAWN SPAN, not a word this file holds. The template ships both halves
    // and the island shows one; a string here would be an untranslated twelfth locale.
    put(el, 'data-mcp-used', tk.lastUsedAt ? formatDateTimeShort(tk.lastUsedAt) : '')
    show(el.querySelector('[data-mcp-used]'), tk.lastUsedAt != null)
    show(el.querySelector('[data-mcp-never]'), tk.lastUsedAt == null)
    // The expiry column, and the word that replaces it once the date has passed. `expired` is
    // the SERVER's answer against the server's clock: a browser with a wrong clock must not be
    // what decides whether a token still works, because it is not what the route asks.
    put(el, 'data-mcp-expires', formatDateTimeShort(tk.expiresAt))
    show(el.querySelector('[data-mcp-expires]'), !tk.expired)
    show(el.querySelector('[data-mcp-expired]'), tk.expired)
    // A BADGE ONLY WHEN THE GRANT IS NARROWER THAN FULL. `full` is what every token was before
    // scopes existed and what an unaware client still expects, so it is the unremarkable case
    // and labelling it would make the two that matter harder to pick out of the table.
    show(el.querySelector('[data-mcp-scope]'), tk.scope !== 'full')
    show(el.querySelector('[data-mcp-badge-read]'), tk.scope === 'read')
    show(el.querySelector('[data-mcp-badge-code]'), tk.scope !== 'read')
  })).filter((el): el is HTMLElement => el !== null)
  rows.replaceChildren(...made)
  const card = rows.closest('section')
  show(card?.querySelector('[data-mcp-table]') ?? null, made.length > 0)
  show(card?.querySelector('[data-mcp-none]') ?? null, made.length === 0)
}

/** THE BACKUPS, and the lamp that says how long it has been. */
/**
 * The snapshot list's own date format, which is NOT the admin's terse stamp.
 *
 * It is `toLocaleString()` because that is what the React card printed here, and ADR 0054 is a
 * conversion: a screen that reads differently after it is a change hiding inside a move. The
 * inconsistency with every other date in this admin is real and predates this file — worth one
 * deliberate commit of its own, not a silent edit in the middle of a port.
 */
const backupWhen = (iso: string): string => new Date(iso).toLocaleString()

async function fillBackups(screen: HTMLElement): Promise<void> {
  const list = screen.querySelector<HTMLElement>('[data-backup-list]')
  if (!list) return
  const data = await read<BackupListWire>('/api/backup/list')
  if (!data) {
    broke(list.closest('section'), 'data-backup-failed', ['data-backup-none', 'data-backup-list'])
    return
  }
  show(list.closest('section')?.querySelector('[data-backup-failed]') ?? null, false)
  const made = (data.snapshots ?? []).map((s: SnapshotWire) => row(list, (el) => {
    el.dataset.backup = s.name
    put(el, 'data-backup-when', backupWhen(s.createdAt))
    // One decimal, as the React card had it. Rounded to whole megabytes every snapshot a small
    // blog takes reads "0 MB", which is the one number on this row that has to be believable.
    put(el, 'data-backup-size', `${(s.size / 1024 / 1024).toFixed(1)} MB`)
    const link = el.querySelector<HTMLAnchorElement>('[data-backup-download]')
    // A PLAIN NAVIGATION, never `fetch().blob()`: reading a whole archive into memory to hand
    // it back to the browser undoes the streaming the route exists for, and on 2026-09-13 it
    // cost the owner a 262 MB download held in a tab.
    if (link) link.href = `/api/backup/download?name=${encodeURIComponent(s.name)}`
  })).filter((el): el is HTMLElement => el !== null)
  list.replaceChildren(...made)
  show(list, made.length > 0)
  const card = list.closest('section')
  show(card?.querySelector('[data-backup-none]') ?? null, made.length === 0)
  // ⚠️ THE LABEL IS HALF THE SENTENCE. "Last run: 14/9/26 - 03:10" replaced by a bare date is
  // a number with nothing saying what it counts, on the one line of this screen that can mean
  // there is no copy of the blog anywhere. Both words come off the element, from the locales.
  const last = card?.querySelector<HTMLElement>('[data-backup-last]')
  if (last) {
    const label = last.dataset.wordLabel ?? ''
    const value = data.lastRunAt ? backupWhen(data.lastRunAt) : (last.dataset.wordNever ?? '')
    last.textContent = label ? `${label}: ${value}` : value
  }
  // The lamp says whether there is one AT ALL, before the date is read.
  show(card?.querySelector('[data-backup-lamp-some]') ?? null, data.lastRunAt != null)
  show(card?.querySelector('[data-backup-lamp-none]') ?? null, data.lastRunAt == null)
}

/**
 * THE REDIRECTS, which the server CAN read — so the rows arrive drawn and the template is only
 * for ones added afterwards.
 */
function wireRedirects(screen: HTMLElement, w: ListWords): void {
  const list = screen.querySelector<HTMLElement>('[data-redirect-list]')
  if (!list) return

  screen.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const gone = target.closest<HTMLElement>('[data-redirect-delete]')
    if (gone) {
      const line = gone.closest<HTMLElement>('[data-redirect]')
      const id = line?.dataset.redirectId
      if (id) void drop(line!, id, w)
      return
    }
    if (target.closest('[data-redirect-add]')) void add(screen, list, w)
  })
}

async function drop(line: HTMLElement, id: string, w: ListWords): Promise<void> {
  const res = await fetch(`/api/redirects/${id}`, { method: 'DELETE' }).catch(() => null)
  if (res?.ok) { line.remove(); say(w.deleted ?? '') }
  else say(w.deleteFailed ?? '', 'error')
}

async function add(screen: HTMLElement, list: HTMLElement, w: ListWords): Promise<void> {
  const from = screen.querySelector<HTMLInputElement>('[data-redirect-source]')
  const to = screen.querySelector<HTMLInputElement>('[data-redirect-destination]')
  const permanent = screen.querySelector<HTMLInputElement>('[data-redirect-permanent]')
  if (!from?.value.trim() || !to?.value.trim()) return
  const body = { source: from.value.trim(), destination: to.value.trim(), permanent: Boolean(permanent?.checked) }
  const res = await fetch('/api/redirects', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }).catch(() => null)
  if (!res?.ok) {
    const said = await res?.json().catch(() => null) as { error?: string } | null
    say(said?.error || (w.saveFailed ?? ''), 'error')
    return
  }
  // The list is re-read rather than guessed at: the server sanitises a path and may answer with
  // something other than what was typed.
  const rows = await read<{ id: number; source: string; destination: string; permanent: boolean }[]>('/api/redirects')
  if (rows) {
    const made = rows.map((r) => row(list, (el) => {
      el.dataset.redirect = ''
      el.dataset.redirectId = String(r.id)
      put(el, 'data-redirect-from', r.source)
      put(el, 'data-redirect-to', r.destination)
      put(el, 'data-redirect-code', r.permanent ? '301' : '302')
    })).filter((el): el is HTMLElement => el !== null)
    list.replaceChildren(...made)
    show(list, made.length > 0)
  }
  from.value = ''
  to.value = ''
  say(w.saved ?? '')
}
