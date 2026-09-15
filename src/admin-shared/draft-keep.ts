// KEEPING A DRAFT SAFE, without React anywhere near it.
//
// The editor writes two snapshots nobody asked for: one on this device, one on the server. They
// are not saves — a save writes the piece, and the piece is what a preview or a Publish reads —
// they are the answer to a laptop lid closing mid-sentence.
//
// ⚠️ PURE ONLY. This file is compiled for the SERVER as well, which has no `localStorage`, no
// `fetch` against a relative URL and no `navigator.sendBeacon`. Everything that touches a
// browser lives in `admin/island/lib/sheet-keep.ts`; what is here is the two decisions — what
// the line says, and which copy to offer — and those are the halves worth testing anyway.




/**
 * The line under "← Write": what has been kept, where, and when.
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
  t: { saving: string; savedAtPrefix: string; keptLocallyPrefix: string; keptOnServerPrefix: string; unsaved: string },
  saving: boolean,
  savedAt: string | null,
  dirty: boolean,
  keptAt: number | null,
  formatTime: (iso: string) => string,
  /** When the SERVER last accepted a snapshot, if it has. */
  sentAt: number | null = null,
): string {
  if (saving) return t.saving
  if (savedAt && !dirty) return `${t.savedAtPrefix} ${formatTime(savedAt)}`
  // The server outranks the device when it has something to say, and the wording is the
  // difference the writer cares about: one copy is on this machine, the other is not.
  if (dirty && sentAt !== null && (keptAt === null || sentAt >= keptAt)) {
    return `${t.keptOnServerPrefix} ${formatTime(new Date(sentAt).toISOString())}`
  }
  if (dirty && keptAt !== null) {
    return `${t.keptLocallyPrefix} ${formatTime(new Date(keptAt).toISOString())}`
  }
  if (dirty) return t.unsaved
  return savedAt ? `${t.savedAtPrefix} ${formatTime(savedAt)}` : ''
}

/** What the recovery line says, and which copy it is offering. */
export type Offer = { at: number; from: 'device' | 'server' } | null

/**
 * WHICH COPY TO OFFER, if either.
 *
 * A snapshot older than the row's last real save has been superseded: the writer saved AFTER
 * it, so putting it back would undo the save. And the DEVICE wins a tie — the copy on this
 * machine is the one this session wrote, and a tie means the same second, not the same work.
 */
export function pickOffer(o: {
  localAt: number | null
  serverAt: number | null
  /** When the row itself was last saved, or null for a piece with no row. */
  rowSavedAt: number | null
  dismissed: boolean
}): Offer {
  if (o.dismissed) return null
  const serverUsable = o.serverAt !== null && (o.rowSavedAt === null || o.serverAt > o.rowSavedAt)
  if (serverUsable && (o.localAt === null || o.serverAt! > o.localAt)) {
    return { at: o.serverAt!, from: 'server' }
  }
  if (o.localAt !== null) return { at: o.localAt, from: 'device' }
  return null
}
