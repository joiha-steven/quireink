// GET /api/search?q= — full-text search over title and body.
//
// Backs the search overlay, which needs results without a page load. The `/search` page
// renders the same results server-side, so a reader with no JavaScript loses the overlay
// and keeps the search.
//
// Metadata only, never bodies: the result list renders three fields and sending the rest
// would make a public endpoint an efficient way to dump the whole blog.

import type { Context } from 'hono'
import { getPublicPosts, searchPosts } from '@/content/posts'
import { getSettings } from '@/content/settings'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { foldAccents } from '@/utils'
import { fail, json } from '@/web/api'

/** Generous per-IP cap. A public full-text endpoint should not be a free database-load lever. */
const PER_MINUTE = 60

export async function handleSearch(c: Context): Promise<Response> {
  if (rateLimited(`search:${clientIp(c)}`, PER_MINUTE)) {
    return fail(c, 'Too many requests', 429)
  }
  // The same gate the `/search` page honours. Off means off everywhere, not just in the UI.
  const { features } = await getSettings()
  if (!features.search) return fail(c, 'Search disabled', 404)

  const posts = await searchPosts(c.req.query('q') ?? '')
  return json(posts.map((p) => ({ slug: p.slug, title: p.title, date: p.date })))
}

/**
 * GET /api/search/index — the whole public index in one document.
 *
 * Slug, title, date and accent-folded terms for every public post, so a client can match
 * without a request per keystroke. Public by design, and it carries nothing a reader could
 * not get by browsing: no drafts, no bodies.
 *
 * It sets its OWN cache-control, which is the point of it living beside `handleSearch`
 * rather than inline in the router. The blanket rule refuses a shared cache anything under
 * `/api`, correctly, and this is the one exception: it was rebuilt from every published post,
 * accent-folding each title, on every single request. A write purges the whole zone, so the
 * five-minute window costs a reader nothing in freshness.
 */
export async function handleSearchIndex(c: Context): Promise<Response> {
  const { features } = await getSettings()
  // `c.json`, not the `json` envelope helper, and not `fail`: this answers with a BARE array
  // and a bare `{error}`, the way the feeds answer in their own formats. It is a machine
  // surface with no admin component reading it, so the envelope would buy nothing and would
  // silently break any client already parsing it.
  if (!features.search) return c.json({ error: 'Search disabled' }, 404)

  const posts = await getPublicPosts()
  const index = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    date: p.date,
    terms: foldAccents([p.title, p.tags.join(' '), p.categories.join(' ')].join(' ')),
  }))
  return c.json(index, 200, { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' })
}
