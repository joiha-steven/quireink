// The other half of the editor's autosave: the copy that is not on this machine.
//
// `useLocalDraft.ts` keeps the snapshot in localStorage and has since M2. It survives a crash,
// a pull-to-refresh and a closed tab, and it cannot survive the laptop — which is the failure
// that actually costs somebody a morning. This hook sends the same snapshot to
// `POST /api/{posts,pages}/:slug/autosave`, where it lands in a column of its own and NEVER in
// the body a reader is served (`content/autosave.ts` carries that promise and its reasoning).
//
// THE SAME THREE FLUSHES as the local hook, for the same reason its header gives: widening the
// interval must not widen the window of lost work. Interval, `pagehide`, `visibilitychange` to
// hidden — and the last two go by `sendBeacon`, because a `fetch` started as the tab goes away
// is routinely killed mid-flight and a beacon is the browser's own answer to that. It is also
// why the route is a POST: `sendBeacon` speaks no other verb.
//
// IT SENDS NOTHING IT HAS ALREADY SENT. The snapshot is compared with the last one that
// landed, so a tab left open on an untouched post is silent rather than writing the same
// kilobyte every two minutes forever.
import { useEffect, useRef, useState } from 'react'
import { useLocalAutosave, useLocalDraft } from './useLocalDraft'

export type ServerDraftKind = 'post' | 'page'

const path = (kind: ServerDraftKind, slug: string): string =>
  `/api/${kind === 'post' ? 'posts' : 'pages'}/${encodeURIComponent(slug)}/autosave`

/**
 * Is there a server at the other end of a relative URL?
 *
 * There is not, in two places this code runs: a mounted-component test, whose document sits at
 * `about:blank`, and any future context served from a `blob:` or `data:` document. A beacon
 * there is not merely useless — happy-dom raises on the relative URL, out of an unmount effect,
 * where it fails the test rather than the feature. Asking first is cheaper than catching, and
 * it is also the true statement: with no origin there is nothing to autosave TO.
 */
const servable = (): boolean =>
  typeof location !== 'undefined' && (location.protocol === 'http:' || location.protocol === 'https:')

/**
 * Push the snapshot on a timer and on the way out; report when one last landed.
 *
 * `slug` null is a piece that has never been saved. There is no row to hang a snapshot on, so
 * this does nothing at all and localStorage stays its only copy — the honest behaviour, and the
 * server says the same thing with a 404 if it is asked anyway.
 *
 * Returns the moment of the last snapshot the SERVER accepted, so the editor can say so. A
 * failed request leaves it alone: claiming a save that 500ed is the one thing an autosave
 * indicator must never do.
 */
export function useServerAutosave(
  kind: ServerDraftKind,
  slug: string | null,
  isDirty: () => boolean,
  snapshot: () => string,
  intervalMs: number,
): number | null {
  const isDirtyRef = useRef(isDirty)
  const snapshotRef = useRef(snapshot)
  isDirtyRef.current = isDirty
  snapshotRef.current = snapshot
  // What the server already holds. Compared rather than hashed: the strings are kilobytes and
  // a comparison of two kilobyte strings is not the expensive part of anything here.
  const sentRef = useRef<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!slug) return
    const url = path(kind, slug)

    // `keepalive`, not a beacon: this one runs while the page is alive and wants to know
    // whether it worked, and a beacon reports nothing back.
    const send = async () => {
      if (!servable() || !isDirtyRef.current()) return
      const body = snapshotRef.current()
      if (body === sentRef.current) return
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ snapshot: body }),
        })
        if (!res.ok) return
        sentRef.current = body
        setSavedAt(Date.now())
      } catch {
        // Offline, or the server is down. The local snapshot is still being written on the
        // same rhythm by the hook next door, which is the whole point of keeping both.
      }
    }

    // The way out. No await is possible here and none is wanted: a beacon is queued by the
    // browser and delivered after the document is gone.
    const beacon = () => {
      if (!servable() || !isDirtyRef.current()) return
      const body = snapshotRef.current()
      if (body === sentRef.current) return
      try {
        const blob = new Blob([JSON.stringify({ snapshot: body })], { type: 'application/json' })
        if (navigator.sendBeacon(url, blob)) sentRef.current = body
      } catch {
        // Some browsers throw on a beacon over the size limit. Nothing to do but leave it.
      }
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') beacon()
    }

    const id = setInterval(() => void send(), intervalMs)
    window.addEventListener('pagehide', beacon)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      clearInterval(id)
      window.removeEventListener('pagehide', beacon)
      document.removeEventListener('visibilitychange', onHidden)
      beacon()
    }
  }, [kind, slug, intervalMs])

  return savedAt
}

