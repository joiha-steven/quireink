// THE TWO SNAPSHOTS, in a browser.
//
// The editor writes copies nobody asked for: one on this device, one on the server. They are
// NOT saves — a save writes the piece, and the piece is what a preview or a Publish reads — they
// are the answer to a laptop lid closing mid-sentence. `admin-shared/draft-keep.ts` holds the
// two decisions (what the line says, which copy to offer); this holds the doing.
import type { SheetKind } from '@/admin-shared/sheet-wire'

/**
 * A snapshot on this device: the draft, and when it was taken.
 *
 * ⚠️ `at` IS AN ISO STRING, and it stays one. This is the shape already sitting in real
 * browsers' storage; writing epoch milliseconds instead would not break anything visibly — it
 * would silently orphan every snapshot a writer already had, on the one screen whose whole job
 * is not losing their work.
 */
export type LocalSnapshot<T> = { data: T; at: string }

/**
 * The stored snapshot, read straight out of storage.
 *
 * ⚠️ EVERY ACCESS IS IN A `try`. A private window, a blocked origin or a full store throws on
 * read as readily as on write, and losing the editor because a snapshot could not be fetched
 * would be the feature eating the thing it protects.
 */
export function readSnapshot<T>(key: string): LocalSnapshot<T> | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as LocalSnapshot<T>) : null
  } catch {
    return null
  }
}

/** Write one, and say when in epoch milliseconds. Null if storage refused, so the line does
 *  not claim a copy that was never made. */
export function writeSnapshot<T>(key: string, data: T): number | null {
  const now = new Date()
  try {
    localStorage.setItem(key, JSON.stringify({ data, at: now.toISOString() }))
    return now.getTime()
  } catch {
    return null
  }
}

/** When a stored snapshot was taken, in epoch milliseconds, or null if there is none. */
export function snapshotAt(key: string): number | null {
  const snap = readSnapshot<unknown>(key)
  if (!snap) return null
  const at = Date.parse(snap.at)
  return Number.isNaN(at) ? null : at
}

export function dropSnapshot(key: string): void {
  try { localStorage.removeItem(key) } catch { /* best effort, as above */ }
}

const autosavePath = (kind: SheetKind, slug: string): string =>
  `/api/${kind}s/${encodeURIComponent(slug)}/autosave`

/**
 * Is there a server at the other end of a relative URL?
 *
 * There is not in a mounted test, whose document sits at `about:blank`, nor in anything served
 * from a `blob:` or `data:` document. A beacon there is not merely useless: it raises on the
 * relative URL, out of an unmount, where it fails the test rather than the feature. Asking
 * first is cheaper than catching, and it is also the true statement — with no origin there is
 * nothing to autosave TO.
 */
export const servable = (): boolean =>
  typeof location !== 'undefined' && (location.protocol === 'http:' || location.protocol === 'https:')

/**
 * Push a snapshot at the server. `beacon` is for the way out, where a `fetch` is cancelled with
 * the page; it cannot report success, so the caller only records one when a real request lands.
 */
export async function sendSnapshot(
  kind: SheetKind, slug: string, json: string, beacon = false,
): Promise<boolean> {
  if (!slug || !servable()) return false
  const body = JSON.stringify({ snapshot: json })
  if (beacon) {
    try {
      return navigator.sendBeacon(autosavePath(kind, slug), new Blob([body], { type: 'application/json' }))
    } catch { return false }
  }
  try {
    const res = await fetch(autosavePath(kind, slug), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    })
    return res.ok
  } catch { return false }
}

/**
 * The server's copy, fetched only when somebody says yes to the offer.
 *
 * Separate from the timestamp the editor is handed on open, because the snapshot is the whole
 * body a second time: paying for it on every editor open, on every post, to answer a question a
 * timestamp already answers, is a real cost on a long piece.
 */
export async function fetchSnapshot<T>(kind: SheetKind, slug: string): Promise<T | null> {
  try {
    const res = await fetch(autosavePath(kind, slug))
    if (!res.ok) return null
    const parsed = (await res.json()) as { data?: { json?: string } }
    return parsed.data?.json ? (JSON.parse(parsed.data.json) as T) : null
  } catch {
    return null
  }
}


