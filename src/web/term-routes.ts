// Every list of posts that is not the front page: category, tag, series, the year archive,
// and the feed each of the first three now has of its own.
//
// Split out of `web/app.ts` on 2026-08-30, when that file was nine lines from its ceiling
// and the archive still had nowhere to be registered. The seam is the one the router
// already had a comment box for: these routes all resolve a NAME to a set of posts and hand
// the result to `listingPage`, while the front page resolves nothing and `/:slug` resolves
// one document.
//
// The per-term feeds live here rather than beside the site feed in `web/feed-routes.ts`
// because a term feed cannot be built without resolving the term first, which is this file's
// whole job. `feed-routes.ts` keeps the four documents that read no path segment at all.

import type { Hono } from 'hono'
import type { Post, SiteSettings } from '@/types'
import { getPublicPosts } from '@/content/posts'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { resolveSeries } from '@/content/series'
import { resolveTerm, tagText } from '@/content/taxonomy'
import { t } from '@/i18n/i18n'
import { escapeHtml } from '@/utils'
import { renderListing } from '@/web/listing'
import { cached, listingPage, notFoundPage, pageNumber, renderFeedBody } from '@/web/listing-page'
import { renderArchive } from '@/web/archive-page'
import { renderArticle } from '@/web/article'
import { renderFeed } from '@/web/feeds'

/**
 * The RSS document for one archive, or a 404.
 *
 * Gated on `seo.rss` — the same switch as `/feed.xml`, and deliberately not a second one.
 * An owner who has turned the feed off has said what they think about feeds; offering the
 * per-tag ones anyway would be reading that as "off, except sixty times".
 *
 * The cache window matches the site feed's: five minutes, and any write purges the zone, so
 * a subscriber never waits on it.
 */
async function termFeed(
  settings: SiteSettings, name: string | null, posts: Post[], path: string,
): Promise<Response> {
  if (!settings.seo.rss || !name) return notFoundPage()
  const site = resolveSiteUrl(settings)
  const s = t(settings.language)
  const body = renderFeed(posts, settings, site, {
    // "Kinh tế · edcmeo" — the term leads, because this is what the subscriber picked and
    // what will show in the list of feeds they subscribe to.
    title: `${name} · ${settings.title}`,
    description: s.metaTerm.replace('{site}', settings.title).replace('{name}', name),
    path,
  })
  return new Response(body, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}

export function registerTermRoutes(app: Hono): void {
  // ----- taxonomy -------------------------------------------------------------

  // The route segment is singular ('category'), the data field is plural ('categories'):
  // the URL shape is the frozen tree's and so is the field name, so the map lives here.
  const TAXONOMIES = [
    { segment: 'category', field: 'categories' },
    { segment: 'tag', field: 'tags' },
  ] as const

  for (const { segment: kind, field } of TAXONOMIES) {
    const term = async (slug: string, page: number) => {
      const settings = await getSettings()
      const { name, posts } = resolveTerm(await getPublicPosts(), field, slug)
      if (!name) return null
      // "Danh muc: Kinh te" / "The: #edc" — the label, then the term, exactly as the
      // frozen tree reads. A tag lowercases its own name and wears a hash.
      const s = t(settings.language)
      const label = kind === 'category' ? s.categoryLabel : s.tagLabel
      // A tag's spaces become hyphens here too, so the archive's own heading matches the
      // token the reader clicked in the cloud. The stored name and the slug are untouched.
      const term = kind === 'category'
        ? escapeHtml(name)
        : `<span class="lower">#${escapeHtml(tagText(name))}</span>`
      const built = await renderFeedBody(posts, page, {
        headingHtml: `${escapeHtml(label)}: ${term}`,
        basePath: `/${kind}/${slug}`,
        empty: kind === 'category' ? s.emptyCategory : s.emptyTag,
      })
      if (!built) return null
      return listingPage({
        title: `${name} · ${settings.title}`,
        // Its own sentence. Every term page used to inherit the site description, so a
        // hundred tag pages shipped one identical snippet and Google had nothing to tell
        // them apart with.
        description: s.metaTerm.replace('{site}', settings.title).replace('{name}', name),
        body: built.body,
        css: built.css,
        canonicalPath: `/${kind}/${slug}`,
        cardTitle: name,
        // The archive's own URL is the row to mark in the rail.
        activeHref: `/${kind}/${slug}`,
        feed: { path: `/${kind}/${slug}/feed.xml`, title: `${name} · ${settings.title}` },
      })
    }

    // Registered BEFORE `/:slug` of the same shape below, and before the paged route only
    // for readability — Hono tells `feed.xml` from `page` by the literal segment either way.
    app.get(`/${kind}/:slug/feed.xml`, async (c) => {
      const settings = await getSettings()
      const { name, posts } = resolveTerm(await getPublicPosts(), field, c.req.param('slug'))
      return termFeed(settings, name, posts, `/${kind}/${c.req.param('slug')}/feed.xml`)
    })

    app.get(`/${kind}/:slug`, async (c) =>
      cached(`/${kind}/${c.req.param('slug')}`, () => term(c.req.param('slug'), 1))())

    app.get(`/${kind}/:slug/page/:n`, async (c) => {
      const page = pageNumber(c.req.param('n'))
      if (page === null) return notFoundPage()
      const slug = c.req.param('slug')
      return cached(`/${kind}/${slug}/page/${page}`, () => term(slug, page))()
    })
  }

  // ----- series ---------------------------------------------------------------

  app.get('/series/:slug/feed.xml', async (c) => {
    const slug = c.req.param('slug')
    const [settings, { name, posts }] = await Promise.all([getSettings(), resolveSeries(slug)])
    return termFeed(settings, name, posts, `/series/${slug}/feed.xml`)
  })

  app.get('/series/:slug', async (c) => {
    const slug = c.req.param('slug')
    return cached(`/series/${slug}`, async () => {
      const settings = await getSettings()
      const { name, posts } = await resolveSeries(slug)
      if (!name) return null
      const s = t(settings.language)
      // A series is read in order, front to back: it is not paginated, and it is never a
      // timeline — its order is the owner's, not the calendar's.
      return listingPage({
        title: `${name} · ${settings.title}`,
        description: s.metaSeries.replace('{site}', settings.title).replace('{name}', name),
        body: renderListing({
          headingHtml: `${escapeHtml(s.seriesLabel)}: ${escapeHtml(name)}`,
          paged: { items: posts, page: 1, totalPages: 1 },
          basePath: `/series/${slug}`, empty: s.emptySeries,
        }, settings),
        canonicalPath: `/series/${slug}`,
        cardTitle: name,
        feed: { path: `/series/${slug}/feed.xml`, title: `${name} · ${settings.title}` },
      })
    })()
  })

  // ----- the year archive -----------------------------------------------------
  // Cached like every other listing: it is the most expensive page on the site to build
  // (every public post, every year) and the cheapest to serve twice.
  //
  // A document the owner ALREADY publishes at this slug wins, and that is not a nicety.
  // `/archive` is a URL blogs have; this repository's own demo had a hand-written one, and
  // every WordPress site imported here could. Shipping a new route that quietly serves
  // something else at a live URL is the failure mode an upgrade is least forgiven for. The
  // lookup usually misses, and a miss is one indexed slug read.

  app.get('/archive', async () => cached('/archive', async () =>
    (await renderArticle('archive')) ?? (await renderArchive()))())
}