/** What `GET …/autosave` answers with. `json` is the snapshot the editor stored. */
export type ServerSnapshot = { json: string; at: number }

/**
 * Fetch the stored snapshot, for the moment somebody presses Restore.
 *
 * Separate from the timestamp the editor is handed on open, because the snapshot is the whole
 * body a second time: paying for it on every editor open, on every post, to answer a question
 * a timestamp already answers, is a real cost on a long piece.
 */
export async function fetchServerDraft<T>(kind: ServerDraftKind, slug: string): Promise<T | null> {
  try {
    const res = await fetch(path(kind, slug))
    if (!res.ok) return null
    const parsed = (await res.json()) as { success?: boolean; data?: ServerSnapshot }
    if (!parsed.data?.json) return null
    return JSON.parse(parsed.data.json) as T
  } catch {
    return null
  }
}

/** What the recovery line in the action bar needs, and where the snapshot came from. */
export type Recovered = { at: string; from: 'device' | 'server' }

/**
 * Both halves of the editor's safety net, composed, so a form wires one hook and not four.
 *
 * The two are not alternatives. The device copy is instant, survives a crash and works with no
 * network; the server copy survives the device. Both run on the same rhythm and the editor
 * offers back whichever is NEWER — which is almost always the device's, and is the server's in
 * exactly the case the device copy cannot help with: a different machine.
 *
 * `rowSavedAt` is when the server row was last really saved. A snapshot older than that has
 * been superseded by a save and is not offered. `savePost` already clears it, so this is the
 * second lock on the same door — and the cheap one, because the expensive failure is offering
 * somebody yesterday's paragraph as if it were their newest.
 */
export function useDraftSafety<T>(opts: {
  kind: ServerDraftKind
  /** null until the piece has been saved once and has a row. */
  slug: string | null
  storageKey: string
  /** `autosave_at` from the editor view, in ms. */
  serverAt: number | null
  /** The row's own `updatedAt`, in ms. */
  rowSavedAt: number | null
  isDirty: () => boolean
  snapshot: () => T
  intervalMs: number
}): {
  recovered: Recovered | null
  restore: () => Promise<T | null>
  dismiss: () => void
  clear: () => void
  keptAt: number | null
  sentAt: number | null
} {
  const local = useLocalDraft<T>(opts.storageKey)
  const keptAt = useLocalAutosave(opts.isDirty, opts.snapshot, local.save, opts.intervalMs)
  const sentAt = useServerAutosave(
    opts.kind,
    opts.slug,
    opts.isDirty,
    () => JSON.stringify(opts.snapshot()),
    opts.intervalMs,
  )
  const [serverDismissed, setServerDismissed] = useState(false)

  const serverUsable =
    opts.serverAt !== null &&
    !serverDismissed &&
    (opts.rowSavedAt === null || opts.serverAt > opts.rowSavedAt)
  const localAt = local.recovered ? Date.parse(local.recovered.at) : null
  // The device wins a tie. A snapshot written on this machine and one written on the server in
  // the same second are the same keystrokes; offering the round trip is offering a slower copy
  // of what is already here.
  const useServer = serverUsable && (localAt === null || opts.serverAt! > localAt)

  const recovered: Recovered | null = useServer
    ? { at: new Date(opts.serverAt!).toISOString(), from: 'server' }
    : local.recovered
      ? { at: local.recovered.at, from: 'device' }
      : null

  return {
    recovered,
    restore: async () => {
      if (useServer && opts.slug) {
        const fetched = await fetchServerDraft<T>(opts.kind, opts.slug)
        if (fetched) setServerDismissed(true)
        return fetched
      }
      const data = local.recovered?.data ?? null
      local.clear()
      return data
    },
    dismiss: () => {
      if (useServer) setServerDismissed(true)
      else local.dismiss()
    },
    clear: () => {
      setServerDismissed(true)
      local.clear()
    },
    keptAt,
    sentAt,
  }
}
