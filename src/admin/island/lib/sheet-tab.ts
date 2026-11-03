// WHICH DEVICE COPY A NEW, UNSAVED SHEET WRITES TO.
//
// A piece with a row keeps its copy under its slug (`draftKey`). A piece with none had one key
// for every unsaved piece of its kind, `quire:draft:post:new`, so a second "New post" tab opened
// with the first one's words in it, and with both closed only the words of whichever closed last
// were left anywhere (2026-11-03). Each sheet now has a key of its own, `…:new:<id>`, with the id
// kept in `sessionStorage` so a reload of the same tab finds its own words again.
//
// A NEW tab has no id yet. It may take over a copy no open tab is holding, which is the case
// the single key was there for: the tab that crashed, or was closed before Save. To tell such a
// copy from one an open tab is still writing, every open sheet holds a LEASE in `localStorage`,
// renewed every few seconds and dropped on `pagehide`. No lease, or one nobody renewed, is an
// orphan; a live lease is somebody else's work and is left alone.
//
// Every access is in a `try`, for the reason `sheet-keep.ts` gives: a private window throws on
// read as readily as on write, and the editor must still open.
import type { SheetDraft, SheetKind } from '@/admin-shared/sheet-wire'
import { draftKey } from '@/admin-shared/sheet-wire'
import { titleSlug } from '@/utils'
import { readSnapshot } from './sheet-keep'

/** A lease older than this belongs to a tab that is gone. Renewed at a third of it. */
export const LEASE_MS = 15_000

const tabKey = (kind: SheetKind) => `quire:sheet-tab:${kind}`
const leaseKey = (kind: SheetKind, id: string) => `quire:draft-lease:${kind}:${id}`
const newPrefix = (kind: SheetKind) => `${draftKey(kind, '')}:`

const get = (store: Storage, key: string): string | null => {
  try { return store.getItem(key) } catch { return null }
}
const set = (store: Storage, key: string, value: string): void => {
  try { store.setItem(key, value) } catch { /* the copy is a courtesy; the sheet still opens */ }
}
const drop = (store: Storage, key: string): void => {
  try { store.removeItem(key) } catch { /* as above */ }
}

const leased = (kind: SheetKind, id: string, now: number): boolean => {
  const at = Number(get(localStorage, leaseKey(kind, id)))
  return Number.isFinite(at) && at > 0 && now - at < LEASE_MS
}
const takenAt = (key: string): number => {
  const raw = get(localStorage, key)
  if (!raw) return -1
  try { return Date.parse((JSON.parse(raw) as { at?: string }).at ?? '') || 0 } catch { return 0 }
}
const freshId = (): string => Math.random().toString(36).slice(2, 10)

export type NewSheet = {
  /** Where this sheet's device copy lives until its first save gives it a slug. */
  key: string
  /** True when the key already held words this sheet did not type: reopen them. */
  adopted: boolean
  /** The tab is leaving: give the copy up, so the next new sheet may reopen it. */
  release: () => void
  /** Stop renewing without giving the copy up (what a crash looks like, for tests). */
  stop: () => void
}

/** The newest copy of `kind` with no live lease, as its id ('' = the old shared key). */
function orphan(kind: SheetKind, now: number, except: string | null): string | null {
  let best: { id: string; at: number } | null = null
  const consider = (id: string, key: string) => {
    if (id === except || leased(kind, id, now)) return
    const at = takenAt(key)
    if (at >= 0 && (!best || at > best.at)) best = { id, at }
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(newPrefix(kind))) consider(key.slice(newPrefix(kind).length), key)
    }
  } catch { return null }
  consider('', draftKey(kind, ''))
  return (best as { id: string } | null)?.id ?? null
}

export function claimNewSheet(kind: SheetKind, now = Date.now()): NewSheet {
  const keyOf = (id: string) => `${newPrefix(kind)}${id}`
  let id = get(sessionStorage, tabKey(kind))
  // A live lease on this tab's own id is a DUPLICATED tab, which copied the session with it.
  if (id && leased(kind, id, now)) id = null
  let adopted = id !== null && takenAt(keyOf(id)) >= 0
  if (!adopted) {
    const found = orphan(kind, now, id)
    if (found === '') {
      // The single key from before: its words move onto a key of their own.
      id = freshId()
      const raw = get(localStorage, draftKey(kind, ''))
      if (raw) set(localStorage, keyOf(id), raw)
      drop(localStorage, draftKey(kind, ''))
      adopted = raw !== null
    } else if (found !== null) {
      id = found
      adopted = true
    }
  }
  const mine = id ?? freshId()
  set(sessionStorage, tabKey(kind), mine)

  const renew = (at = Date.now()) => set(localStorage, leaseKey(kind, mine), String(at))
  let timer: ReturnType<typeof setInterval> | null = null
  const start = (at = Date.now()) => {
    renew(at)
    if (timer !== null) return
    timer = setInterval(() => renew(), LEASE_MS / 3)
    ;(timer as { unref?: () => void }).unref?.()
  }
  const stop = () => { if (timer !== null) clearInterval(timer); timer = null }
  const release = () => { stop(); drop(localStorage, leaseKey(kind, mine)) }
  start(now)
  // Leaving gives the copy up at once, so the next new sheet reopens it without waiting out the
  // lease; coming back from the back-forward cache takes it again.
  window.addEventListener('pagehide', release)
  window.addEventListener('pageshow', (e) => { if (e.persisted) start() })
  return { key: keyOf(mine), adopted, release, stop }
}

/**
 * A NEW PIECE REOPENS FROM ITS SNAPSHOT.
 *
 * There is no row and so no server copy; the only record of a crash mid-draft is on this device,
 * and a blank sheet over the top of it is the work gone. Read before the editor is built, so it
 * opens with the words already in it rather than putting them in afterwards. Its OWN copy, or one
 * no open tab holds (above): a second "New post" tab is a second post.
 *
 * The title and slug boxes are filled here too. The server drew both empty for a piece with no
 * row, the body came back without them, and the next save stored a title the writer could not see
 * (2026-11-03). A slug that is not the title's own was typed, and stays put (`slugTyped`).
 */
export function reopenNew(
  kind: SheetKind, root: HTMLElement, draft: SheetDraft,
): NewSheet & { content: string | null; slugTyped: boolean } {
  const sheet = claimNewSheet(kind)
  const kept = sheet.adopted ? readSnapshot<SheetDraft & { content: string }>(sheet.key) : null
  if (!kept) return { ...sheet, content: null, slugTyped: false }
  Object.assign(draft, kept.data)
  const titleBox = root.querySelector<HTMLTextAreaElement>('[data-sheet-title]')
  const slugBox = root.querySelector<HTMLInputElement>('[data-k="slug"]')
  if (titleBox) titleBox.value = draft.title
  if (slugBox) slugBox.value = draft.slug
  return { ...sheet, content: kept.data.content, slugTyped: draft.slug !== '' && draft.slug !== titleSlug(draft.title) }
}
