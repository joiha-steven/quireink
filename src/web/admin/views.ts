// One endpoint per admin page, returning exactly the props that page's component tree
// already expects.
//
// In the frozen tree each of these was a server component: it called `getIndex()` or
// `getAnalytics()` directly, assembled the props and rendered. The admin is a static SPA
// here, so the assembly has to happen somewhere the database is reachable — and this is
// that somewhere. Deliberately NOT a generic query API: the shape each page needs is
// already known, and a generic one would turn one round trip into five.
//
// Each payload is built by a NAMED function with an INFERRED return type, and the
// `ViewPayloads` map at the bottom is the typed contract the admin SPA compiles against
// (`useView` takes a view NAME, not a caller-supplied generic). Until 2026-08-29 these
// were thirteen inline object literals and the client asserted whatever shape it liked —
// rename one field here and `tsc` stayed green while the screen went blank. Now the
// compiler reads the same shape both sides do. Keep the returns inferred: an annotation
// like `Record<string, unknown>` reopens the hole this closed.
//
// Everything is gated by the router group (Invariant 4) and nothing is cached: the admin
// must never show a stale snapshot of the reader's own edits.

import { getActivity } from '@/server/activity'
import { getAutosave } from '@/content/autosave'
import { firstEventAt, getAnalytics, getPieces, getRightNow, getViewTotals, yearTotals }
  from '@/analytics/summary'
import type { Bucket } from '@/analytics/buckets'
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

/**
 * A window of days, from the `range` query. The frozen tree offered these four (plus the
 * hourly day view). Returned as the LITERAL union, not `number`: the typed view contract
 * carries it to the client, and typing it loosely here is how the client came to believe
 * 90 was impossible — its `Range` type listed four values while this accepted five.
 */
function rangeOf(raw: string | undefined): Window {
  const n = Number(raw)
  if (n === 1) return { days: 1, bucket: 'hour', range: 1 }
  if (n === 7 || n === 30 || n === 90 || n === 365) return { days: n, bucket: 'day', range: n }
  // ALL TIME. Nothing has ever deleted an analytics row, so an install that has been up for
  // three years is holding three years — and until this existed the widest question the
  // screen could ask was 365 days, which is why a reader of issue #64 reasonably concluded
  // the older data was gone. `days` is measured back to the first event and the bucket is a
  // MONTH, so five years of a busy blog is sixty columns rather than eighteen hundred.
  if (raw === 'all') {
    const first = firstEventAt()
    const days = first === null ? 30 : Math.max(1, Math.ceil((Date.now() - first) / 86_400_000))
    return { days, bucket: 'month', range: 'all' }
  }
  return { days: 30, bucket: 'day', range: 30 }
}

// ----- the payload builders ---------------------------------------------------

/** Posts and pages, with the view totals and comment counts each table shows. */
async function contentView() {
  const settings = await getSettings()
  const commentsEnabled = settings.comments.enabled
  const [posts, pages, views, commentCounts] = await Promise.all([
    getIndex(), getPageIndex(), getViewTotals(),
    commentsEnabled ? countsByPosts() : Promise.resolve({} as Record<string, number>),
  ])
  return { posts, pages, views, commentCounts, commentsEnabled }
}

/**
 * The editor. `slug` empty means a new post: the taxonomy and series lists are still
 * needed, so the same builder serves both and the caller does not branch. Null means the
 * slug named a post that does not exist — the route turns that into a 404.
 */
async function editorView(slug: string) {
  const [post, allCategories, allTags, allSeries, settings] = await Promise.all([
    slug ? getPost(slug) : Promise.resolve(null),
    getCategories(), getTags(), getAllSeriesNames(), getSettings(),
  ])
  if (slug && !post) return null
  return {
    post, allCategories, allTags, allSeries,
    // WHEN, not WHAT. The snapshot is the whole body a second time, and the editor opens on
    // every post whether or not one is waiting; the timestamp is all the recovery bar needs to
    // decide whether to offer it, and the body is fetched only if somebody says yes.
    autosaveAt: slug ? (getAutosave('post', slug)?.at ?? null) : null,
    contentWidth: settings.contentWidth,
    keySound: { mode: settings.motion.keys, volume: settings.motion.keyVolume },
    autosaveSeconds: settings.autosaveSeconds,
  }
}

