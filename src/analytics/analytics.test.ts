// The dashboard numbers, end to end against real rows. Twelve small statements replaced
// one plpgsql function, so what needs pinning is the arithmetic each of them stands for:
// unique means distinct visitor, an average skips missing samples, a channel counts a
// person once however many hosts they arrived from.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { analyticsDb, db } from '@/store/db'
import { getAnalytics, getRightNow, getViewTotals } from '@/analytics/summary'
import { getPageAnalytics } from '@/analytics/page'
import { isBot, normalizePath, recordView, recordScroll } from '@/analytics/record'
import { flushAnalytics, resetAnalyticsBuffer, pendingAnalytics } from '@/analytics/buffer'
import { canonicalHost } from '@/analytics/channel'

const DIR = './.tmp/test-analytics'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

const HOUR = 3_600_000
const ago = (h: number) => Date.now() - h * HOUR

beforeEach(() => {
  resetAnalyticsBuffer()
  analyticsDb().run(`delete from analytics_events`)
  analyticsDb().run(`delete from analytics_scroll`)
  // `recordView` verifies a single-segment path is REAL content before buffering
  // (`pathIsServable`), so the slugs these tests beacon at must exist as rows.
  db().run(`delete from posts`)
  for (const slug of ['a', 'b', 'c', 'hello']) {
    db().run(
      `insert into posts (slug, title, date, status, created_at, updated_at)
       values (?, ?, 1, 'published', 1, 1)`, [slug, slug],
    )
  }
})

type View = { path?: string; visitor?: string; host?: string | null; country?: string | null; device?: string | null; at?: number }
const view = (v: View = {}) =>
  analyticsDb().run(
    `insert into analytics_events (path, visitor, referrer_host, country, device, browser, os, created_at)
     values (?, ?, ?, ?, ?, 'Chrome', 'macOS', ?)`,
    // `?? 'desktop'` would turn an EXPLICIT null into a value, which is exactly the case
    // the Unknown-facet test needs, so absence and null are distinguished here.
    [v.path ?? '/a', v.visitor ?? 'v1', v.host ?? null, v.country ?? null,
     'device' in v ? (v.device ?? null) : 'desktop', v.at ?? ago(1)],
  )

const scroll = (depth: number, dwell: number | null, path = '/a', at = ago(1)) =>
  analyticsDb().run(
    `insert into analytics_scroll (path, depth, dwell_ms, visitor, created_at) values (?, ?, ?, 'v1', ?)`,
    [path, depth, dwell, at],
  )

