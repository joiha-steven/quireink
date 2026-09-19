// The machine-readable documents: the feeds, the sitemap, robots.txt and llms.txt.
//
// Split out of `web/app.ts` on 2026-08-22, when that file reached its 400-line ceiling.
// The seam is by AUDIENCE, the same cut `content/settings-resolve.ts` was made on: every
// other route in the router answers a person holding a browser, and these answer a program.
// They also share one shape no other route has — a toggle in Settings, a document built from
// every public post and page, and a cache window measured in minutes — which is why
// `feedRoute` existed as a local helper before it had a file to live in.
//
// FOUR SUBSCRIPTION DOCUMENTS, not one: the site and the notebook, each as RSS and as JSON
// Feed. The notebook needs its own because a note is never in the post feed (ADR 0044), so
// until this existed the one kind of writing that speaks Micropub and Webmention was the one
// kind nobody could subscribe to. The per-term archives stay RSS-only on purpose: JSON Feed
// earns its place on a document a reader's app subscribes to, and sixty tag feeds in two
// formats is a hundred and twenty documents to keep in step for a format nothing polls.

import type { Hono } from 'hono'
import { getPublicPosts } from '@/content/posts'
import { getPublicPages } from '@/content/pages'
import { getPublicNotes } from '@/content/notes'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import {
  noteItems, postItems, renderFeed, renderLlms, renderRobots, renderSitemap, type FeedChannel,
} from '@/web/feeds'
import { renderJsonFeed } from '@/web/feed-json'
import { t } from '@/i18n/i18n'
import { fill } from '@/utils'

type Settings = Awaited<ReturnType<typeof getSettings>>
type Posts = Awaited<ReturnType<typeof getPublicPosts>>
type Pages = Awaited<ReturnType<typeof getPublicPages>>
type Notes = Awaited<ReturnType<typeof getPublicNotes>>

/**
 * The notebook's own identity in its two feeds.
 *
 * `path` doubles as the document's `self` link, so the two formats must not share one: an
 * aggregator that follows `self` to subscribe would land on the other format's document.
 */
const notesChannel = (settings: Settings, path: string): FeedChannel => ({
  title: `${t(settings.language).notesTitle} · ${settings.title}`,
  description: fill(t(settings.language).notesMeta, { site: settings.title }),
  path,
})

export function registerFeedRoutes(app: Hono): void {
  const feedRoute = (
    path: string,
    enabled: (s: Settings) => boolean,
    type: string,
    build: (args: { posts: Posts; pages: Pages; notes: Notes; settings: Settings; site: string }) => string,
  ) => {
    app.get(path, async (c) => {
      const settings = await getSettings()
      // A disabled feed 404s rather than serving an empty document: an empty feed looks
      // like a broken site to an aggregator, a 404 looks like what it is.
      if (!enabled(settings)) return c.text('Not found', 404)
      const [posts, pages, notes] = await Promise.all([getPublicPosts(), getPublicPages(), getPublicNotes()])
      const body = build({ posts, pages, notes, settings, site: resolveSiteUrl(settings) })
      // These sent no cache-control at all, so every feed reader's poll and every crawler
      // hit came all the way to the origin and rebuilt the document. Five minutes, and a
      // write purges the zone anyway, so a subscriber never waits on the window.
      return new Response(body, {
        headers: { 'content-type': type, 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
      })
    })
  }

  // All four ride `seo.rss`, and deliberately not four switches. `term-routes.ts` states the
  // argument for the per-archive feeds and it is the same one here: an owner who has turned
  // the feed off has said what they think about feeds, and offering the notebook's anyway
  // would be reading that as "off, except over there".
  feedRoute('/feed.xml', (s) => s.seo.rss, 'application/rss+xml; charset=utf-8',
    ({ posts, settings, site }) => renderFeed(postItems(posts, site), settings, site))
  feedRoute('/feed.json', (s) => s.seo.rss, 'application/feed+json; charset=utf-8',
    ({ posts, settings, site }) => renderJsonFeed(postItems(posts, site), settings, site))
  // ⚠️ REGISTERED BEFORE `/notes/:slug`, which `registerNoteRoutes` mounts. A static segment
  // beats a parameter in Hono's router, which is why `/notes/clip` has always worked beside
  // it — but the ORDER is what makes that true here rather than something to hope for, and
  // the test asks for this document by name and reads its content type back.
  feedRoute('/notes/feed.xml', (s) => s.seo.rss, 'application/rss+xml; charset=utf-8',
    ({ notes, settings, site }) => renderFeed(noteItems(notes, site), settings, site, notesChannel(settings, '/notes/feed.xml')))
  feedRoute('/notes/feed.json', (s) => s.seo.rss, 'application/feed+json; charset=utf-8',
    ({ notes, settings, site }) => renderJsonFeed(noteItems(notes, site), settings, site, notesChannel(settings, '/notes/feed.json')))
  feedRoute('/sitemap.xml', (s) => s.seo.sitemap, 'application/xml; charset=utf-8',
    ({ posts, pages, notes, settings, site }) =>
      renderSitemap(posts, pages, site, settings.home, settings.features.archive, notes, settings.language))
  feedRoute('/robots.txt', (s) => s.seo.robots, 'text/plain; charset=utf-8',
    ({ settings, site }) => renderRobots(settings, site))
  feedRoute('/llms.txt', (s) => s.seo.llms, 'text/plain; charset=utf-8',
    ({ posts, pages, notes, settings, site }) => renderLlms(posts, pages, settings, site, notes))

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