async function pageEditorView(slug: string) {
  const [page, settings] = await Promise.all([
    slug ? getPage(slug) : Promise.resolve(null), getSettings(),
  ])
  if (slug && !page) return null
  return {
    page,
    autosaveAt: slug ? (getAutosave('page', slug)?.at ?? null) : null,
    contentWidth: settings.contentWidth,
    keySound: { mode: settings.motion.keys, volume: settings.motion.keyVolume },
    autosaveSeconds: settings.autosaveSeconds,
  }
}

/**
 * A resolved window: what to measure, how to bucket it, and what to tell the client it
 * asked for. `range` is what the tab strip highlights, and it is the ONLY field that
 * carries 'all' — `days` is always a number, so every aggregate below stays untouched.
 */
type Window = { days: number; bucket: Bucket; range: 1 | 7 | 30 | 90 | 365 | 'all' }

/** Titles by public path, so a chart row can say what it is rather than "/slug". */
async function analyticsTitles() {
  const [posts, pages] = await Promise.all([getIndex(), getPageIndex()])
  const titles: Record<string, string> = {}
  for (const p of [...posts, ...pages]) titles[`/${p.slug}`] = p.title
  return titles
}

/** One page's detail, when the analytics screen is drilled into a path. */
async function analyticsDetailView(path: string, { days, bucket, range }: Window) {
  const titles = await analyticsTitles()
  return {
    detail: await getPageAnalytics(path, days, bucket),
    title: titles[path] ?? path,
    range,
  }
}

/**
 * The analytics summary — the screen's default face.
 *
 * `pieces` is what makes a piece OUTSIDE the top table reachable. The table stays the
 * default face; this is the index behind it, and it is joined to `titles` on the client
 * rather than here so that a piece with no views at all still has a row to click.
 */
async function analyticsSummaryView({ days, bucket, range }: Window) {
  return {
    summary: await getAnalytics(days, bucket),
    rightNow: await getRightNow(),
    titles: await analyticsTitles(),
    pieces: await getPieces(days, bucket),
    // Every year that has data, independent of the window above: the question "2024 against
    // 2025" is not a window question, and answering it by making the owner set a window
    // twice and hold both numbers in their head is not answering it.
    years: yearTotals(),
    range,
  }
}

async function commentsView() {
  const { rows } = await getAdminComments(1, 200)
  return { rows }
}

async function settingsView() {
  const [settings, commentEnv, integrations, posts, pages, categories] = await Promise.all([
    getSettings(), getCommentEnv(), getIntegrationStatus(), getPublicPosts(), getPublicPages(),
    getCategories(),
  ])
  return {
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
  }
}

async function newsletterView() {
  const [posts, stats, mail] = await Promise.all([
    getPublicPosts(), statsByPost(), getMailStatus(),
  ])
  return {
    posts: posts.map((p) => ({
      slug: p.slug, title: p.title, date: p.date, stats: stats.get(p.slug) ?? null,
    })),
    mailConfigured: mail.configured,
  }
}

async function logView() {
  const [entries, settings] = await Promise.all([getActivity(), getSettings()])
  return { entries, enabled: settings.features.activityLog }
}

async function trashView() {
  const [posts, pages, media, files, comments, subscribers] = await Promise.all([
    getTrashedPosts(), getTrashedPages(), getTrashedMedia(),
    getTrashedFiles(), getTrashedComments(), getTrashedSubscribers(),
  ])
  return { posts, pages, media, files, comments, subscribers }
}

/**
 * The assistant page. The conversation is client state, so this is everything the page
 * wants from the server — and it does want it: "no model connected" has to be visible
 * BEFORE a question is typed, not delivered as an error five seconds after sending one.
 */
async function assistantView() {
  const ai = await getIntegrationStatus()
  return { configured: ai.aiConfigured, model: ai.aiModel }
}

/**
 * The shell itself: the admin's language, the version Help and the dashboard print, and
 * whether a model is plugged in.
 *
 * `aiConfigured` is here rather than fetched by the rail because the rail is drawn before
 * anything else and a destination that appears a beat later is worse than one that never
 * appears. It is a boolean about a secret, never the secret.
 */
async function shellView() {
  const settings = await getSettings()
  const { aiConfigured } = await getIntegrationStatus()
  return { language: settings.language, version: VERSION, aiConfigured }
}