describe('recording', () => {
  it('drops bots and untracked paths before they reach the buffer', async () => {
    await recordView('/a', '1.1.1.1', 'Googlebot/2.1')
    await recordView('/admin/posts', '1.1.1.1', 'Mozilla/5.0')
    await recordView('/api/health', '1.1.1.1', 'Mozilla/5.0')
    await recordView('not-a-path', '1.1.1.1', 'Mozilla/5.0')
    expect(pendingAnalytics()).toBe(0)
  })

  // The beacon is an open POST, and until 2026-08-29 any fabricated path it named became
  // a permanent row — junk in the top-pages table, distinct-path growth no per-IP cap
  // bounds. A single-segment path must be REAL content now (`pathIsServable`).
  it('drops a path the site cannot serve, and keeps the ones it can', async () => {
    await recordView('/khong-ton-tai-dau', '1.1.1.1', 'Mozilla/5.0')
    await recordView('/uploads/media/x.png', '1.1.1.1', 'Mozilla/5.0')
    expect(pendingAnalytics()).toBe(0)
    await recordView('/hello', '1.1.1.1', 'Mozilla/5.0') // a real post, seeded above
    await recordView('/', '1.1.1.1', 'Mozilla/5.0')
    await recordView('/category/anything', '1.1.1.1', 'Mozilla/5.0') // archives: shape only
    expect(pendingAnalytics()).toBe(3)
  })

  it('buffers a view and writes it only on flush (Invariant 7)', async () => {
    await recordView('/hello/', '1.1.1.1', 'Mozilla/5.0 (Macintosh)', 'google.com', 'VN')
    expect(pendingAnalytics()).toBe(1)
    expect(await getViewTotals()).toEqual({})
    flushAnalytics()
    expect(pendingAnalytics()).toBe(0)
    expect(await getViewTotals()).toEqual({ '/hello': 1 }) // trailing slash normalized away
  })

  it('stores no raw IP or user agent, only an opaque visitor token', async () => {
    await recordView('/a', '203.0.113.9', 'Mozilla/5.0 (Macintosh)')
    flushAnalytics()
    const row = analyticsDb().query<{ visitor: string }, []>(`select visitor from analytics_events`).get()!
    expect(row.visitor).toMatch(/^[0-9a-f]{32}$/)
    const dump = JSON.stringify(analyticsDb().query(`select * from analytics_events`).all())
    expect(dump).not.toContain('203.0.113.9')
    expect(dump).not.toContain('Macintosh')
  })

  it('gives the same visitor the same token, and a different one a different token', async () => {
    await recordView('/a', '1.1.1.1', 'UA-one')
    await recordView('/b', '1.1.1.1', 'UA-one')
    await recordView('/c', '2.2.2.2', 'UA-one')
    flushAnalytics()
    const n = analyticsDb().query<{ n: number }, []>(`select count(distinct visitor) n from analytics_events`).get()!.n
    expect(n).toBe(2)
  })

  it('clamps a scroll sample to 0-100 and a dwell to a day', async () => {
    await recordScroll('/a', 999, '1.1.1.1', 'Mozilla/5.0', 99_999_999_999)
    await recordScroll('/a', -5, '1.1.1.1', 'Mozilla/5.0')
    flushAnalytics()
    const rows = analyticsDb().query<{ depth: number; dwell_ms: number | null }, []>(
      `select depth, dwell_ms from analytics_scroll order by depth`).all()
    expect(rows).toEqual([{ depth: 0, dwell_ms: null }, { depth: 100, dwell_ms: 86_400_000 }])
  })

  it('flushes automatically once the buffer is full', async () => {
    // `/page/N` paths: servable by shape (no per-slug fixture needed), distinct per i.
    for (let i = 0; i < 200; i++) await recordView(`/page/${i + 1}`, `${i}.1.1.1`, 'Mozilla/5.0')
    expect(pendingAnalytics()).toBe(0)
    expect(Object.keys(await getViewTotals())).toHaveLength(200)
  })

  it('isBot and normalizePath keep their frozen-tree behaviour', () => {
    expect(isBot('')).toBe(true)
    expect(isBot('claudebot')).toBe(true)
    expect(isBot('Mozilla/5.0 (Macintosh)')).toBe(false)
    expect(normalizePath('/a/?x=1#y')).toBe('/a')
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('/admin')).toBeNull()
  })
})

