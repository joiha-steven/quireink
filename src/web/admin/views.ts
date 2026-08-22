// One endpoint per admin page, returning exactly the props that page's component tree
// already expects.
//
// In the frozen tree each of these was a server component: it called `getIndex()` or
// `getAnalytics()` directly, assembled the props and rendered. The admin is a static SPA
// here, so the assembly has to happen somewhere the database is reachable — and this is
// that somewhere. Deliberately NOT a generic query API: the shape each page needs is
// already known, and a generic one would turn one round trip into five.
//
// Everything is gated by the router group (Invariant 4) and nothing is cached: the admin
// must never show a stale snapshot of the reader's own edits.

import { getActivity } from '@/server/activity'
import { getAnalytics, getRightNow, getViewTotals } from '@/analytics/summary'
import { getTrashedSubscribers } from '@/news/subscribers'
import { getPageAnalytics } from '@/analytics/page'
import { getAdminComments, countsByPosts, getTrashedComments } from '@/comments/comments'
import { getCommentEnv } from '@/comments/comment-env'
import { getIntegrationStatus } from '@/store/integration-keys'
import { updateCheckStatus } from '@/server/update-check'
import { getIndex, getCategories, getTags, getPublicPosts, getTrashedPosts } from '@/content/posts'
import { getPageIndex, getTrashedPages, getPage, getPublicPages } from '@/content/pages'
import { getPost } from '@/content/posts'
import { getAllSeriesNames } from '@/content/series'
import { searchEverything } from '@/content/search-owner'
import { getSettings } from '@/content/settings'
import { THEME_PRESETS } from '@/content/themes'
import { getTrashedMedia } from '@/media/media'
import { getTrashedFiles } from '@/media/files'
import { listBlobs } from '@/media/blob'
import { statsByPost } from '@/news/newsletter-log'
import { getMailStatus } from '@/news/mail'
import { OwnerRouter } from '@/web/guard'
import pkg from '../../../package.json' with { type: 'json' }
import { dashboardView } from '@/web/admin/views-home'

/** Printed by the Help page and the dashboard, so the two can never disagree. */
const VERSION = (pkg as { version: string }).version

/** A window of days, from the `range` query. The frozen tree offered these four. */
function rangeOf(raw: string | undefined): { days: number; bucket: 'day' | 'hour' } {
  const days = Number(raw)
  if (days === 1) return { days: 1, bucket: 'hour' }
  if (days === 7 || days === 30 || days === 90 || days === 365) return { days, bucket: 'day' }
  return { days: 30, bucket: 'day' }
}

