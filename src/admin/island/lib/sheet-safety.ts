// THE TWO COPIES NOBODY ASKED FOR: one on this device, one on the server.
//
// They are NOT saves. A save writes the piece, and the piece is what a preview or a Publish
// reads; these are the answer to a laptop lid closing mid-sentence. Neither ever touches the
// published body, so editing a live post cannot push half a sentence to a reader.
//
// THE TWO ARE NOT ALTERNATIVES. The device copy is instant, survives a crash and works with no
// network; the server copy survives the device. Both run on the same rhythm and the editor
// offers back whichever is NEWER — which is almost always the device's, and is the server's in
// exactly the case the device copy cannot help with: a different machine.
//
// ⚠️ THE KEY FOLLOWS THE PIECE, NOT THE SCREEN. A new post is filed under `new` until its first
// save gives it a slug, and everything typed after that save went on being filed under `new` —
// where the editor that reopens the post never looks, and where the next blank sheet reopens it
// as a piece of its own. `retarget()` is that moment, and it resets what the SERVER is known to
// hold too: the memo survived a rename, so the first snapshot for the new address was skipped
// as "already sent" because it had been sent to the old one.
//
// ⚠️ THREE FLUSHES, AND NONE MAY GO. `autosaveSeconds` is a setting (default 120) and the
// events are what make widening it safe: on a phone an over-scroll at the top of the editor
// triggers pull-to-refresh and the page RELOADS, taking everything typed since the last tick.
// `beforeunload` does not reliably fire there, so the two that matter are `pagehide` and
// `visibilitychange` to hidden.
import type { SheetDraft, SheetKind } from '@/admin-shared/sheet-wire'
import { draftKey } from '@/admin-shared/sheet-wire'
import { pickOffer, type Offer } from '@/admin-shared/draft-keep'
import {
  dropSnapshot, fetchSnapshot, readSnapshot, sendSnapshot, snapshotAt, writeSnapshot,
} from './sheet-keep'

/** What is kept: the draft, and the body with it. */
export type Snapshot = SheetDraft & { content: string }

export type SafetyHooks = {
  kind: SheetKind
  /** Empty until the piece has a row. */
  slug: string
  /** `autosave_at` on the row, in ms: a snapshot waiting from another session or machine. */
  serverAt: number | null
  /** The row's own last real save, in ms. A snapshot older than it has been superseded. */
  rowSavedAt: number | null
  dirty: () => boolean
  take: () => Snapshot
  intervalMs: number
  /** The offer changed: shown, taken, or turned down. */
  onOffer: (offer: Offer) => void
  /** A copy landed somewhere, so the save line can say where and when. */
  onKept: () => void
}

export type Safety = {
  readonly keptAt: number | null
  readonly sentAt: number | null
  /** The piece has a row now, or a different one. Both copies move with it. */
  retarget: (slug: string) => void
  /** Pull the newer copy back, or null if the fetch failed and nothing may be thrown away. */
  restore: () => Promise<Snapshot | null>
  /** Take the offer down and keep the copy: a second trip through the screen finds it too. */
  dismiss: () => void
  /** The server has the piece itself now — drop both copies. */
  clear: () => void
  destroy: () => void
}