/** Storage totals for the media page's header, without listing every blob twice. */
async function mediaView() {
  const blobs = await listBlobs()
  return { count: blobs.length, totalBytes: blobs.reduce((sum, b) => sum + b.size, 0) }
}

/**
 * THE CONTRACT. `src/admin/useView.ts` resolves a view name to its payload type through
 * this map, so a renamed or retyped field on either side is a compile error on the other.
 * The admin imports it with `import type` only — guard #8 (`check:bundle`) reads the
 * built output to prove no value import ever follows.
 */
export type ViewPayloads = {
  dashboard: Awaited<ReturnType<typeof dashboardView>>
  content: Awaited<ReturnType<typeof contentView>>
  editor: NonNullable<Awaited<ReturnType<typeof editorView>>>
  'page-editor': NonNullable<Awaited<ReturnType<typeof pageEditorView>>>
  // One endpoint, two faces: the summary, or one page's detail when `path` is given. The
  // client narrows on the `detail` key, which only one face has.
  analytics:
    | Awaited<ReturnType<typeof analyticsSummaryView>>
    | Awaited<ReturnType<typeof analyticsDetailView>>
  'analytics-now': Awaited<ReturnType<typeof getRightNow>>
  comments: Awaited<ReturnType<typeof commentsView>>
  settings: Awaited<ReturnType<typeof settingsView>>
  newsletter: Awaited<ReturnType<typeof newsletterView>>
  log: Awaited<ReturnType<typeof logView>>
  trash: Awaited<ReturnType<typeof trashView>>
  assistant: Awaited<ReturnType<typeof assistantView>>
  shell: Awaited<ReturnType<typeof shellView>>
  media: Awaited<ReturnType<typeof mediaView>>
}

// ----- the routes -------------------------------------------------------------

export function viewRoutes(): OwnerRouter {
  const routes = new OwnerRouter()

  // The dashboard is the heaviest of these, so it lives in its own module.
  routes.get('/api/admin/view/dashboard', async (c) => c.json({ data: await dashboardView() }))

  routes.get('/api/admin/view/content', async (c) => c.json({ data: await contentView() }))

  // The owner's search, over title AND body, drafts included (ADR 0024). Separate from the
  // content view rather than a parameter on it: that view returns every post so the tables
  // can render, and this one answers a person typing, which has to stay small and quick.
  routes.get('/api/admin/search', async (c) => {
    const q = c.req.query('q') ?? ''
    return c.json({ data: { hits: await searchEverything(q) } })
  })

  routes.get('/api/admin/view/editor', async (c) => {
    const data = await editorView(c.req.query('slug') ?? '')
    if (data === null) return c.json({ error: 'Not found' }, 404)
    return c.json({ data })
  })

  routes.get('/api/admin/view/page-editor', async (c) => {
    const data = await pageEditorView(c.req.query('slug') ?? '')
    if (data === null) return c.json({ error: 'Not found' }, 404)
    return c.json({ data })
  })

  // Analytics: the summary, or one page's detail when `path` is given.
  routes.get('/api/admin/view/analytics', async (c) => {
    const window = rangeOf(c.req.query('range'))
    const path = c.req.query('path') ?? ''
    if (path) return c.json({ data: await analyticsDetailView(path, window) })
    return c.json({ data: await analyticsSummaryView(window) })
  })

  // The live strip's poll: five minutes of rows, nothing else. Separate from the view
  // above because the poll must not re-run a dashboard's worth of aggregates every few
  // seconds to refresh one number.
  routes.get('/api/admin/view/analytics-now', async (c) => c.json({ data: await getRightNow() }))

  routes.get('/api/admin/view/comments', async (c) => c.json({ data: await commentsView() }))

  routes.get('/api/admin/view/settings', async (c) => c.json({ data: await settingsView() }))

  routes.get('/api/admin/view/newsletter', async (c) => c.json({ data: await newsletterView() }))

  routes.get('/api/admin/view/log', async (c) => c.json({ data: await logView() }))

  routes.get('/api/admin/view/trash', async (c) => c.json({ data: await trashView() }))

  routes.get('/api/admin/view/assistant', async (c) => c.json({ data: await assistantView() }))

  routes.get('/api/admin/view/shell', async (c) => c.json({ data: await shellView() }))

  routes.get('/api/admin/view/media', async (c) => c.json({ data: await mediaView() }))

  return routes
}
