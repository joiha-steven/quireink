// THE TWO LISTS THE SERVER COULD NOT DRAW, and the one it could.
//
// Backups come from a route the page has not called when it is rendered, so it ships as an
// empty list plus a `<template>` holding one row — every class and every translated word
// already in it, written by the server. Redirects DO come with the page, and their template is
// there only for rows added afterwards. The MCP tokens are the third, and they moved to
// `settings-mcp.ts` on 2026-09-15 when their five dead keys were wired.
//
// ⚠️ A ROW IS CLONED, NEVER BUILT. `settings-controls.ts` says the island builds no markup, and
// a row assembled in JavaScript is a second copy of this screen's classes that drifts from the
// server's in silence. The template is how a list that arrives later keeps one source.
import type { BackupListWire, SnapshotWire } from '@/admin-shared/wire'
import { ask, owned, say } from './media-bridge'
import { broke, put, read, row, show, type ListWords } from './list-dom'
import { fillTokens, wireMcp } from './settings-mcp'
import { wireApi } from './settings-api'

export type { ListWords }

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
  void fillBackups(screen)
  wireRedirects(screen, w)
  wireBackupKeys(screen, w)
  wireMcp(screen, w)
  wireApi(screen, w)
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

    // The Markdown bundle, by the same route to the browser and for the same reason: it
    // carries the uploads tree, so it is the same order of magnitude as the archive above.
    if (target.closest('[data-writing-export]')) {
      hand('/api/export/markdown')
      return
    }

    const cache = target.closest<HTMLButtonElement>('[data-cache-clear]')
    if (cache) { void clearCache(cache, w); return }

    const run = target.closest<HTMLButtonElement>('[data-backup-run]')
    if (run) { void take(screen, run, w); return }

    const keys = target.closest<HTMLButtonElement>('[data-backup-keys]')
    if (keys) { void makeKeys(screen, keys, w); return }

    const gone = target.closest<HTMLElement>('[data-backup-delete]')
    const row = gone?.closest<HTMLElement>('[data-backup]')
    if (gone && row?.dataset.backup) void dropBackup(row, row.dataset.backup, w)
  })
}

/**
 * Make the two recipients an archive is sealed to, and show the identity ONCE (ADR 0060).
 *
 * ⚠️ THE ANSWER IS THE ONLY COPY. The route generates the identity, returns it here and keeps
 * nothing — so this must not throw it away on the way to the screen, and must not be tempted
 * into `localStorage` either. It goes into the element the server already drew for it, the
 * passphrase box is emptied, and the two faces swap over. No reload, because a reload is
 * exactly when the one copy would be lost.
 *
 * ⚠️ AND THE SWITCH IS NOT TOUCHED. Making keys and deciding to use them are two acts: an owner
 * who has not yet written the identity down has not yet agreed to depend on it.
 */