describe('summary', () => {
  it('counts views and DISTINCT visitors, not views twice', async () => {
    view({ visitor: 'v1' })
    view({ visitor: 'v1' })
    view({ visitor: 'v2' })
    const s = await getAnalytics(7)
    expect(s.totalViews).toBe(3)
    expect(s.uniqueVisitors).toBe(2)
  })

  it('averages depth over all samples and dwell over the ones that measured it', async () => {
    scroll(20, 1000)
    scroll(80, null) // no dwell measured: counts for depth, not for dwell
    const s = await getAnalytics(7)
    expect(s.avgReadDepth).toBe(50)
    expect(s.avgDwellMs).toBe(1000)
  })

  it('counts single-page visitors', async () => {
    view({ visitor: 'once' })
    view({ visitor: 'twice', path: '/a' })
    view({ visitor: 'twice', path: '/b' })
    expect((await getAnalytics(7)).singlePageVisitors).toBe(1)
  })

  // ONE PAGE, not one event. The query asked `count(*) = 1` until 2026-08-30, so a reader
  // who opened one post and reloaded it — or came back to the same post later — fell out of
  // the count, and the bounce rate read low by exactly the people who bounced twice. On a
  // live blog that was 30 of 380 visitors: 52% shown where 60% was true.
  it('still counts a visitor who read ONE page more than once', async () => {
    view({ visitor: 'reloader', path: '/a' })
    view({ visitor: 'reloader', path: '/a' })
    view({ visitor: 'reloader', path: '/a' })
    expect((await getAnalytics(7)).singlePageVisitors).toBe(1)
  })

  it('ranks top pages and attaches their engagement', async () => {
    view({ path: '/busy' })
    view({ path: '/busy', visitor: 'v2' })
    view({ path: '/quiet' })
    scroll(60, 5000, '/busy')
    const s = await getAnalytics(7)
    expect(s.topPages[0]).toMatchObject({ path: '/busy', views: 2, visitors: 2, avgDepth: 60, avgDwellMs: 5000 })
    // NULL, not 0. This line asserted 0 until 2026-08-30, which is how the table came to
    // print "0s · 0%" for a page nobody's leave was ever measured on — a reading that says
    // "they left at once" beside rows saying "2m 10s". Zero is a real answer now that an
    // unscrolled leave records depth 0, so it cannot also stand for "no answer".
    expect(s.topPages[1]).toMatchObject({ path: '/quiet', avgDepth: null, avgDwellMs: null })
  })

  it('tells a page measured at zero apart from a page never measured', async () => {
    view({ path: '/glanced' })
    view({ path: '/unmeasured' })
    scroll(0, 3000, '/glanced') // the sample a bounce leaves
    const s = await getAnalytics(7)
    const by = Object.fromEntries(s.topPages.map((p) => [p.path, p]))
    expect(by['/glanced']).toMatchObject({ avgDepth: 0, avgDwellMs: 3000 })
    expect(by['/unmeasured']).toMatchObject({ avgDepth: null, avgDwellMs: null })
  })

  it('compares against the window just before, and finds returning visitors', async () => {
    view({ visitor: 'old', at: ago(24 * 9) }) // before the 7-day window, inside the previous one
    view({ visitor: 'old', at: ago(1) })
    view({ visitor: 'new', at: ago(1) })
    const s = await getAnalytics(7)
    expect(s.prevViews).toBe(1)
    expect(s.prevVisitors).toBe(1)
    expect(s.returningVisitors).toBe(1)
  })

  it('excludes anything older than the window', async () => {
    view({ at: ago(24 * 30) })
    expect((await getAnalytics(7)).totalViews).toBe(0)
  })

  it('ranks referrers and countries by DISTINCT visitors, skipping blanks', async () => {
    view({ visitor: 'v1', host: 'news.example', country: 'VN' })
    view({ visitor: 'v1', host: 'news.example', country: 'VN' })
    view({ visitor: 'v2', host: 'blog.example', country: 'DE' })
    view({ visitor: 'v3', host: null, country: null })
    const s = await getAnalytics(7)
    // Ties break alphabetically now that the fold sorts in TypeScript — deterministic,
    // where the SQL group-by order was whatever the engine felt like.
    expect(s.topReferrers).toEqual([
      { host: 'blog.example', visitors: 1 }, { host: 'news.example', visitors: 1 },
    ])
    expect(s.topCountries!.map((c) => c.country).sort()).toEqual(['DE', 'VN'])
  })

  it('surfaces a missing audience value as Unknown', async () => {
    view({ visitor: 'v1', device: 'mobile' })
    view({ visitor: 'v2', device: null })
    expect((await getAnalytics(7)).devices!.map((d) => d.name).sort()).toEqual(['Unknown', 'mobile'])
  })

  it('buckets read depth into quartiles', async () => {
    for (const d of [0, 24, 25, 49, 50, 74, 75, 100]) scroll(d, null)
    expect((await getAnalytics(7)).depthBuckets).toEqual([
      { bucket: 0, samples: 2 }, { bucket: 1, samples: 2 },
      { bucket: 2, samples: 2 }, { bucket: 3, samples: 2 },
    ])
  })

  it('returns a daily series whose totals add up to the window total', async () => {
    view({ at: ago(1) })
    view({ at: ago(30) })
    view({ at: ago(60) })
    const s = await getAnalytics(7)
    expect(s.daily.reduce((n, d) => n + d.views, 0)).toBe(s.totalViews)
  })

  it('is empty, not broken, with no data at all', async () => {
    const s = await getAnalytics(7)
    expect(s).toMatchObject({ totalViews: 0, uniqueVisitors: 0, avgReadDepth: 0, topPages: [] })
    // The chart still receives its full run of buckets — all zero, none missing.
    expect(s.daily.length).toBeGreaterThanOrEqual(7)
    expect(s.daily.every((d) => d.views === 0 && d.visitors === 0)).toBe(true)
  })
})

describe('per-page drill-down', () => {
  it('reports only the requested page', async () => {
    view({ path: '/wanted', visitor: 'v1' })
    view({ path: '/wanted', visitor: 'v2' })
    view({ path: '/other', visitor: 'v3' })
    scroll(40, 2000, '/wanted')
    scroll(90, 9000, '/other')
    const p = await getPageAnalytics('/wanted', 7)
    expect(p).toMatchObject({
      path: '/wanted', totalViews: 2, uniqueVisitors: 2, avgReadDepth: 40, avgDwellMs: 2000,
    })
  })

  it('scopes referrers, countries and depth to the page too', async () => {
    view({ path: '/wanted', visitor: 'v1', host: 'a.example', country: 'VN' })
    view({ path: '/other', visitor: 'v2', host: 'b.example', country: 'DE' })
    scroll(90, null, '/other')
    const p = await getPageAnalytics('/wanted', 7)
    expect(p.topReferrers).toEqual([{ host: 'a.example', visitors: 1 }])
    expect(p.topCountries).toEqual([{ country: 'VN', visitors: 1 }])
    expect(p.depthBuckets).toEqual([])
  })

  it('is empty for a page nobody visited', async () => {
    const p = await getPageAnalytics('/ghost', 7)
    expect(p).toMatchObject({ path: '/ghost', totalViews: 0 })
    expect(p.daily.every((d) => d.views === 0)).toBe(true)
  })
})

