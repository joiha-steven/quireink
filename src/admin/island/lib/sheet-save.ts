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
import { slugFromWords } from '@/content/untitled'

/** What a kind sends. The keys a kind does not have are left out rather than sent empty. */
export function payloadOf(
  kind: SheetKind, draft: SheetDraft, content: string, timezone: string,
  statusOverride?: SheetDraft['status'],
): Record<string, unknown> {
  // Always have a slug, so the API never refuses a piece that is only a body. A piece with
  // NO name is addressed by its first words before it falls back to the clock (ADR 0064); one
  // whose name slugifies to nothing (emoji, CJK) keeps the clock, as it always has.
  const name = (kind === 'note' ? (draft.title || draft.sourceTitle) : draft.title).trim()
  const named = draft.slug
    || (name ? slugify(name) : slugFromWords(content))
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
  // ADR 0056, on a post and a page but not a note. SECOND HAND-WRITTEN LIST, and the second
  // one this feature caught: `getPage` named its own columns and went stale the same way, so
  // the language reached the database and the sitemap and never reached the page. Here it was
  // the other direction — the panel took the answer, the island wrote it into the draft, and
  // the save left it out. Every field on this object is a field somebody has to remember, and
  // `sheet-save.test.ts` is what remembers for them.
  if (kind !== 'note') {
    base.lang = draft.lang || undefined
    base.translationGroup = draft.translationGroup.trim() || undefined
  }
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

/**
 * Can this go out? A page needs a name; a note may be named by its source; a POST may go out
 * with words and no name at all — that is a short post (ADR 0064), and the site calls it by
 * its first words wherever something has to be called something.
 */
export function nameEnough(kind: SheetKind, draft: SheetDraft, content: string): boolean {
  if (draft.title.trim() !== '') return true
  if (kind === 'post') return content.trim() !== ''
  return kind === 'note' && draft.sourceTitle.trim() !== ''
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
