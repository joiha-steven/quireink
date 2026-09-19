// SEVERAL PIECES, ONE REQUEST.
//
// The write column has had a selection mode since the port: tick some rows, press the bin.
// What it did not have was anywhere to send them, and `island/lib/write-pick.ts` said so in
// capitals — "ONE REQUEST PER PIECE, because there is no bulk endpoint". Fifty ticks were
// fifty parallel DELETEs, and each one of those is a write:
//
//   * fifty page-cache flushes, because `web/guard.ts` flushes after every successful
//     state-changing request through the owner gate (Invariant 1). Forty-nine of those throw
//     away renders the previous one had already invalidated;
//   * fifty CDN purges, on an install that has a CDN configured, since the purge rides that
//     same flush hook;
//   * fifty rows in the activity log for one press of one key, on the screen that was just
//     changed to open on a hundred rows because the owner wanted to READ it.
//
// So: one route, and therefore one flush and one log row.
//
// ⚠️ THERE IS NO `clearCache()` IN THIS FILE, and that is not an oversight. The owner gate
// flushes on the way out of every 2xx write, which is exactly once per request however many
// pieces the request named. A hand-placed call here would be a SECOND flush, and the only
// reason to write one would be to say something sharper than the gate does — there is
// nothing sharper to say.
//
// THE KIND IS WHAT THE LOG PRINTS, which is `web/admin/ops.ts`'s lesson from the four
// importers that all recorded themselves as WordPress. Three actions here, not one with the
// verb hidden in a detail line nobody reads.
//
// SEQUENTIAL, not `Promise.all`. SQLite has one writer, so the parallelism bought nothing;
// what it cost was an order — the log's detail line now lists the pieces in the order they
// were actually acted on, and a failure halfway through leaves a prefix rather than a
// scattering.

import type { Context } from 'hono'
import { getPost, savePost, deletePost } from '@/content/posts'
import { getPage, savePage, deletePage } from '@/content/pages'
import { getNote, saveNote, deleteNote } from '@/content/notes'
import { logActivity, type ActivityAction } from '@/server/activity'
import { fail, json } from '@/web/api'
import { ownerRouter } from '@/web/guard'
import { BULK_MAX } from '@/admin-shared/write'

export type BulkAction = 'trash' | 'publish' | 'draft'
export type BulkKind = 'post' | 'page' | 'note'
export type BulkPiece = { kind: BulkKind; slug: string }
export type BulkFailure = BulkPiece & { reason: 'not_found' | 'failed' }

/** The ceiling on one request, shared with the column that draws the key. */
export { BULK_MAX } from '@/admin-shared/write'

const ACTIONS: Record<BulkAction, ActivityAction> = {
  trash: 'content.trash',
  publish: 'content.publish',
  draft: 'content.draft',
}

const isKind = (v: unknown): v is BulkKind => v === 'post' || v === 'page' || v === 'note'
const isAction = (v: unknown): v is BulkAction =>
  v === 'trash' || v === 'publish' || v === 'draft'

/** Move one piece to the Trash. Soft, like every delete here (Invariant 6). */
async function bin(piece: BulkPiece): Promise<void> {
  if (piece.kind === 'post') return deletePost(piece.slug)
  if (piece.kind === 'page') return deletePage(piece.slug)
  return deleteNote(piece.slug)
}

/**
 * Set one piece's status, or report that there is nothing at that slug.
 *
 * ⚠️ THE WHOLE PIECE GOES BACK IN, not `{ slug, status }`. Every `save*` here normalises a
 * partial input into a complete one, so a save naming two fields would blank the title, the
 * body and the taxonomy of everything it touched. Read, change the one word, write.
 *
 * ⚠️ AND NO REVISION IS PUSHED. A post's `projection` includes its status, so a status flip
 * counts as a change and `savePost` would snapshot the version before it — fifty of those on
 * a bulk publish, and only three are kept per post, so the owner's time machine would be
 * three identical copies of the current body with the word "draft" in them and the actual
 * earlier drafts gone. The body did not change; there is nothing to keep.
 */
