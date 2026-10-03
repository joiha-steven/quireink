// How long the analytics screens take on a big blog, and how long a reader would wait behind them.
//
// The screens are cheap on the blogs this project runs and were never measured on a big one, which
// is how the 365-day screen came to hold every reader of a million-view blog for twelve seconds
// before anybody noticed (2026-10-03, `docs/performance.md`). This builds that blog — a million
// views over a year by default, with returning readers, referrers, the facets and the leave
// samples in proportions like a real one — and times every screen read. Beside each it prints the
// LONGEST the event loop went without a turn while the read ran: that is the worst wait a reader
// asking for a page at that moment would have had, and the number `chunked.ts` exists to keep small.
//
//   bun scripts/bench-analytics.ts                    # 1,000,000 views, 300,000 leave samples
//   bun scripts/bench-analytics.ts 200000 60000       # smaller, quicker
//   BENCH_KEEP=1 bun scripts/bench-analytics.ts       # reuse the database the last run built
//
// Writes only under `.tmp/bench-analytics/`, and the filling is deterministic, so two runs on two
// commits time the same rows. Run it with `bun --smol` for the numbers `bun run start` would see.
import { existsSync, rmSync } from 'node:fs'
import { openDatabases } from '@/store/db'
import { analyticsQuery } from '@/store/query'
import { getAnalytics, getDashboardTraffic, getPieces, yearTotals } from '@/analytics/summary'
import { getPageAnalytics } from '@/analytics/page'

const DIR = '.tmp/bench-analytics'
const VIEWS = Number(process.argv[2] ?? 1_000_000)
const LEAVES = Number(process.argv[3] ?? 300_000)
const DAY = 86_400_000

const fresh = !(process.env.BENCH_KEEP && existsSync(`${DIR}/analytics.db`))
if (fresh) rmSync(DIR, { recursive: true, force: true })
openDatabases(DIR)

if (fresh) {
  let seed = 42
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  // Popularity falls off steeply, as it does on a blog: the front page and a few posts take most.
  const skewed = <T>(xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rnd() ** 2.4 * xs.length))]!
  const hex = () => Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('')
  const paths = ['/', '/search', '/notes', '/page/2', '/tag/craft', ...Array.from({ length: 340 }, (_, i) => `/post-${i}`)]
  const hosts = ['www.google.com', 'google.com', 'l.facebook.com', 'm.facebook.com', 't.co', 'news.ycombinator.com',
    'duckduckgo.com', 'www.bing.com', 'github.com', ...Array.from({ length: 60 }, (_, i) => `blog${i}.example.net`)]
  const countries = ['US', 'VN', 'DE', 'GB', 'FR', 'IN', 'JP', 'CA', 'BR', 'AU', 'NL', 'SE', 'PL', 'ES', 'IT', 'KR', 'SG', 'ID']
  type Reader = { id: string; country: string; device: string; browser: string; os: string }
  const readers: Reader[] = []
  const now = Date.now()
  // Visits in time order, as the server writes them: a reader, a referrer on the first view only,
  // then a page or two a few minutes apart. A third of visits are a returning reader.
  const visits: { at: number; views: number }[] = []
  for (let made = 0; made < VIEWS;) {
    const views = Math.min(VIEWS - made, 1 + Math.floor(-Math.log(1 - rnd()) * 0.9))
    visits.push({ at: now - Math.floor(rnd() * 365 * DAY), views })
    made += views
  }
  visits.sort((a, b) => a.at - b.at)
  const leaveShare = LEAVES / VIEWS
  analyticsQuery.tx(() => {
    for (const visit of visits) {
      const back = readers.length > 0 && rnd() < 0.35
      const reader = back ? readers[readers.length - 1 - Math.floor(rnd() ** 3 * readers.length)]! : {
        id: hex(), country: skewed(countries), device: skewed(['desktop', 'mobile', 'tablet']),
        browser: skewed(['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera']), os: skewed(['Windows', 'macOS', 'iOS', 'Android', 'Linux']),
      }
      if (!back) readers.push(reader)
      const host = rnd() < 0.45 ? skewed(hosts) : null
      for (let i = 0, at = visit.at; i < visit.views; i++, at += 20_000 + Math.floor(rnd() * 240_000)) {
        const path = skewed(paths)
        analyticsQuery.run(
          `insert into analytics_events (path, visitor, referrer_host, country, device, browser, os, created_at)
           values (?, ?, ?, ?, ?, ?, ?, ?)`,
          path, reader.id, i === 0 ? host : null, reader.country, reader.device, reader.browser, reader.os, at,
        )
        if (rnd() < leaveShare) {
          analyticsQuery.run(
            `insert into analytics_scroll (path, depth, dwell_ms, bytes, visitor, created_at) values (?, ?, ?, ?, ?, ?)`,
            path, Math.floor(rnd() * 101), Math.floor(rnd() ** 2 * 2_400_000), Math.floor(200_000 + rnd() * 2_000_000), reader.id, at + 5_000,
          )
        }
      }
    }
  })
  console.log(`built ${VIEWS} views by ${readers.length} readers over 365 days in ${DIR}`)
}

/** Wall time of one read, and the longest the event loop went without a turn during it. */
async function time(label: string, read: () => Promise<unknown>): Promise<void> {
  let last = performance.now()
  let worst = 0
  let running = true
  const tick = () => {
    const t = performance.now()
    worst = Math.max(worst, t - last)
    last = t
    if (running) setImmediate(tick)
  }
  setImmediate(tick)
  const start = performance.now()
  await read()
  running = false
  console.log(`${label.padEnd(30)} ${(performance.now() - start).toFixed(0).padStart(7)} ms   longest block ${worst.toFixed(0).padStart(5)} ms`)
}

await time('summary, 7 days (warm-up)', () => getAnalytics(7))
for (const days of [30, 90, 365]) await time(`summary, ${days} days`, () => getAnalytics(days))
await time('summary, all time by month', () => getAnalytics(366, 'month'))
await time('every piece, 365 days', () => getPieces(365))
await time('years', () => yearTotals())
await time('dashboard, 30 days', () => getDashboardTraffic(30))
await time('one page (/), 365 days', () => getPageAnalytics('/', 365))
