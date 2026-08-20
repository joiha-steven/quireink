// The rest of the content-adjacent admin API: taxonomy, series, redirects, settings,
// trash, the activity log and the cache purge.
//
// Ported from `src/app/api/{taxonomy,series,redirects,settings,trash,activity,cache}`.
// Same paths, same request shapes, same status codes. The per-handler `requireOwner()`,
// the `logRequest`/`logError` pairs and the try/catch are gone for the reasons set out in
// `content.ts`, not because any behaviour was reconsidered.

import type { Context } from 'hono'
import type { SiteSettings } from '@/types'
import { reorderSeries, updateSeries } from '@/content/series'
import { saveSettings } from '@/content/settings'
import { sanitizeListPath } from '@/content/settings-sanitize'
import { one } from '@/store/query'
import {
  restorePost, purgePost, emptyPostsTrash, updateTerm, type TermKind,
} from '@/content/posts'
import { restorePage, purgePage, emptyPagesTrash } from '@/content/pages'
import {
  restoreMediaBatch, purgeMediaBatch, emptyMediaTrash, getTrashedMedia,
} from '@/media/media'
import { usedMediaKeys } from '@/media/media-usage'
import { collapseBlob } from '@/media/blob'
import { restoreFilesBatch, purgeFilesBatch, emptyFilesTrash } from '@/media/files'
import { restoreComment, purgeComment, emptyCommentsTrash } from '@/comments/comments'
import { restoreSubscriber, purgeSubscriber, emptySubscribersTrash } from '@/news/subscribers'
import { getRedirects, saveRedirect, deleteRedirect, RedirectInputError } from '@/server/redirects'
import { purgeEdge } from '@/server/edge-cache'
import { clearCache } from '@/server/cache'
import { clearActivity, getActivity, logActivity, type ActivityAction } from '@/server/activity'
import { fail, json } from '@/web/api'
import { ownerRouter, param } from '@/web/guard'

const body = async <T>(c: Context): Promise<Partial<T>> =>
  (await c.req.json().catch(() => ({}))) as Partial<T>

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []

type Kind = 'posts' | 'pages' | 'media' | 'files' | 'comments' | 'subscribers'
type Action = 'restore' | 'purge' | 'empty'
const KINDS: Kind[] = ['posts', 'pages', 'media', 'files', 'comments', 'subscribers']
const ACTIONS: Action[] = ['restore', 'purge', 'empty']
// The activity log uses singular per-kind verbs, matching the actions that already exist.
const SINGULAR: Record<Kind, string> = {
  posts: 'post', pages: 'page', media: 'media', files: 'file', comments: 'comment',
  subscribers: 'subscriber',
}