async function setStatus(piece: BulkPiece, status: 'published' | 'draft'): Promise<boolean> {
  if (piece.kind === 'post') {
    const post = await getPost(piece.slug)
    if (!post) return false
    if (post.status !== status) await savePost({ ...post, status }, piece.slug, { revision: false })
    return true
  }
  if (piece.kind === 'page') {
    const page = await getPage(piece.slug)
    if (!page) return false
    if (page.status !== status) await savePage({ ...page, status }, piece.slug)
    return true
  }
  const note = await getNote(piece.slug)
  if (!note) return false
  if (note.status !== status) await saveNote({ ...note, status }, piece.slug)
  return true
}

/**
 * The pieces, as the OBJECT of the log's sentence — `page:about, post:on-ligatures +38`.
 *
 * ⚠️ IT GOES THROUGH `{t}` IN THE DICTIONARY, so it has to read as the tail of a sentence
 * rather than as a record of its own. The first cut wrote `publish: 2 — page:about, …`, which
 * the log then dropped entirely: `logSentence` removes the placeholder's slot when a pattern
 * has none, and that pattern had none. Found by reading the screen, not by a test.
 *
 * NO COUNT IN THE SENTENCE. Half these languages need a plural form for one, which is the
 * argument `selectPieces` already lost; `+38` carries the same fact and needs no grammar.
 */
function detailLine(done: BulkPiece[]): string {
  const NAMED = 8
  const names = done.slice(0, NAMED).map((p) => `${p.kind}:${p.slug}`).join(', ')
  const rest = done.length - Math.min(done.length, NAMED)
  return `${names}${rest > 0 ? ` +${rest}` : ''}`
}

export function bulkRoutes() {
  const router = ownerRouter()

  router.post('/api/content/bulk', async (c: Context) => {
    const input = await c.req.json().catch(() => ({})) as {
      action?: unknown
      pieces?: unknown
    }
    if (!isAction(input.action)) return fail(c, 'bad_action', 400)
    if (!Array.isArray(input.pieces) || input.pieces.length === 0) return fail(c, 'no_pieces', 400)
    if (input.pieces.length > BULK_MAX) return fail(c, `too_many:${BULK_MAX}`, 413)

    const pieces: BulkPiece[] = []
    for (const raw of input.pieces) {
      const piece = raw as { kind?: unknown; slug?: unknown }
      if (!isKind(piece.kind) || typeof piece.slug !== 'string' || piece.slug === '') {
        return fail(c, 'bad_piece', 400)
      }
      pieces.push({ kind: piece.kind, slug: piece.slug })
    }

    const action = input.action
    const done: BulkPiece[] = []
    const failed: BulkFailure[] = []
    for (const piece of pieces) {
      try {
        if (action === 'trash') {
          await bin(piece)
          done.push(piece)
        } else {
          const found = await setStatus(piece, action === 'publish' ? 'published' : 'draft')
          if (found) done.push(piece)
          else failed.push({ ...piece, reason: 'not_found' })
        }
      } catch (error) {
        // ONE PIECE, NOT THE REQUEST. Nineteen of twenty moved is nineteen the owner does not
        // have to do again, and the twentieth is named in the answer so the column can leave
        // it on screen still ticked.
        console.error(`[ERROR] content.bulk ${action} ${piece.kind}:${piece.slug}: ${(error as Error).message}`)
        failed.push({ ...piece, reason: 'failed' })
      }
    }

    // ONE ROW, and only when something actually moved: a press that found nothing is not an
    // event in the blog's history. The flush is the gate's, on the way out of this handler.
    if (done.length > 0) void logActivity(ACTIONS[action], detailLine(done))
    return json({ done, failed })
  })

  return router
}
