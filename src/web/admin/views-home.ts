// The dashboard's props: counts, storage, taxonomy, recent activity, 30-day traffic,
// SEO signals and the running-system panel.
//
// Split from `views.ts` because it is the one view that assembles rather than forwards,
// and because that file is at the 400-line limit without it.

import { getActivity } from '@/server/activity'
import { lastRunAt } from '@/server/backup'
import { buildSha } from '@/server/build-info'
import { getDashboardTraffic, getViewTotals } from '@/analytics/summary'
import { countsByPosts } from '@/comments/comments'
import { getIndex } from '@/content/posts'
import { getPageIndex } from '@/content/pages'
import { getSettings } from '@/content/settings'
import { storageStats } from '@/media/storage-stats'
import { db } from '@/store/db'
import pkg from '../../../package.json' with { type: 'json' }

/**
 * The facts the "System" panel prints. Best-effort throughout: a database hiccup flips a
 * status flag, it never breaks the dashboard.
 *
 * Three of these lines now say something different, because they are true of a different
 * program: the database is SQLite rather than PostgreSQL over PostgREST, the runtime is
 * Bun rather than Node, and there is no framework line to print at all.
 */
async function systemInfo(): Promise<Record<string, unknown>> {
  let dbReachable = true
  try {
    db().query('select id from settings limit 1').get()
  } catch {
    dbReachable = false
  }
  let siteHost = ''
  try {
    siteHost = new URL(process.env.SITE_URL ?? '').host
  } catch {
    /* leave it empty rather than printing a broken URL */
  }
  const settings = await getSettings()
  return {
    mcpEnabled: settings.mcp.enabled,
    // What this process can actually see: the snapshots it keeps on this machine. The
    // off-box copy is a cron script beside the process and is not ours to report on.
    backupOn: settings.backups.enabled,
    backupLastRun: await lastRunAt(),
    hosting: 'Self-hosted',
    site: siteHost || '—',
    siteHref: siteHost ? `https://${siteHost}` : undefined,
    env: process.env.NODE_ENV ?? 'production',
    database: 'SQLite',
    dbReachable,
    storage: 'Local filesystem',
    runtime: `Bun ${Bun.version}`,
    framework: 'Hono',
  }
}

export async function dashboardView(): Promise<Record<string, unknown>> {
  const settings = await getSettings()
  const commentsOn = settings.comments.enabled
  const activityOn = settings.features.activityLog

  const [posts, pages, storage, system, commentCounts, recent, analytics30, viewTotals] =
    await Promise.all([
      getIndex(),
      getPageIndex(),
      storageStats(),
      systemInfo(),
      commentsOn ? countsByPosts() : Promise.resolve({} as Record<string, number>),
      activityOn ? getActivity(6) : Promise.resolve([]),
      getDashboardTraffic(30),
      getViewTotals(),
    ])

  // Top posts maps the all-time view totals (keyed by "/slug") back to titles, keeping
  // only paths that are still real posts or pages.
  const titleBySlug = new Map<string, string>()
  for (const p of posts) titleBySlug.set(p.slug, p.title)
  for (const p of pages) titleBySlug.set(p.slug, p.title)
  const topPosts = Object.entries(viewTotals)
    .map(([path, views]) => ({ slug: path.replace(/^\//, ''), views }))
    .filter((x) => titleBySlug.has(x.slug))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((x) => ({ slug: x.slug, views: x.views, title: titleBySlug.get(x.slug) ?? x.slug }))

  const unfinishedPosts = posts.filter((p) => p.status !== 'published')
  const unfinishedPages = pages.filter((p) => p.status !== 'published')
  const drafts = unfinishedPosts.length + unfinishedPages.length

  /**
   * The pieces to pick up again, most recently touched first (ADR 0024 step 6).
   *
   * A COUNT of drafts was already on this page and it is a different fact: it says three
   * exist, not which three or where they were left. This hands back the writing itself, which
   * is the one thing the home screen of a writing tool owes its owner.
   *
   * `updatedAt` alone, with no `date` fallback: an unpublished piece has no publication date
   * worth sorting by, and a draft created and never saved again still carries the moment it
   * was created here.
   */
  const pickUpItems = [
    ...unfinishedPosts.map((p) => ({ title: p.title, href: `/admin/editor/${p.slug}`, touched: p.updatedAt ?? '' })),
    ...unfinishedPages.map((p) => ({ title: p.title, href: `/admin/page-editor/${p.slug}`, touched: p.updatedAt ?? '' })),
  ]
    .sort((a, b) => new Date(b.touched).getTime() - new Date(a.touched).getTime())
    .slice(0, 4)

  // SEO health: metadata-only signals over PUBLISHED posts. No body scan, so it stays
  // cheap enough to sit on the home page.
  const published = posts.filter((p) => p.status === 'published')

  return {
    posts: posts.length,
    pages: pages.length,
    comments: Object.values(commentCounts).reduce((sum, n) => sum + n, 0),
    originals: storage.originals,
    totalBytes: storage.totalBytes,
    recent,
    activityEnabled: activityOn,
    firstRunDone: settings.firstRunDone,
    version: (pkg as { version: string }).version,
    // Null on a machine the deploy did not stamp. The admin then shows the version alone.
    commit: buildSha(),
    system,
    dashboard: {
      traffic: {
        views30: analytics30.totalViews,
        visitors30: analytics30.uniqueVisitors,
        views7: analytics30.daily.slice(-7).reduce((sum, d) => sum + d.views, 0),
        spark: analytics30.daily.map((d) => d.views),
        avgDwellMs: analytics30.avgDwellMs,
        avgReadDepth: analytics30.avgReadDepth,
      },
      topPosts,
      pickUp: { items: pickUpItems, total: drafts },
      // ⚠️ These two used to be a `seo` prop and a `sources` prop, computed here on every
      // dashboard load and handed to `Overview`, which rendered NEITHER — along with
      // `categories`, `tags`, `variants` and `files`, six props in all. `tally()` walked every
      // post's categories and tags for two of them. Nothing failed, because a prop that is
      // passed and not read is not an error in TypeScript or in a test; it took the owner
      // saying the page looked bare to go and look at what the page was already being sent.
      // They live inside `dashboard` now, which is the shape the widgets actually take, so
      // there is no second channel to drift out of use again.
      needs: {
        noExcerpt: published.filter((p) => !p.excerpt?.trim()).length,
        noImage: published.filter((p) => !p.featuredImage).length,
      },
      sources: {
        referrers: (analytics30.topReferrers ?? []).map((r) => ({ label: r.host, visitors: r.visitors })),
        countries: (analytics30.topCountries ?? []).map((c) => ({ label: c.country, visitors: c.visitors })),
      },
    },
  }
}
