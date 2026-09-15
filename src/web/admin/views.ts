// One payload per admin view, holding exactly the facts that view needs and nothing else.
//
// In the frozen tree each of these was a server component: it called `getIndex()` or
// `getAnalytics()` directly, assembled the props and rendered. The assembly still has to
// happen somewhere the database is reachable, and this is that somewhere. Two kinds of caller
// reach it since ADR 0054: the screens in `web/admin/screens/` call these functions straight
// while they draw the page, and `viewRoutes()` at the bottom, mounted by `web/app.ts`, serves
// the few payloads the browser still fetches for itself (the palette's search, analytics' poll,
// the writing sheet's own view). Deliberately NOT a generic query API: the shape each page
// needs is already known, and a generic one would turn one round trip into five.
//
// Each payload is built by a NAMED function with an INFERRED return type, and that is the
// typed contract: a caller reads fields off what the builder returned, so renaming one here is
// a compile error where it is read rather than a blank panel. Until 2026-08-29 these were
// thirteen inline object literals and the reader asserted whatever shape it liked, so a rename
// left `tsc` green while the screen went blank. Keep the returns inferred: an annotation like
// `Record<string, unknown>` reopens the hole this closed.
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
import { getNoteIndex, getTrashedNotes, getNote } from '@/content/notes'
import { getPost } from '@/content/posts'
import { getAllSeriesNames } from '@/content/series'
import { searchEverything } from '@/content/search-owner'
import { getSettings } from '@/content/settings'
import { THEME_PRESETS } from '@/content/themes'
import { getTrashedMedia } from '@/media/media'
import { getTrashedFiles } from '@/media/files'
import { OwnerRouter } from '@/web/guard'
import { APP_VERSION } from '@/version'
import { dashboardView } from '@/web/admin/views-home'
import { newsletterView } from '@/web/admin/views-news'

/** Printed by the Help page and the dashboard, so the two can never disagree. */
const VERSION = APP_VERSION

/**
 * A window of days, from the `range` query. The frozen tree offered these four (plus the
 * hourly day view). Returned as the LITERAL union, not `number`: the typed view contract
 * carries it to the client, and typing it loosely here is how the client came to believe
 * 90 was impossible — its `Range` type listed four values while this accepted five.
 */
export function rangeOf(raw: string | undefined): Window {
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

/** Posts, pages and notes, with the view totals and comment counts each table shows. */
async function contentView() {
  const settings = await getSettings()
  const commentsEnabled = settings.comments.enabled
  const [posts, pages, notes, views, commentCounts] = await Promise.all([
    getIndex(), getPageIndex(), getNoteIndex(), getViewTotals(),
    commentsEnabled ? countsByPosts() : Promise.resolve({} as Record<string, number>),
  ])
  return { posts, pages, notes, views, commentCounts, commentsEnabled }
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
    keySound: { mode: settings.motion.keys, volume: settings.motion.keyVolume, squeak: settings.motion.penSqueak },
    autosaveSeconds: settings.autosaveSeconds,
    // A schedule is a wall-clock time on the BLOG's clock, not on the clock of whichever
    // machine happens to be typing it. Without this the editor read and wrote the browser's
    // zone, so a post scheduled from a laptop on UTC went out seven hours late in Hanoi and
    // the line under the field agreed with the laptop.
    timezone: settings.timezone,
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
    keySound: { mode: settings.motion.keys, volume: settings.motion.keyVolume, squeak: settings.motion.penSqueak },
    autosaveSeconds: settings.autosaveSeconds,
  }
}

async function noteEditorView(slug: string) {
  const [note, settings] = await Promise.all([
    slug ? getNote(slug) : Promise.resolve(null), getSettings(),
  ])
  if (slug && !note) return null
  return {
    note,
    autosaveAt: slug ? (getAutosave('note', slug)?.at ?? null) : null,
    contentWidth: settings.contentWidth,
    keySound: { mode: settings.motion.keys, volume: settings.motion.keyVolume, squeak: settings.motion.penSqueak },
    autosaveSeconds: settings.autosaveSeconds,
    timezone: settings.timezone,
  }
}

/**
 * A resolved window: what to measure, how to bucket it, and what to tell the client it
 * asked for. `range` is what the tab strip highlights, and it is the ONLY field that
 * carries 'all' — `days` is always a number, so every aggregate below stays untouched.
 */
export type Window = { days: number; bucket: Bucket; range: 1 | 7 | 30 | 90 | 365 | 'all' }

