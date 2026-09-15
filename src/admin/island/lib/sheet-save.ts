// SAVING THE PIECE: the draft as the API's shape, and the one request that writes it.
//
// Pure where it can be — `payloadOf` is a conversion between two shapes and nothing else, so it
// is testable without a server, a browser or a piece. What is left is one `fetch` and the three
// answers it can give.
//
// ⚠️ THE DATE IS THE PART THAT IS EASY TO GET WRONG. `draft.date` is a wall clock on the SITE's
// zone, and turning it back into an instant needs the site's zone rather than the zone of
// whichever machine is typing. A post scheduled from a laptop on UTC went out seven hours late
// in Hanoi, and the line under the field agreed with the laptop.
import { API_PATH, type SheetDraft, type SheetKind } from '@/admin-shared/sheet-wire'
import { slugify, zonedInputToIso } from '@/utils'

/** What a kind sends. The keys a kind does not have are left out rather than sent empty. */
export function payloadOf(
  kind: SheetKind, draft: SheetDraft, content: string, timezone: string,
  statusOverride?: SheetDraft['status'],
): Record<string, unknown> {
  // Always have a slug, so the API never refuses a piece that is only a body.
  const named = draft.slug
    || slugify(kind === 'note' ? (draft.title || draft.sourceTitle) : draft.title)
    || `${kind}-${Date.now()}`
  const base: Record<string, unknown> = {
    title: draft.title,
    slug: named,
    status: statusOverride ?? draft.status,
    content,
  }
  // A page has no date and no schedule: it is not in the archive and nothing waits for it.
  if (kind !== 'page') {
    base.date = draft.date ? zonedInputToIso(draft.date, timezone) : new Date().toISOString()
  }
  if (kind === 'post') {
    base.categories = draft.categories
    base.tags = draft.tags
    // `undefined` CLEARS, and that is not an accident of the wire: the row is written whole on
    // every save, so a field emptied on screen has to arrive as nothing rather than be left out.
    base.series = draft.series.trim() || undefined
    base.seriesOrder = draft.series.trim() ? draft.seriesOrder : undefined
    base.featuredImage = draft.featuredImage || undefined
    base.coverImage = draft.coverImage || undefined
    base.metaTitle = draft.metaTitle.trim() || undefined
    base.metaDescription = draft.metaDescription.trim() || undefined
    base.excerpt = draft.excerpt
  }
  if (kind === 'page') base.featuredImage = draft.featuredImage || undefined
  if (kind === 'note') {
    base.sourceUrl = draft.sourceUrl.trim() || undefined
    base.sourceTitle = draft.sourceTitle.trim() || undefined
    base.quote = draft.quote.trim() || undefined
  }
  return base
}

/** Is there anything at all to store? A piece with no words and no name is not a piece. */
export function worthSaving(kind: SheetKind, draft: SheetDraft, content: string): boolean {
  if (draft.title.trim() || content.trim()) return true
  return kind === 'note' && draft.sourceTitle.trim() !== ''
}

/** Can this go out? A published piece needs a name; a note may be named by its source. */
export function nameEnough(kind: SheetKind, draft: SheetDraft): boolean {
  return draft.title.trim() !== '' || (kind === 'note' && draft.sourceTitle.trim() !== '')
}

export type SaveResult =
  | { ok: true; slug: string }
  | { ok: false; reason: 'slug_taken' | 'failed' }

/**
 * Write the piece.
 *
 * `editing` is the slug the row is under RIGHT NOW, which is not always the slug being sent: a
 * rename is a PUT to the old address carrying the new one. Empty means there is no row yet.
 */
export async function savePiece(
  kind: SheetKind, editing: string, body: Record<string, unknown>,
): Promise<SaveResult> {
  const at = API_PATH[kind]
  const res = await fetch(editing ? `${at}/${encodeURIComponent(editing)}` : at, {
    method: editing ? 'PUT' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null) as
    { success?: boolean; data?: { slug?: string }; error?: string } | null
  if (!res.ok || !json?.success) {
    // The one refusal worth its own word: two pieces cannot share an address, and "could not
    // save" sends somebody looking for a network fault.
    return { ok: false, reason: json?.error === 'slug_taken' ? 'slug_taken' : 'failed' }
  }
  return { ok: true, slug: json.data?.slug ?? String(body.slug ?? '') }
}
