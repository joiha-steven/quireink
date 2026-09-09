// The admin API for notes (ADR 0044): the same shape as the pages block in `content.ts`,
// in a file of its own because that one sits near its ceiling and because a note's save
// carries three fields a page never has. Every route is on the owner-gated router
// (Invariant 4), and every write empties the cache (Invariant 1).

import type { NoteWithContent } from '@/types'
import { getNoteIndex, getNote, saveNote, deleteNote } from '@/content/notes'
import { getAutosave, putAutosave } from '@/content/autosave'
import { SlugConflictError } from '@/content/slugs'
import { finalizeContentMedia } from '@/media/finalize'
import { clearCache } from '@/server/cache'
import { logActivity } from '@/server/activity'
import { fail, json } from '@/web/api'
import { ownerRouter, param } from '@/web/guard'
import type { Context } from 'hono'

/** The same ceiling the post and page autosaves have (`content.ts`). */
const AUTOSAVE_MAX = 1_000_000

const body = async <T>(c: Context): Promise<Partial<T>> => (await c.req.json()) as Partial<T>

export function noteRoutes() {
  const router = ownerRouter()

  router.get('/api/notes', async () => json(await getNoteIndex()))

  router.post('/api/notes', async (c) => {
    const input = await body<NoteWithContent>(c)
    if (!input.title?.trim() && !input.slug?.trim() && !input.sourceTitle?.trim()) {
      return fail(c, 'Title or slug is required', 400)
    }
    try {
      const meta = await saveNote(input)
      void finalizeContentMedia(input.content ?? '')
      clearCache()
      void logActivity('note.create', meta.title || meta.slug)
      return json(meta, 201)
    } catch (error) {
      if (error instanceof SlugConflictError) return fail(c, 'slug_taken', 409)
      throw error
    }
  })

  router.get('/api/notes/:slug', async (c) => {
    const note = await getNote(param(c, 'slug'))
    return note === null ? fail(c, 'Note not found', 404) : json(note)
  })

  router.put('/api/notes/:slug', async (c) => {
    const slug = param(c, 'slug')
    const input = await body<NoteWithContent>(c)
    try {
      const meta = await saveNote(input, slug)
      void finalizeContentMedia(input.content ?? '')
      clearCache()
      void logActivity('note.update', meta.title || meta.slug)
      return json(meta)
    } catch (error) {
      if (error instanceof SlugConflictError) return fail(c, 'slug_taken', 409)
      throw error
    }
  })

  router.post('/api/notes/:slug/autosave', async (c) => {
    const slug = param(c, 'slug')
    const input = await body<{ snapshot?: unknown }>(c)
    if (typeof input.snapshot !== 'string') return fail(c, 'snapshot must be a string', 400)
    if (input.snapshot.length > AUTOSAVE_MAX) return fail(c, 'snapshot too large', 413)
    return putAutosave('note', slug, input.snapshot)
      ? json({ slug, at: Date.now() })
      : fail(c, 'Note not found', 404)
  })

  router.get('/api/notes/:slug/autosave', async (c) => {
    const found = getAutosave('note', param(c, 'slug'))
    return found === null ? fail(c, 'No autosave', 404) : json(found)
  })

  router.delete('/api/notes/:slug', async (c) => {
    const slug = param(c, 'slug')
    await deleteNote(slug)
    clearCache()
    void logActivity('note.delete', slug)
    return json({ slug })
  })

  return router
}
