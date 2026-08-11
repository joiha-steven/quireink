// Local (offline) autosave for the editor. A SERVER autosave is the wrong tool
// here: it can't help when the network is the thing that dropped, and on an
// already-published post it would push half-finished edits live. So in-progress
// work is stashed in localStorage and only ever reaches the server when the
// author clicks Save/Publish. On return, if a snapshot lingers (the last session
// closed/crashed with unsaved changes), the form offers to restore it.
import { useCallback, useEffect, useRef, useState } from 'react'

export type LocalSnapshot<T> = { data: T; at: string }

/**
 * The one line in the editor's save bar, for both editors.
 *
 * It used to read `saving` → `saved at HH:MM` → `unsaved`, and **never mentioned that the work
 * was already held locally** — which is why a feature that had been running since M2 read as
 * absent, and why the owner asked for an autosave that already existed. `unsaved` was also
 * simply untrue thirty seconds into typing: the snapshot was there, the sentence just did not
 * say so.
 *
 * Order is deliberate. The server always wins the line when it has something to say, because
 * that is the state the author is acting on; the local snapshot fills the gap that used to say
 * nothing useful. `dirty` with no snapshot yet is still `unsaved`, honestly — the first tick has
 * not happened.
 *
 * Shared rather than copied, because the two editors had two copies of the old expression and
 * they had already drifted: the page editor's had no `unsaved` branch at all.
 */
export function saveStatusLine(
  t: { saving: string; savedAtPrefix: string; keptLocallyPrefix: string; unsaved: string },
  saving: boolean,
  savedAt: string | null,
  dirty: boolean,
  keptAt: number | null,
  formatTime: (iso: string) => string,
): string {
  if (saving) return t.saving
  if (savedAt && !dirty) return `${t.savedAtPrefix} ${formatTime(savedAt)}`
  if (dirty && keptAt !== null) {
    return `${t.keptLocallyPrefix} ${formatTime(new Date(keptAt).toISOString())}`
  }
  if (dirty) return t.unsaved
  return savedAt ? `${t.savedAtPrefix} ${formatTime(savedAt)}` : ''
}

export function useLocalDraft<T>(key: string) {
  const [recovered, setRecovered] = useState<LocalSnapshot<T> | null>(null)

  // Read any lingering snapshot once on mount. A snapshot only survives if the
  // previous session ended without a successful server save (which clears it).
  // The setState is deferred to a frame so it lands after hydration (the bar is
  // never in the server HTML) and isn't a synchronous in-effect update.
  useEffect(() => {
    let raf = 0
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const snap = JSON.parse(raw) as LocalSnapshot<T>
        raf = requestAnimationFrame(() => setRecovered(snap))
      }
    } catch {
      // ignore corrupt/blocked storage — local autosave is best-effort
    }
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [key])

  const save = useCallback(
    (data: T) => {
      try {
        localStorage.setItem(key, JSON.stringify({ data, at: new Date().toISOString() }))
      } catch {
        // storage full / disabled — nothing we can do, don't break the editor
      }
    },
    [key],
  )

  // Drop the snapshot AND hide the bar (after a server save or an explicit restore).
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
    setRecovered(null)
  }, [key])

  // Hide the bar but keep the snapshot (the author dismissed it without restoring).
  const dismiss = useCallback(() => setRecovered(null), [])

  return { recovered, save, clear, dismiss }
}

/**
 * Keep the local snapshot current while the author works, and flush it on the way out.
 *
 * The interval alone was losing work, and the case was specific: on a phone, an over-scroll
 * at the top of the editor triggers the browser's pull-to-refresh and the page RELOADS, taking
 * everything typed since the last tick. `beforeunload` does not reliably fire there, so the
 * events that matter are `pagehide` and a `visibilitychange` to hidden. The unmount flush
 * covers leaving the editor by a route the admin's own router controls.
 *
 * `isDirty` and `snapshot` are read through refs so a caller can pass plain arrows without
 * re-arming the interval on every keystroke.
 *
 * **`intervalMs` is a setting now (`autosaveSeconds`, default 120), and the three flushes above
 * are why that is safe.** It was a hardcoded 8,000, and the owner asked for two minutes on
 * 2026-07-30. Widening the tick does not widen the window of lost work, because leaving,
 * hiding or unmounting the editor all flush regardless — which is also why NONE of them may be
 * removed to "simplify" this: at 8 seconds the interval was the safety net, at two minutes the
 * events are, and the settings sanitiser floors the value at 15 seconds so it can never be
 * tightened into being the only one again.
 *
 * Returns when it last wrote, so the editor can SAY so. That was the other half of the
 * complaint: the feature existed and looked absent, because the status bar only ever spoke
 * about the server.
 */
export function useLocalAutosave<T>(
  isDirty: () => boolean,
  snapshot: () => T,
  save: (data: T) => void,
  intervalMs: number,
): number | null {
  const isDirtyRef = useRef(isDirty)
  const snapshotRef = useRef(snapshot)
  isDirtyRef.current = isDirty
  snapshotRef.current = snapshot
  const [keptAt, setKeptAt] = useState<number | null>(null)

  useEffect(() => {
    const flush = () => {
      if (!isDirtyRef.current()) return
      save(snapshotRef.current())
      setKeptAt(Date.now())
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const id = setInterval(flush, intervalMs)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      clearInterval(id)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHidden)
      flush()
    }
  }, [save, intervalMs])

  return keptAt
}

/**
 * Ask before leaving with unsaved changes.
 *
 * A browser only honours this when the reader has interacted with the page, and never for a
 * pull-to-refresh, which is why the snapshot above is the real safety net and this is the
 * courtesy on top of it.
 */
export function useUnsavedGuard(isDirty: () => boolean): void {
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current()) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])
}