export function siteRoutes() {
  const router = ownerRouter()

  // ----- taxonomy and series --------------------------------------------------
  // Both rewrite every affected post's front matter, so both can take a while on a large
  // blog. That was `maxDuration = 60` in the frozen tree; here there is no platform
  // timeout to declare, which is one of the things leaving serverless bought.

  router.post('/api/taxonomy', async (c) => {
    const input = await body<{ kind: string; name: string; action: string; newName: string }>(c)
    const kind: TermKind | null =
      input.kind === 'tag' ? 'tag' : input.kind === 'category' ? 'category' : null
    const name = input.name?.trim()
    if (kind === null || !name) return fail(c, 'kind and name are required', 400)

    const newName = input.action === 'rename' ? (input.newName?.trim() ?? '') : null
    if (input.action === 'rename' && !newName) return fail(c, 'newName is required to rename', 400)

    const changed = await updateTerm(kind, name, newName)
    clearCache()
    void logActivity(
      'taxonomy.update',
      `${kind} "${name}"${newName ? ` → "${newName}"` : ' (removed)'} · ${changed} post(s)`,
    )
    return json({ changed })
  })

  router.post('/api/series', async (c) => {
    const input = await body<{ action: string; name: string; newName: string; order: string[] }>(c)
    const name = input.name?.trim()
    if (!name) return fail(c, 'name is required', 400)

    let changed = 0
    let detail = ''
    if (input.action === 'rename') {
      const newName = input.newName?.trim() ?? ''
      if (!newName) return fail(c, 'newName is required to rename', 400)
      changed = await updateSeries(name, newName)
      detail = `"${name}" → "${newName}"`
    } else if (input.action === 'delete') {
      changed = await updateSeries(name, null)
      detail = `"${name}" (removed)`
    } else if (input.action === 'reorder') {
      const order = strings(input.order)
      if (order.length === 0) return fail(c, 'order is required to reorder', 400)
      changed = await reorderSeries(name, order)
      detail = `"${name}" reordered`
    } else {
      return fail(c, 'unknown action', 400)
    }

    clearCache()
    void logActivity('series.update', `${detail} · ${changed} post(s)`)
    return json({ changed })
  })

  // ----- redirects ------------------------------------------------------------

  router.get('/api/redirects', async () => json(await getRedirects()))

  router.post('/api/redirects', async (c) => {
    const input = await body<{ source: unknown; destination: unknown; permanent: unknown }>(c)
    try {
      await saveRedirect({
        source: typeof input.source === 'string' ? input.source : '',
        destination: typeof input.destination === 'string' ? input.destination : '',
        // Default 301. Only an explicit `false` makes it temporary.
        permanent: input.permanent !== false,
      })
    } catch (error) {
      // The message is the validation reason and IS meant for the caller, unlike the
      // generic 500 path where an exception string could carry anything.
      if (error instanceof RedirectInputError) return fail(c, error.message, 400)
      throw error
    }
    clearCache()
    void logActivity('redirect.save', String(input.source ?? ''))
    return json({ ok: true }, 201)
  })

  router.delete('/api/redirects/:id', async (c) => {
    const id = Number(param(c, 'id'))
    if (!Number.isInteger(id)) return fail(c, 'Invalid id', 400)
    await deleteRedirect(id)
    clearCache()
    void logActivity('redirect.delete', String(id))
    return json({ id })
  })

  // ----- settings -------------------------------------------------------------
  // No public GET: every public read goes through `getSettings()` server-side.

  router.put('/api/settings', async (c) => {
    const input = await body<SiteSettings>(c)
    // The other half of the slug guard in `content/slugs.ts`. That one stops a POST taking
    // the list's path; this stops the list being pointed at a path a post already holds,
    // which the sanitizer cannot see because it is pure and this needs the database.
    // Refusing is the only honest answer: whichever of the two lost would simply disappear.
    const listPath = sanitizeListPath(input?.home?.listPath, '')
    if (input?.home?.mode && input.home.mode !== 'list' && listPath) {
      const slug = listPath.slice(1)
      if (one<{ slug: string }>(`select slug from posts where slug = ?`, slug)
        || one<{ slug: string }>(`select slug from pages where slug = ?`, slug)) {
        return fail(c, `list_path_taken: ${slug}`, 409)
      }
    }
    const next = await saveSettings(input)
    // The frozen tree purged everything and then re-warmed several pages, because a cold
    // ISR miss was expensive. Here a page re-renders from SQLite in well under a
    // millisecond, so warming would be work done to avoid work that is already free.
    clearCache()
    void logActivity('settings.save')
    return json(next)
  })

  // ----- the activity log -----------------------------------------------------

  router.get('/api/activity', async () => json(await getActivity()))

  router.delete('/api/activity', async () => {
    await clearActivity()
    return json({ cleared: true })
  })

  // ----- the cache purge ------------------------------------------------------

  router.post('/api/cache/clear', async () => {
    clearCache()
    // The origin cache is a Map and is already empty; what is left to purge is the edge,
    // which this server does not control and cannot re-render.
    await purgeEdge()
    void logActivity('cache.clear')
    return json({ purged: true })
  })

  // ----- trash ----------------------------------------------------------------

  router.post('/api/trash', async (c) => {
    const input = await body<{ kind: unknown; action: unknown; ids: unknown; force: unknown }>(c)
    const kind = input.kind as Kind
    const action = input.action as Action
    const force = input.force === true
    if (!KINDS.includes(kind) || !ACTIONS.includes(action)) {
      return fail(c, 'Invalid kind or action', 400)
    }
    const ids = strings(input.ids)
    if (action !== 'empty' && ids.length === 0) return fail(c, 'No ids provided', 400)

    let count = ids.length
    switch (kind) {
      case 'posts':
        if (action === 'restore') await Promise.all(ids.map(restorePost))
        else if (action === 'purge') await Promise.all(ids.map(purgePost))
        else count = await emptyPostsTrash()
        break
      case 'pages':
        if (action === 'restore') await Promise.all(ids.map(restorePage))
        else if (action === 'purge') await Promise.all(ids.map(purgePage))
        else count = await emptyPagesTrash()
        break
      case 'media': {
        if (action === 'restore') { await restoreMediaBatch(ids); break }
        // Refuse to PERMANENTLY delete an image a live post, page, revision or setting
        // still references, unless the caller confirms. Without this a purge silently
        // breaks a published page. `in_use:<n>` is what lets the admin re-ask with force.
        if (!force) {
          const targets = action === 'purge' ? ids : (await getTrashedMedia()).map((m) => m.url)
          if (targets.length > 0) {
            const used = await usedMediaKeys()
            const inUse = targets.filter((url) => used.has(collapseBlob(url)))
            if (inUse.length > 0) return fail(c, `in_use:${inUse.length}`, 409)
          }
        }
        if (action === 'purge') await purgeMediaBatch(ids)
        else count = await emptyMediaTrash()
        break
      }
      case 'files':
        if (action === 'restore') await restoreFilesBatch(ids)
        else if (action === 'purge') await purgeFilesBatch(ids)
        else count = await emptyFilesTrash()
        break
      case 'comments':
        if (action === 'restore') await Promise.all(ids.map((id) => restoreComment(Number(id))))
        else if (action === 'purge') await Promise.all(ids.map((id) => purgeComment(Number(id))))
        else count = await emptyCommentsTrash()
        break
      case 'subscribers':
        if (action === 'restore') await Promise.all(ids.map((id) => restoreSubscriber(Number(id))))
        else if (action === 'purge') await Promise.all(ids.map((id) => purgeSubscriber(Number(id))))
        else count = await emptySubscribersTrash()
        break
    }

    // Invariant 1. The frozen tree revalidated selectively here, per kind and per action,
    // and the media branch had to remember `revalidateEverything()` in two places.
    clearCache()
    const logged = (action === 'empty' ? 'trash.empty' : `${SINGULAR[kind]}.${action}`) as ActivityAction
    void logActivity(logged, action === 'empty' ? `${kind}: ${count} item(s)` : ids.join(', '))
    return json({ kind, action, count })
  })

  return router
}