export function wireSafety(hooks: SafetyHooks): Safety {
  let slug = hooks.slug
  let key = draftKey(hooks.kind, slug)
  let keptAt: number | null = snapshotAt(key)
  let sentAt: number | null = null
  let dismissed = false
  // What the server already holds, compared rather than hashed: the strings are kilobytes and
  // comparing two kilobyte strings is not the expensive part of anything here. It is what makes
  // a tab left open on an untouched post silent, rather than writing the same kilobyte forever.
  let sent: string | null = null

  const offerNow = (): Offer => pickOffer({
    localAt: keptAt,
    serverAt: hooks.serverAt,
    rowSavedAt: hooks.rowSavedAt,
    dismissed,
  })
  const tell = (): void => hooks.onOffer(offerNow())

  /** The device copy. Cheap, synchronous, and the only one a piece with no row can have. */
  const keep = (): void => {
    if (!hooks.dirty()) return
    const at = writeSnapshot(key, hooks.take())
    if (at === null) return
    keptAt = at
    hooks.onKept()
  }

  /**
   * The server copy. `keepalive`, not a beacon, while the page is alive: this one wants to know
   * whether it worked, and a beacon reports nothing back. A failed request leaves `sentAt`
   * alone — claiming a save that 500ed is the one thing an autosave indicator must never do.
   */
  const send = async (): Promise<void> => {
    if (!slug || !hooks.dirty()) return
    const body = JSON.stringify(hooks.take())
    if (body === sent) return
    if (!(await sendSnapshot(hooks.kind, slug, body))) return
    sent = body
    sentAt = Date.now()
    hooks.onKept()
  }

  /** The way out. No await is possible and none is wanted: a beacon outlives the document. */
  const beacon = (): void => {
    keep()
    if (!slug || !hooks.dirty()) return
    const body = JSON.stringify(hooks.take())
    if (body === sent) return
    void sendSnapshot(hooks.kind, slug, body, true).then((ok) => { if (ok) sent = body })
  }

  const tick = setInterval(() => { keep(); void send() }, hooks.intervalMs)
  const onHidden = (): void => { if (document.visibilityState === 'hidden') beacon() }
  /**
   * Ask before leaving with unsaved changes.
   *
   * A browser only honours this once the reader has interacted with the page, and never for a
   * pull-to-refresh — which is why the snapshots above are the real safety net and this is the
   * courtesy on top of them.
   */
  const onLeave = (e: BeforeUnloadEvent): void => {
    if (!hooks.dirty()) return
    e.preventDefault()
    e.returnValue = ''
  }
  window.addEventListener('pagehide', beacon)
  document.addEventListener('visibilitychange', onHidden)
  window.addEventListener('beforeunload', onLeave)
  tell()

  return {
    get keptAt() { return keptAt },
    get sentAt() { return sentAt },

    retarget: (next: string) => {
      if (next === slug) return
      const was = key
      slug = next
      key = draftKey(hooks.kind, next)
      // ⚠️ THE COPY MOVES WITH THE PIECE, and it is written before the old one is dropped.
      // A piece saved for the first time changes key from `new` to its own slug: everything
      // typed after that save went on being filed under `new` — where the editor that reopens
      // the piece never looks, and where the NEXT blank sheet reopens it as a piece of its own.
      // Dropping the old key alone would be the other half of the same fault, with the work
      // gone for as long as it takes the next tick to write it again.
      if (hooks.dirty()) {
        const at = writeSnapshot(key, hooks.take())
        if (at !== null) keptAt = at
      }
      dropSnapshot(was)
      // What the SERVER holds is per slug, and the memo survived a rename: the first snapshot
      // for the new address was then skipped as "already sent", because it had been sent to
      // the old one.
      sent = null
    },

    /**
     * ONE PIECE OF WORK, TWO COPIES OF IT — so taking one back retires BOTH.
     *
     * Each of these used to retire only the copy it had just dealt with, and the other came
     * straight back on screen: Restore the device copy, the device copy goes, "is there a
     * device copy?" reads null, and the bar reappears offering the server's — the same
     * keystrokes, a second time, one frame later. It reads as a screen that did not hear the
     * click. The two are written on the same tick by the same snapshot function, which is what
     * makes retiring both safe: they are not two pieces of work that each deserve an answer.
     */
    restore: async () => {
      const offer = offerNow()
      if (!offer) return null
      if (offer.from === 'server' && slug) {
        const got = await fetchSnapshot<Snapshot>(hooks.kind, slug)
        // Only on success: clearing the device copy after a failed fetch would throw away the
        // one copy still standing.
        if (!got) return null
        dismissed = true
        dropSnapshot(key)
        keptAt = null
        tell()
        return got
      }
      const snap = readSnapshot<Snapshot>(key)
      dismissed = true
      dropSnapshot(key)
      keptAt = null
      tell()
      return snap?.data ?? null
    },

    dismiss: () => { dismissed = true; tell() },

    clear: () => {
      dismissed = true
      dropSnapshot(key)
      keptAt = null
      sent = null
      tell()
    },

    destroy: () => {
      clearInterval(tick)
      window.removeEventListener('pagehide', beacon)
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('beforeunload', onLeave)
      beacon()
    },
  }
}