export function viewRoutes(): OwnerRouter {
  const routes = new OwnerRouter()

  // The dashboard is the heaviest of these, so it lives in its own module.
  routes.get('/api/admin/view/dashboard', async (c) => c.json({ data: await dashboardView() }))

  // Posts and pages, with the view totals and comment counts each table shows.
  routes.get('/api/admin/view/content', async (c) => {
    const settings = await getSettings()
    const commentsEnabled = settings.comments.enabled
    const [posts, pages, views, commentCounts] = await Promise.all([
      getIndex(), getPageIndex(), getViewTotals(),
      commentsEnabled ? countsByPosts() : Promise.resolve({} as Record<string, number>),
    ])
    return c.json({ data: { posts, pages, views, commentCounts, commentsEnabled } })
  })

  // The owner's search, over title AND body, drafts included (ADR 0024). Separate from the
  // content view rather than a parameter on it: that view returns every post so the tables
  // can render, and this one answers a person typing, which has to stay small and quick.
  routes.get('/api/admin/search', async (c) => {
    const q = c.req.query('q') ?? ''
    return c.json({ data: { hits: await searchEverything(q) } })
  })

  // The editor. `slug` empty means a new post: the taxonomy and series lists are still
  // needed, so the same endpoint serves both and the caller does not branch.
  routes.get('/api/admin/view/editor', async (c) => {
    const slug = c.req.query('slug') ?? ''
    const [post, allCategories, allTags, allSeries, settings] = await Promise.all([
      slug ? getPost(slug) : Promise.resolve(null),
      getCategories(), getTags(), getAllSeriesNames(), getSettings(),
    ])
    if (slug && !post) return c.json({ error: 'Not found' }, 404)
    return c.json({
      data: {
        post, allCategories, allTags, allSeries,
        contentWidth: settings.contentWidth,
        typewriterEffects: settings.motion.typewriter,
        autosaveSeconds: settings.autosaveSeconds,
      },
    })
  })

  routes.get('/api/admin/view/page-editor', async (c) => {
    const slug = c.req.query('slug') ?? ''
    const [page, settings] = await Promise.all([
      slug ? getPage(slug) : Promise.resolve(null), getSettings(),
    ])
    if (slug && !page) return c.json({ error: 'Not found' }, 404)
    return c.json({
      data: {
        page,
        contentWidth: settings.contentWidth,
        typewriterEffects: settings.motion.typewriter,
        autosaveSeconds: settings.autosaveSeconds,
      },
    })
  })

  // Analytics: the summary, or one page's detail when `path` is given.
  routes.get('/api/admin/view/analytics', async (c) => {
    const { days, bucket } = rangeOf(c.req.query('range'))
    const path = c.req.query('path') ?? ''
    const [posts, pages] = await Promise.all([getIndex(), getPageIndex()])
    // Titles by public path, so a chart row can say what it is rather than "/slug".
    const titles: Record<string, string> = {}
    for (const p of [...posts, ...pages]) titles[`/${p.slug}`] = p.title
    if (path) {
      return c.json({
        data: {
          detail: await getPageAnalytics(path, days, bucket),
          title: titles[path] ?? path,
          range: days,
        },
      })
    }
    return c.json({
      data: { summary: await getAnalytics(days, bucket), rightNow: await getRightNow(), titles, range: days },
    })
  })

  // The live strip's poll: five minutes of rows, nothing else. Separate from the view
  // above because the poll must not re-run a dashboard's worth of aggregates every few
  // seconds to refresh one number.
  routes.get('/api/admin/view/analytics-now', async (c) => {
    return c.json({ data: await getRightNow() })
  })

  routes.get('/api/admin/view/comments', async (c) => {
    const { rows } = await getAdminComments(1, 200)
    return c.json({ data: { rows } })
  })

  routes.get('/api/admin/view/settings', async (c) => {
    const [settings, commentEnv, integrations, posts, pages, categories] = await Promise.all([
      getSettings(), getCommentEnv(), getIntegrationStatus(), getPublicPosts(), getPublicPages(),
      getCategories(),
    ])
    return c.json({
      data: {
        settings,
        presets: THEME_PRESETS,
        commentEnv,
        integrations,
        // Published posts only: the Featured picker cannot offer a draft.
        posts: posts.map((p) => ({ slug: p.slug, title: p.title })),
        // ...and published pages, for the homepage picker (ADR 0014). Same rule: a draft
        // cannot be the front door, and offering one would only produce the fallback.
        pages: pages.filter((p) => p.status === 'published').map((p) => ({ slug: p.slug, title: p.title })),
        // Category NAMES, for the front page's strip picker (ADR 0014).
        categories,
        // Whether this deployment permits the daily update check, and the newest release it
        // has been told about. Read here rather than from a route of its own: it is one
        // small fact belonging to one card, and the settings screen already round-trips.
        update: updateCheckStatus(),
      },
    })
  })

  routes.get('/api/admin/view/newsletter', async (c) => {
    const [posts, stats, mail] = await Promise.all([
      getPublicPosts(), statsByPost(), getMailStatus(),
    ])
    return c.json({
      data: {
        posts: posts.map((p) => ({
          slug: p.slug, title: p.title, date: p.date, stats: stats.get(p.slug) ?? null,
        })),
        mailConfigured: mail.configured,
      },
    })
  })

  routes.get('/api/admin/view/log', async (c) => {
    const [entries, settings] = await Promise.all([getActivity(), getSettings()])
    return c.json({ data: { entries, enabled: settings.features.activityLog } })
  })

  routes.get('/api/admin/view/trash', async (c) => {
    const [posts, pages, media, files, comments, subscribers] = await Promise.all([
      getTrashedPosts(), getTrashedPages(), getTrashedMedia(),
      getTrashedFiles(), getTrashedComments(), getTrashedSubscribers(),
    ])
    return c.json({ data: { posts, pages, media, files, comments, subscribers } })
  })

  // The shell itself: the language the whole admin is drawn in, and the version the Help
  // page and the dashboard both print. Fetched once, before anything else renders.
  routes.get('/api/admin/view/shell', async (c) => {
    const settings = await getSettings()
    return c.json({ data: { language: settings.language, version: VERSION } })
  })

  // Storage totals for the media page's header, without listing every blob twice.
  routes.get('/api/admin/view/media', async (c) => {
    const blobs = await listBlobs()
    return c.json({
      data: { count: blobs.length, totalBytes: blobs.reduce((sum, b) => sum + b.size, 0) },
    })
  })

  return routes
}