describe('canonicalHost', () => {
  it('peels plumbing labels down to the host a reader would name', () => {
    expect(canonicalHost('l.facebook.com')).toBe('facebook.com')
    expect(canonicalHost('lm.facebook.com')).toBe('facebook.com')
    expect(canonicalHost('m.facebook.com')).toBe('facebook.com')
    expect(canonicalHost('www.bing.com')).toBe('bing.com')
    expect(canonicalHost('L.M.Facebook.com.')).toBe('facebook.com') // peels twice, case, trailing dot
    expect(canonicalHost('out.reddit.com')).toBe('reddit.com')
  })

  it('leaves an identity subdomain alone — wrong is worse than long', () => {
    expect(canonicalHost('news.google.com')).toBe('news.google.com')
    expect(canonicalHost('accounts.google.com')).toBe('accounts.google.com')
    expect(canonicalHost('vn.search.yahoo.com')).toBe('vn.search.yahoo.com')
    expect(canonicalHost('news.ycombinator.com')).toBe('news.ycombinator.com')
    // Peeling must stop while what remains is still a domain: `www.com` is a host, not plumbing.
    expect(canonicalHost('www.com')).toBe('www.com')
  })
})

describe('referrer folding in the top list', () => {
  it("folds one source's plumbing hosts into one row without double-counting a visitor", async () => {
    view({ visitor: 'v1', host: 'l.facebook.com' })
    view({ visitor: 'v1', host: 'm.facebook.com' }) // same person, second door: still ONE
    view({ visitor: 'v2', host: 'www.facebook.com' })
    view({ visitor: 'v3', host: 'news.ycombinator.com' })
    const s = await getAnalytics(7)
    expect(s.topReferrers).toEqual([
      { host: 'facebook.com', visitors: 2 },
      { host: 'news.ycombinator.com', visitors: 1 },
    ])
  })
})

describe('dwell ceiling', () => {
  it('clamps a forgotten tab to 30 minutes instead of letting it move the average', async () => {
    scroll(50, 60_000)          // a minute of reading
    scroll(50, 86_400_000)      // a tab left open for a day
    const s = await getAnalytics(7)
    // (60s + 30min) / 2, not (60s + 24h) / 2 — the day-long sample counts as a long read.
    expect(s.avgDwellMs).toBe(Math.round((60_000 + 1_800_000) / 2))
  })

  it('does not resurrect a sample that never measured a dwell', async () => {
    scroll(50, 4_000)
    scroll(80, null) // depth sample without a dwell: avg() must still skip it
    const s = await getAnalytics(7)
    expect(s.avgDwellMs).toBe(4_000)
  })
})

describe('right now', () => {
  it('counts distinct visitors over the trailing five minutes, by page', async () => {
    view({ visitor: 'a', path: '/hot', at: Date.now() - 60_000 })
    view({ visitor: 'b', path: '/hot', at: Date.now() - 120_000 })
    view({ visitor: 'a', path: '/hot', at: Date.now() - 30_000 }) // a reload is not a person
    view({ visitor: 'c', path: '/other', at: Date.now() - 240_000 })
    view({ visitor: 'd', path: '/stale', at: Date.now() - 6 * 60_000 }) // outside the window
    expect(await getRightNow()).toEqual({
      visitors: 3,
      pages: [{ path: '/hot', visitors: 2 }, { path: '/other', visitors: 1 }],
    })
  })

  it('is quiet, not broken, when nobody is there', async () => {
    expect(await getRightNow()).toEqual({ visitors: 0, pages: [] })
  })

  it('refuses to count a row from the future', async () => {
    view({ visitor: 'tomorrow', at: Date.now() + 60_000 }) // seeded/imported, never organic
    expect(await getRightNow()).toEqual({ visitors: 0, pages: [] })
  })
})


describe('getViewTotals', () => {
  it('counts ALL time, not the dashboard window', async () => {
    view({ path: '/a', at: ago(24 * 400) })
    view({ path: '/a' })
    view({ path: '/b' })
    expect(await getViewTotals()).toEqual({ '/a': 2, '/b': 1 })
  })
})
