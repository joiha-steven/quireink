// THE CONTENT API: `/api/v1/*`, read-only, JSON, off until the owner switches it on.
//
// ADR 0057. Every other machine surface in this product answers ONE question — the feeds answer
// "what is new", the sitemap "what exists", `/api/md/:slug` "what does this one say". A client
// that wants to BUILD something from this blog — a second front end, a search index, a static
// export, an app — had to scrape the HTML it renders. WordPress has answered that with
// `/wp-json` since 2016 and Ghost with a Content API; this is that door, deliberately narrow.
//
// FOUR THINGS HOLD IT SHUT, and each is a separate answer to "what can this be used for":
//
//   1. OFF BY DEFAULT, 404 while off. Not 403 — a 403 confirms the feature exists on this
//      install, and there is nothing to be gained by saying so. Same answer `/api/mcp` gives.
//   2. GET ONLY. Not one route here writes, so this file never appears in the write gate's
//      exception list (`scripts/checks/routes-guarded.ts`) — the safest way to be on a list of
//      exceptions is to have no business being on it.
//   3. NOTHING THAT IS NOT ALREADY PUBLIC. Every list comes from the same `getPublic*` readers
//      the pages and the feeds use, so a draft, a future-dated post and a trashed row are
//      invisible here by construction rather than by a filter somebody has to remember.
//   4. THE ANSWER DOES NOT VARY BY READER. Nothing here reads the session cookie, and the owner
//      gets byte-for-byte what a stranger gets. That is what makes `access-control-allow-origin:
//      *` and a shared-cache window safe at the same time — the pair that is a data leak in
//      every write-up of a CORS mistake is exactly "open to any origin" plus "varies by who
//      asked", and this endpoint refuses the second half.

import type { Context, Hono } from 'hono'
import type { SiteSettings } from '@/types'
import { getPublicPosts, getPost, getPublicTaxonomy } from '@/content/posts'
import { getPublicPages, getPage } from '@/content/pages'
import { getPublicNotes, getNote } from '@/content/notes'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { resolveTerm, termSlug } from '@/content/taxonomy'
import { siblingsOf } from '@/content/translations'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { isPublicallyVisible } from '@/utils'
import { PUBLIC as PUBLIC_CACHE } from '@/web/cache-headers'
import {
  apiNote, apiNoteFull, apiPage, apiPageFull, apiPost, apiPostFull, paginate, PER_MAX,
} from '@/web/api-v1-shape'

/**
 * Generous per-address cap. A client walking every page of a large blog at 20 a page spends a
 * handful of requests; a script pulling the same thing in a loop spends this in seconds.
 *
 * Higher than `/api/search`'s 60 because this endpoint is MEANT to be called in a series — the
 * search box is called once per keystroke by one reader, and a site generator is called once per
 * page by one build.
 */
const PER_MINUTE = 120

/** Open to any origin, and carrying no credentials — see note 4 at the top of this file. */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  // Named rather than reflected: a reflected list is a list this endpoint does not control.
  'access-control-allow-headers': 'accept, content-type',
  'access-control-max-age': '86400',
} as const

/**
 * The freshness of a public page, because this is the same content purged by the same write.
 *
 * It honours the owner's cache switch for the same reason the page does: somebody changing how
 * the blog looks and watching it change needs one switch that means it, not one that means it
 * for HTML.
 */
const freshness = (s: SiteSettings): string => (s.cache.enabled ? PUBLIC_CACHE : 'public, no-store')

/** A body, with the headers every answer on this surface carries. */
const send = (c: Context, body: unknown, s: SiteSettings): Response =>
  c.json(body, 200, { ...CORS, 'cache-control': freshness(s) })

/**
 * A miss, in the shape a client parses.
 *
 * A BARE `{error}` and not the `{success,data}` envelope from `web/api.ts`: that envelope is the
 * admin's contract, read by sixty-eight components, and it exists because they all read it. A
 * public API has no such constituency and every one of its clients is somebody else's code, so
 * the shape it should have is the shape a stranger expects. The search index answers bare for
 * the same reason, and says so.
 */
const miss = (c: Context, message: string, status: 404 | 429): Response =>
  c.json({ error: message }, status, CORS)
// It carries the CORS headers, INCLUDING the 404 the closed door gives. Without them a
// cross-origin client is told by its browser that CORS refused the request, which is a different
// and much less useful sentence than "that endpoint answered 404" — and the 404 says nothing a
// request to any unclaimed path does not. It sets no `cache-control`, so the blanket rule gives
// it `private, no-store`: a cached 404 outlives the reason for it.

/**
 * The `:slug` a route matched, or ''.
 *
 * A bare `Context` does not know its route's shape, so the parameter types as possibly absent.
 * Every route that reaches here has one; '' is what the readers below turn into a 404 anyway,
 * which is the right answer if one ever does not.
 */
const slugOf = (c: Context): string => c.req.param('slug') ?? ''

/**
 * Every route on this surface, in one wrapper: the switch, the limit, and the settings read
 * each handler needs anyway.
 *
 * ⚠️ THE SWITCH IS CHECKED HERE, ONCE, and that is the only reason it cannot be forgotten on a
 * route added later. A per-handler `if (!settings.api.enabled)` is a line, and a line can be
 * left out of the ninth route by the person who wrote the first eight.
 */