/** Titles by public path, so a chart row can say what it is rather than "/slug". */
async function analyticsTitles() {
  const [posts, pages] = await Promise.all([getIndex(), getPageIndex()])
  const titles: Record<string, string> = {}
  for (const p of [...posts, ...pages]) titles[`/${p.slug}`] = p.title
  return titles
}

/** One page's detail, when the analytics screen is drilled into a path. */
export async function analyticsDetailView(path: string, { days, bucket, range }: Window) {
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
export async function analyticsSummaryView({ days, bucket, range }: Window) {
  // TOGETHER, not one after another. Four independent reads that were awaited in a row, which
  // cost nothing worth naming while a fetch filled an already-painted screen and costs the
  // whole wait when the HTML response itself is the thing being held up (ADR 0054).
  const [summary, rightNow, titles, pieces] = await Promise.all([
    getAnalytics(days, bucket), getRightNow(), analyticsTitles(), getPieces(days, bucket),
  ])
  // Every year that has data, independent of the window above: the question "2024 against
  // 2025" is not a window question, and answering it by making the owner set a window twice
  // and hold both numbers in their head is not answering it.
  return { summary, rightNow, titles, pieces, years: yearTotals(), range }
}

export async function commentsView() {
  const { rows } = await getAdminComments(1, 200)
  return { rows }
}

/**
 * Everything the settings screen reads, in one pass.
 *
 * Exported since that screen became a page (ADR 0054): the server-rendered screen and the JSON
 * route behind `/api/admin/view/settings` read the SAME builder, the way the analytics screen
 * and its route do. Two builders would be two answers to one question.
 *
 * It sends no secret. `getIntegrationStatus` turns every stored credential into a boolean, and
 * nothing here touches `users`, `recovery_codes`, `sessions` or `mcp_tokens`.
 */
export async function settingsView() {
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

export async function logView() {
  const [entries, settings] = await Promise.all([getActivity(), getSettings()])
  return { entries, enabled: settings.features.activityLog }
}

export async function trashView() {
  const [posts, pages, notes, media, files, comments, subscribers] = await Promise.all([
    getTrashedPosts(), getTrashedPages(), getTrashedNotes(), getTrashedMedia(),
    getTrashedFiles(), getTrashedComments(), getTrashedSubscribers(),
  ])
  return { posts, pages, notes, media, files, comments, subscribers }
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
 *
 * `navOrder` rides along for the same reason and it is the stricter case: it decides where
 * every row goes, so fetching it separately would draw the rail in one order and then
 * rearrange it under the pointer.
 */
export async function shellView() {
  const settings = await getSettings()
  const { aiConfigured } = await getIntegrationStatus()
  // The portrait rides along for the same reason `navOrder` does: the rail's foot draws it
  // on the first frame, and a second request for one string would show a blank ring first.
  // `seenRelease` and `look` ride along for the what's-new panel: one comparison decides
  // whether it appears at all, and it must be answered before the first paint rather than
  // by a second round trip that would let the panel arrive after the page.
  return { language: settings.language, version: VERSION, aiConfigured, navOrder: settings.navOrder, avatar: settings.author.avatarUrl, seenRelease: settings.seenRelease, look: settings.look }
}

/**
 * EVERY PAYLOAD'S TYPE, under the name its endpoint answers to.
 *
 * The shapes are the builders' own, so a caller that holds the builder is already held to
 * them. What this map adds is the NAME: a reader that has only the string `'analytics'` can
 * reach the type that address returns without writing the shape out a second time.
 *
 * ⚠️ NOTHING IMPORTS IT TODAY, counted 2026-09-16. `src/admin/useView.ts` resolved a name
 * through it and left with the React admin in ADR 0054, and the screens that replaced it hold
 * the builders directly. It is kept because the addresses it names are still served and the
 * browser still fetches three of them; if it is ever imported again, the rule that mattered is
 * that `src/admin` may take it with `import type` only, never as a value. Guard #8
 * (`check:bundle`) proves that from the built output rather than from the import graph.
 */
export type ViewPayloads = {
  dashboard: Awaited<ReturnType<typeof dashboardView>>
  content: Awaited<ReturnType<typeof contentView>>
  editor: NonNullable<Awaited<ReturnType<typeof editorView>>>
  'page-editor': NonNullable<Awaited<ReturnType<typeof pageEditorView>>>
  'note-editor': NonNullable<Awaited<ReturnType<typeof noteEditorView>>>
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

  routes.get('/api/admin/view/note-editor', async (c) => {
    const data = await noteEditorView(c.req.query('slug') ?? '')
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

  return routes
}
