// The four machine-readable documents: the RSS feed, the sitemap, robots.txt and llms.txt.
//
// Split out of `web/app.ts` on 2026-08-22, when that file reached its 400-line ceiling.
// The seam is by AUDIENCE, the same cut `content/settings-resolve.ts` was made on: every
// other route in the router answers a person holding a browser, and these four answer a
// program. They also share one shape no other route has — a toggle in Settings, a document
// built from every public post and page, and a cache window measured in minutes — which is
// why `feedRoute` existed as a local helper before it had a file to live in.

import type { Hono } from 'hono'
import { getPublicPosts } from '@/content/posts'
import { getPublicPages } from '@/content/pages'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { renderFeed, renderLlms, renderRobots, renderSitemap } from '@/web/feeds'

type Settings = Awaited<ReturnType<typeof getSettings>>
type Posts = Awaited<ReturnType<typeof getPublicPosts>>
type Pages = Awaited<ReturnType<typeof getPublicPages>>

export function registerFeedRoutes(app: Hono): void {
  const feedRoute = (
    path: string,
    enabled: (s: Settings) => boolean,
    type: string,
    build: (args: { posts: Posts; pages: Pages; settings: Settings; site: string }) => string,
  ) => {
    app.get(path, async (c) => {
      const settings = await getSettings()
      // A disabled feed 404s rather than serving an empty document: an empty feed looks
      // like a broken site to an aggregator, a 404 looks like what it is.
      if (!enabled(settings)) return c.text('Not found', 404)
      const [posts, pages] = await Promise.all([getPublicPosts(), getPublicPages()])
      const body = build({ posts, pages, settings, site: resolveSiteUrl(settings) })
      // These sent no cache-control at all, so every feed reader's poll and every crawler
      // hit came all the way to the origin and rebuilt the document. Five minutes, and a
      // write purges the zone anyway, so a subscriber never waits on the window.
      return new Response(body, {
        headers: { 'content-type': type, 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
      })
    })
  }

  feedRoute('/feed.xml', (s) => s.seo.rss, 'application/rss+xml; charset=utf-8',
    ({ posts, settings, site }) => renderFeed(posts, settings, site))
  feedRoute('/sitemap.xml', (s) => s.seo.sitemap, 'application/xml; charset=utf-8',
    ({ posts, pages, settings, site }) => renderSitemap(posts, pages, site, settings.home))
  feedRoute('/robots.txt', (s) => s.seo.robots, 'text/plain; charset=utf-8',
    ({ settings, site }) => renderRobots(settings, site))
  feedRoute('/llms.txt', (s) => s.seo.llms, 'text/plain; charset=utf-8',
    ({ posts, pages, settings, site }) => renderLlms(posts, pages, settings, site))

  // The plural is the common misspelling, and it is the URL some old Search Console
  // submissions still carry — 1.x answered it and 2.0 did not, so a site moved here answers
  // 404 to whatever was already pointing at it. An alias rather than a second document:
  // two sitemaps are two things to keep in sync, and this way there is one.
  //
  // Registered unconditionally, and NOT wrapped in `feedRoute`: it reads no settings and
  // builds no body. When the owner has the sitemap switched off, the destination is the
  // route that 404s, which is where that answer belongs. 301 rather than 1.x's 308 because
  // the method is GET either way, and 301 is what every other permanent move in this app
  // sends (`canonicalPath`, `userRedirects`, the home-slug alias).
  app.get('/sitemaps.xml', (c) => c.redirect('/sitemap.xml', 301))
}
