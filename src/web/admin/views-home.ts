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

/** Tally a string[] field across posts into name/count pairs, busiest first. */
function tally(values: string[]): { name: string; count: number }[] {
  const map = new Map<string, number>()
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1)
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

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

  const drafts = posts.filter((p) => p.status !== 'published').length
    + pages.filter((p) => p.status !== 'published').length

  // SEO health: metadata-only signals over PUBLISHED posts. No body scan, so it stays
  // cheap enough to sit on the home page.
  const published = posts.filter((p) => p.status === 'published')

  return {
    posts: posts.length,
    pages: pages.length,
    comments: Object.values(commentCounts).reduce((sum, n) => sum + n, 0),
    originals: storage.originals,
    variants: storage.variants,
    files: storage.files,
    totalBytes: storage.totalBytes,
    categories: tally(posts.flatMap((p) => p.categories)),
    tags: tally(posts.flatMap((p) => p.tags)),
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
      },
      topPosts,
      needs: { drafts },
    },
    seo: {
      published: published.length,
      noExcerpt: published.filter((p) => !p.excerpt?.trim()).length,
      noImage: published.filter((p) => !p.featuredImage).length,
    },
    sources: {
      referrers: (analytics30.topReferrers ?? []).map((r) => ({ label: r.host, visitors: r.visitors })),
      countries: (analytics30.topCountries ?? []).map((c) => ({ label: c.country, visitors: c.visitors })),
    },
  }
}