function apiRoute(
  app: Hono, path: string,
  handler: (c: Context, s: SiteSettings, site: string) => Promise<Response>,
): void {
  app.get(path, async (c) => {
    const settings = await getSettings()
    if (!settings.api.enabled) return miss(c, 'Not found', 404)
    if (rateLimited(`apiv1:${clientIp(c)}`, PER_MINUTE)) return miss(c, 'Too many requests', 429)
    return handler(c, settings, resolveSiteUrl(settings))
  })
}

export function registerApiV1Routes(app: Hono): void {
  // The preflight. A plain `fetch` of these URLs is a simple request and never sends one, but a
  // client that adds a header of its own does — and a preflight with no answer fails in the
  // browser with a message that blames CORS rather than the missing route.
  app.options('/api/v1/*', (c) => {
    // No switch check and no body. OPTIONS describes the METHOD, the GET behind it answers 404
    // either way, and so this reveals nothing the very next request would not — while answering
    // it without a settings read keeps a preflight free.
    c.header('cache-control', 'public, max-age=86400')
    for (const [k, v] of Object.entries(CORS)) c.header(k, v)
    return c.body(null, 204)
  })

  // ----- what this is ---------------------------------------------------------
  // A client points at the base and is told the rest, so nothing has to be guessed from a
  // document somebody wrote down once. The site block is the same handful of facts the feeds
  // and the sitemap already publish about themselves.
  apiRoute(app, '/api/v1', async (c, s, site) => send(c, {
    api: 'quireink',
    version: 1,
    site: { title: s.title, description: s.description, url: site, language: s.language },
    endpoints: {
      posts: `${site}/api/v1/posts`,
      pages: `${site}/api/v1/pages`,
      notes: `${site}/api/v1/notes`,
      taxonomy: `${site}/api/v1/taxonomy`,
    },
    limits: { perPageMax: PER_MAX, requestsPerMinute: PER_MINUTE },
  }, s))

  // ----- posts ----------------------------------------------------------------

  apiRoute(app, '/api/v1/posts', async (c, s, site) => {
    let posts = await getPublicPosts()
    // ⚠️ `resolveTerm` IS THE ARCHIVE'S OWN FUNCTION, not a filter written again here. It
    // matches a slug OR the term as typed, which is what `/category/{slug}` matches — an API
    // whose idea of "in this category" differs from the page's is two answers to one question,
    // and the one nobody checks is the one that drifts.
    const category = c.req.query('category')
    if (category) posts = resolveTerm(posts, 'categories', category).posts
    const tag = c.req.query('tag')
    if (tag) posts = resolveTerm(posts, 'tags', tag).posts
    const listing = paginate(posts, c.req.query('page'), c.req.query('per'))
    return send(c, { ...listing, items: listing.items.map((p) => apiPost(p, site)) }, s)
  })

  apiRoute(app, '/api/v1/posts/:slug', async (c, s, site) => {
    const post = await getPost(slugOf(c))
    // The page's own test, not `status === 'published'`: a post dated next Tuesday is published
    // and is not yet public, and `/api/md/:slug` and the article route both ask it this way.
    if (!post || !isPublicallyVisible(post.status, post.date)) return miss(c, 'Not found', 404)
    return send(c, apiPostFull(post, site, await siblingsOf(post, s)), s)
  })

  // ----- pages ----------------------------------------------------------------

  apiRoute(app, '/api/v1/pages', async (c, s, site) => {
    const listing = paginate(await getPublicPages(), c.req.query('page'), c.req.query('per'))
    return send(c, { ...listing, items: listing.items.map((p) => apiPage(p, site)) }, s)
  })

  apiRoute(app, '/api/v1/pages/:slug', async (c, s, site) => {
    const page = await getPage(slugOf(c))
    if (!page || page.status !== 'published') return miss(c, 'Not found', 404)
    return send(c, apiPageFull(page, site, await siblingsOf(page, s)), s)
  })

  // ----- the notebook (ADR 0044) ----------------------------------------------

  apiRoute(app, '/api/v1/notes', async (c, s, site) => {
    const listing = paginate(await getPublicNotes(), c.req.query('page'), c.req.query('per'))
    return send(c, { ...listing, items: listing.items.map((n) => apiNote(n, site)) }, s)
  })

  apiRoute(app, '/api/v1/notes/:slug', async (c, s, site) => {
    const note = await getNote(slugOf(c))
    if (!note || !isPublicallyVisible(note.status, note.date)) return miss(c, 'Not found', 404)
    return send(c, apiNoteFull(note, site), s)
  })

  // ----- the terms ------------------------------------------------------------
  // Counted over public posts only, by the same function the sidebar and the archive index use,
  // so a category with one draft in it is absent here exactly as it is absent there.

  apiRoute(app, '/api/v1/taxonomy', async (c, s, site) => {
    const { categories, tags } = await getPublicTaxonomy()
    // ⚠️ `termSlug`, THE SITE'S OWN SPELLING. `resolveTerm` also accepts a term written out and
    // percent-encoded, so a URL built that way would work — and would be a second address for
    // the archive that this API alone hands out, competing with the one every link on the site
    // uses. `web/term-routes.ts` redirects to the canonical spelling for exactly that reason.
    const term = (kind: string) => (x: { name: string; count: number }) => ({
      name: x.name, count: x.count, url: `${site}/${kind}/${encodeURIComponent(termSlug(x.name))}`,
    })
    return send(c, { categories: categories.map(term('category')), tags: tags.map(term('tag')) }, s)
  })
}