async function makeKeys(screen: HTMLElement, key: HTMLButtonElement, w: ListWords): Promise<void> {
  const box = screen.querySelector<HTMLInputElement>('[data-backup-pass]')
  const passphrase = box?.value ?? ''
  const label = key.textContent ?? ''
  key.disabled = true
  key.textContent = w.backupBusy ?? label
  try {
    const res = await fetch('/api/backup/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    })
    // ⚠️ `json.data`, NOT `json`. Every route here answers through the envelope
    // (`web/api.ts`: `{ success, data }`), and reading the bare payload is the exact mismatch
    // that file's own comment was written about — it type-checks, it passes a route test, and
    // on screen the identity simply never appears. The tour flow found this on its first run.
    const body = await res.json().catch(() => null) as
      { success?: boolean; data?: { secret?: string }; error?: string } | null
    const secret = body?.data?.secret
    if (!res.ok || !secret) throw new Error(body?.error ?? 'failed')
    const panel = screen.querySelector<HTMLElement>('[data-backup-secret]')
    const value = screen.querySelector<HTMLElement>('[data-backup-secret-value]')
    if (value) value.textContent = secret
    if (panel) panel.hidden = false
    if (box) box.value = ''
    screen.querySelector<HTMLElement>('[data-backup-keys-setup]')?.toggleAttribute('hidden', true)
    screen.querySelector<HTMLElement>('[data-backup-keys-done]')?.toggleAttribute('hidden', false)
    say(w.backupDone ?? '')
  } catch (error) {
    say((error as Error).message === 'failed' ? (w.backupFailed ?? '') : (error as Error).message, 'error')
  } finally {
    key.disabled = false
    key.textContent = label
  }
}

/**
 * Clearing the cache: one POST, no body, and nothing to ask first.
 *
 * ⚠️ IT DOES NOT ASK. Nothing here is destroyed — the origin cache is a `Map` and the warm hook
 * refills it three seconds later — and the rule this screen follows is that a question is for
 * what cannot be undone. The React card did not ask either.
 *
 * ⚠️ IT IS THE THIRD DOOR TO THE SAME ACTION, and for three days it was the only dead one: the
 * rail's footer key and the command palette both work. So an owner who pressed THIS key watched
 * nothing happen, while the same action sat two clicks away behaving normally.
 *
 * ⚠️ `json.success`, NOT `res.ok` — which is what the rail reads, and the route answers through
 * the envelope. It answers `purged: true` whether the CDN purge succeeded, was skipped for want
 * of credentials, or was refused, so this can only report that the ASK went through.
 */
async function clearCache(key: HTMLButtonElement, w: ListWords): Promise<void> {
  key.disabled = true
  try {
    const res = await fetch('/api/cache/clear', { method: 'POST' })
    if (!await owned(res)) return
    const json = await res.json().catch(() => null) as { success?: boolean } | null
    if (!json?.success) throw new Error('failed')
    say(w.cacheCleared ?? '')
  } catch {
    say(w.cacheFailed ?? '', 'error')
  } finally {
    key.disabled = false
  }
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
  key.textContent = w.backupBusy ?? label
  try {
    const res = await fetch('/api/backup/run', { method: 'POST' })
    if (!res.ok) throw new Error('failed')
    await fillBackups(screen)
    say(w.backupDone ?? '')
  } catch {
    say(w.backupFailed ?? '', 'error')
  } finally {
    key.disabled = false
    key.textContent = label
  }
}

/**
 * ⚠️ THE ONE DELETE ON THIS SCREEN THAT NOTHING CAN UNDO, so it asks first.
 *
 * Everything else the admin deletes goes to the Trash and comes back. A snapshot does not:
 * `server/backup.ts` unlinks the archive, and if it was the only copy of a blog the blog is
 * gone with it. Between 2026-09-12 and 2026-09-15 this fetched on its first statement — the
 * React card it replaced had asked, and the screen's own comment said the button still had no
 * handler, so the gap read as intended.
 */
async function dropBackup(row: HTMLElement, name: string, w: ListWords): Promise<void> {
  // The archive's name goes in the BODY, because the title asks the question and no locale's
  // `askDeleteBackupTitle` carries a placeholder to put it in.
  const body = `${name} — ${w.askBackupBody ?? ''}`
  if (!await ask(w, w.askBackupTitle ?? '', body)) return
  const res = await fetch('/api/backup/delete', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
  }).catch(() => null)
  if (res?.ok) { row.remove(); say(w.removed ?? '') }
  else say(w.deleteFailed ?? '', 'error')
}

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

  /**
   * ⚠️ THE ADD KEY SHIPS DISABLED AND SOMETHING HAS TO ARM IT. A server cannot know whether the
   * two fields beside it are empty, so it draws the only state it can be sure of — and between
   * 2026-09-12 and 2026-09-15 nothing changed that state, which left a complete `add()` below
   * unreachable and manual redirects impossible to create. The React card it replaced recomputed
   * `disabled` on every keystroke; this is that, without the render.
   */
  const from = screen.querySelector<HTMLInputElement>('[data-redirect-source]')
  const to = screen.querySelector<HTMLInputElement>('[data-redirect-destination]')
  const key = screen.querySelector<HTMLButtonElement>('[data-redirect-add]')
  const arm = (): void => {
    if (key) key.disabled = !from?.value.trim() || !to?.value.trim()
  }
  from?.addEventListener('input', arm)
  to?.addEventListener('input', arm)
  arm()

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
  if (res?.ok) { line.remove(); say(w.removed ?? '') }
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
    // The server's own sentence when it has one — "that source is a live post", "the
    // destination is not a path" — and the redirect card's own fallback when it does not.
    // `saveFailed` was the fallback for three days, which on a screen with one Save key reads
    // as the whole form having failed.
    const said = await res?.json().catch(() => null) as { error?: string } | null
    say(said?.error || (w.redirectFailed ?? ''), 'error')
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
  from.dispatchEvent(new Event('input'))
  say(w.redirectSaved ?? '')
}
