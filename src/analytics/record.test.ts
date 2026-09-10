// What the beacon is allowed to write: which paths, which visitors, and how a leave
// sample lands. The dashboard arithmetic over the rows is in analytics.test.ts; this file
// is about the rows themselves — a bot dropped, a path that does not exist dropped, a
// second leave from the same sitting updating the first rather than joining it.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { analyticsDb, db } from '@/store/db'
import { getViewTotals } from '@/analytics/summary'
import { isBot, normalizePath, recordView, recordScroll } from '@/analytics/record'
import { flushAnalytics, resetAnalyticsBuffer, pendingAnalytics } from '@/analytics/buffer'
import { getSettings } from '@/content/settings'
import { listPageSize } from '@/content/paginate'

// Its own directory: `openDatabases` holds one connection pair per process, so two test
// files sharing a directory would close each other's.
const DIR = './.tmp/test-record'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => {
  resetAnalyticsBuffer()
  analyticsDb().run(`delete from analytics_events`)
  analyticsDb().run(`delete from analytics_scroll`)
  // `recordView` verifies a single-segment path is REAL content before buffering
  // (`pathIsServable`), so the slugs these tests beacon at must exist as rows.
  db().run(`delete from post_terms`)
  db().run(`delete from posts`)
  for (const slug of ['a', 'b', 'c', 'hello']) {
    db().run(
      `insert into posts (slug, title, date, status, created_at, updated_at)
       values (?, ?, 1, 'published', 1, 1)`, [slug, slug],
    )
  }
})

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
    expect(pendingAnalytics()).toBe(2)
  })

  /**
   * An archive-shaped path used to pass on shape alone, so `/page/999` and a crawler's
   * guess at a tag counted as views of a page that answers 404. Each shape is now resolved
   * the way the router resolves it: the term over the public posts, the page number
   * against how many list pages there are.
   */
  describe('an archive that does not exist is not a view', () => {
    const seedPosts = (n: number, prefix = 'p') => {
      for (let i = 0; i < n; i++) {
        db().run(
          `insert into posts (slug, title, date, status, created_at, updated_at) values (?, ?, 1, 'published', 1, 1)`,
          [`${prefix}${i}`, `${prefix}${i}`],
        )
      }
    }
    const tag = (slug: string, term: string) =>
      db().run(`insert into post_terms (post_slug, kind, term) values (?, 'tag', ?)`, [slug, term])

    it('counts a list page only while the list has that many pages', async () => {
      const perPage = listPageSize(await getSettings())
      seedPosts(perPage + 1) // four seeded above, so two pages
      await recordView('/page/2', '1.1.1.1', 'Mozilla/5.0')
      expect(pendingAnalytics()).toBe(1)
      await recordView('/page/3', '1.1.1.1', 'Mozilla/5.0')
      await recordView('/page/1', '1.1.1.1', 'Mozilla/5.0') // page 1 lives at `/`, this 404s
      await recordView('/page/0', '1.1.1.1', 'Mozilla/5.0')
      expect(pendingAnalytics()).toBe(1)
    })

    it('counts a term archive only when a public post carries the term', async () => {
      tag('hello', 'Lập trình')
      await recordView('/tag/lap-trinh', '1.1.1.1', 'Mozilla/5.0') // the slug the site links
      await recordView('/tag/L%E1%BA%ADp%20tr%C3%ACnh', '1.1.1.1', 'Mozilla/5.0') // the old spelling still resolves
      expect(pendingAnalytics()).toBe(2)
      await recordView('/tag/nonexistent', '1.1.1.1', 'Mozilla/5.0')
      await recordView('/category/lap-trinh', '1.1.1.1', 'Mozilla/5.0') // a tag is not a category
      expect(pendingAnalytics()).toBe(2)
    })

    it('counts a term archive page only while that term has that many pages', async () => {
      tag('hello', 'one')
      await recordView('/tag/one/page/2', '1.1.1.1', 'Mozilla/5.0')
      expect(pendingAnalytics()).toBe(0)
      const perPage = listPageSize(await getSettings())
      seedPosts(perPage, 'tagged')
      for (let i = 0; i < perPage; i++) tag(`tagged${i}`, 'one')
      await recordView('/tag/one/page/2', '1.1.1.1', 'Mozilla/5.0')
      expect(pendingAnalytics()).toBe(1)
    })

    it('counts a series only when a public post is in it, and never a page of one', async () => {
      db().run(`update posts set series = 'Đọc chậm' where slug = 'hello'`)
      await recordView('/series/doc-cham', '1.1.1.1', 'Mozilla/5.0')
      expect(pendingAnalytics()).toBe(1)
      await recordView('/series/nonexistent', '1.1.1.1', 'Mozilla/5.0')
      await recordView('/series/doc-cham/page/2', '1.1.1.1', 'Mozilla/5.0') // not a route
      expect(pendingAnalytics()).toBe(1)
    })

    it('does not count an archive on a draft alone', async () => {
      db().run(`update posts set status = 'draft' where slug = 'hello'`)
      tag('hello', 'secret')
      await recordView('/tag/secret', '1.1.1.1', 'Mozilla/5.0')
      expect(pendingAnalytics()).toBe(0)
    })
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
    // Two READERS, or the second sample would update the first (same visitor, same page).
    await recordScroll('/a', 999, '1.1.1.1', 'Mozilla/5.0', 99_999_999_999)
    await recordScroll('/a', -5, '2.2.2.2', 'Mozilla/5.0')
    flushAnalytics()
    const rows = analyticsDb().query<{ depth: number; dwell_ms: number | null }, []>(
      `select depth, dwell_ms from analytics_scroll order by depth`).all()
    expect(rows).toEqual([{ depth: 0, dwell_ms: null }, { depth: 100, dwell_ms: 86_400_000 }])
  })

  /**
   * The beacon sends a leave sample every time the tab is hidden and again after it comes
   * back, so one reading can arrive as several samples. Each carries the visit so far, so
   * the later one replaces the earlier for the same reader and page — a second ROW would
   * count the three seconds before the app switch as a bounce beside the five minutes after.
   */
  describe('a later leave from the same visit updates the sample', () => {
    const rows = () => analyticsDb().query<{ depth: number; dwell_ms: number | null; bytes: number | null }, []>(
      `select depth, dwell_ms, bytes from analytics_scroll order by id`).all()

    it('keeps one row per reader and page, with the deepest point and the latest dwell', async () => {
      await recordScroll('/a', 10, '1.1.1.1', 'Mozilla/5.0', 3_000, 500)
      await recordScroll('/a', 80, '1.1.1.1', 'Mozilla/5.0', 300_000, 900)
      flushAnalytics()
      expect(rows()).toEqual([{ depth: 80, dwell_ms: 300_000, bytes: 900 }])
    })

    it('keeps the deepest point when the reader came back and stayed near the top', async () => {
      await recordScroll('/a', 90, '1.1.1.1', 'Mozilla/5.0', 60_000)
      flushAnalytics() // already on disk, as it would be two seconds later
      await recordScroll('/a', 5, '1.1.1.1', 'Mozilla/5.0', 65_000)
      flushAnalytics()
      expect(rows()).toEqual([{ depth: 90, dwell_ms: 65_000, bytes: null }])
    })

    it('does not let an unmeasured value erase a measured one', async () => {
      await recordScroll('/a', 50, '1.1.1.1', 'Mozilla/5.0', 4_000, 700)
      await recordScroll('/a', 50, '1.1.1.1', 'Mozilla/5.0', undefined, undefined)
      flushAnalytics()
      expect(rows()).toEqual([{ depth: 50, dwell_ms: 4_000, bytes: 700 }])
    })

    it('still writes a row per reader, and per page', async () => {
      await recordScroll('/a', 50, '1.1.1.1', 'Mozilla/5.0', 1_000)
      await recordScroll('/a', 50, '2.2.2.2', 'Mozilla/5.0', 1_000)
      await recordScroll('/b', 50, '1.1.1.1', 'Mozilla/5.0', 1_000)
      flushAnalytics()
      expect(rows()).toHaveLength(3)
    })

    it('treats a sample after half an hour as a new visit', async () => {
      await recordScroll('/a', 30, '1.1.1.1', 'Mozilla/5.0', 2_000)
      flushAnalytics()
      analyticsDb().run(`update analytics_scroll set created_at = created_at - ?`, [31 * 60_000])
      await recordScroll('/a', 60, '1.1.1.1', 'Mozilla/5.0', 9_000)
      flushAnalytics()
      expect(rows().map((r) => r.depth)).toEqual([30, 60])
    })
  })

  it('flushes automatically once the buffer is full, on the next turn rather than in-line', async () => {
    // Two hundred real posts: a path has to exist to be counted, list pages included.
    for (let i = 0; i < 200; i++) {
      db().run(
        `insert into posts (slug, title, date, status, created_at, updated_at) values (?, ?, 1, 'published', 1, 1)`,
        [`post-${i}`, `post-${i}`],
      )
    }
    for (let i = 0; i < 200; i++) await recordView(`/post-${i}`, `${i}.1.1.1`, 'Mozilla/5.0')
    // NOT SYNCHRONOUSLY. This runs inside `/api/track`, and flushing here put a 200-row
    // transaction and its fsync in front of one reader's beacon in every two hundred, which
    // is the thing the buffer exists to prevent (Invariant 7). The flush is the next
    // macrotask, so one turn of the loop is what it takes to land.
    await new Promise((r) => setTimeout(r, 0))
    expect(pendingAnalytics()).toBe(0)
    expect(Object.keys(await getViewTotals())).toHaveLength(200)
  })

  // Real strings, because each one was a live visitor read the wrong way round: Telegram's
  // in-app browser was dropped as the Telegram bot, and Google's two page-executing fetchers
  // were counted as Android Chrome readers.
  it('tells the Telegram reader from the Telegram bot, and names Google\'s JS-running fetchers', () => {
    const telegramReader = 'Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.179 Mobile Safari/537.36 Telegram-Android/10.14.4 (Samsung SM-A536E; Android 13; SDK 33; AVERAGE)'
    expect(isBot(telegramReader)).toBe(false)
    expect(isBot('TelegramBot (like TwitterBot)')).toBe(true)
    expect(isBot('Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.66 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0;)')).toBe(true)
    expect(isBot('Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.66 Mobile Safari/537.36 (compatible; Google-Read-Aloud; +https://support.google.com/webmasters/answer/1061943)')).toBe(true)
    expect(isBot('Mediapartners-Google')).toBe(true)
    expect(isBot('Mozilla/5.0 (Linux; Android 7.0;) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)')).toBe(true)
    expect(isBot('Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)')).toBe(true)
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
