// Dashboard widgets for the admin Overview: a traffic summary (30-day views +
// visitors with a sparkline), the most-viewed posts, and a "needs attention"
// list (drafts, unused media). All data is gathered server-side in
// app/admin/page.tsx and passed in — these are presentational only.
import Link from '@/admin/router'
import { Card, CARD_GAP, CARD_STACK, READING } from './kit'
import { useAdminT } from './I18nProvider'

export type DashboardData = {
  // 30-day totals + the per-day view series for the sparkline; views7 is the last
  // 7 days summed from the same series (no extra query).
  traffic: { views30: number; visitors30: number; views7: number; spark: number[] }
  topPosts: { title: string; slug: string; views: number }[]
  // Counts the owner may want to act on. Comments have no moderation queue in
  // this app (publish-on-submit + soft-delete), so there is no "pending" here.
  // Unused-media is deliberately excluded — too heavy to compute on every load.
  //
  // `noExcerpt` and `noImage` were already being computed on every dashboard load and handed
  // to `Overview` as a `seo` prop that nothing rendered. They belong here: both are a live
  // post that will look wrong the moment somebody shares it, which is exactly what "needs
  // attention" is for, and the card carried one row before them.
  needs: { drafts: number; noExcerpt: number; noImage: number }
  // Same story — computed, passed, and never rendered. Two lists of at most five.
  sources: { referrers: { label: string; visitors: number }[]; countries: { label: string; visitors: number }[] }
}

// Tiny inline sparkline — no chart lib. Scales to the busiest day; uses
// currentColor so it follows the surrounding text colour in light/dark.
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 100
  const h = 28
  const step = w / (data.length - 1)
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 w-full text-neutral-700 dark:text-neutral-300" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

const VIEW_ALL =
  'text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'

/**
 * Two numbers that belong together, side by side.
 *
 * They used to be `justify-between` inside a card that spans two thirds of the workspace,
 * which put views at the far left and visitors 800px away at the far right with nothing in
 * between: two figures about the same thirty days, read as two unrelated facts. Comparing
 * them means having them within one glance of each other, so they sit at the left in reading
 * order and the space goes to the right of both.
 */
function Figure({ value, label, lead = false }: { value: number; label: string; lead?: boolean }) {
  return (
    <div>
      <div className={`${lead ? 'text-3xl font-bold' : 'text-3xl font-semibold text-neutral-500 dark:text-neutral-400'} tracking-tight tabular-nums`}>
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  )
}

function TrafficCard({ traffic }: { traffic: DashboardData['traffic'] }) {
  const t = useAdminT()
  return (
    <Card
      title={t.dashTraffic}
      actions={<Link href="/admin/analytics" className={VIEW_ALL}>{t.dashViewAnalytics}</Link>}
    >
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
        <Figure value={traffic.views30} label={t.dashViews30} lead />
        <Figure value={traffic.visitors30} label={t.dashVisitors30} />
      </div>
      <div className="mt-5">
        <Sparkline data={traffic.spark} />
      </div>
      <div className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
        {t.dashViews7}: <span className="tabular-nums">{traffic.views7.toLocaleString()}</span>
      </div>
    </Card>
  )
}

function TopPostsCard({ posts }: { posts: DashboardData['topPosts'] }) {
  const t = useAdminT()
  return (
    <Card title={t.dashTopPosts}>
      {posts.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">{t.dashTopEmpty}</p>
      ) : (
        <ol className="space-y-1">
          {posts.map((p, i) => (
            <li key={p.slug}>
              <Link
                href={`/${p.slug}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <span className="w-4 shrink-0 text-right text-xs font-medium text-neutral-400 dark:text-neutral-500">{i + 1}</span>
                {/* The owner's own headline, so it takes the reading face; the rank and
                    the view count either side of it are the machine's. */}
                <span className={`${READING} min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-200`}>{p.title}</span>
                <span className="shrink-0 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">{p.views.toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function NeedsAttentionCard({ needs }: { needs: DashboardData['needs'] }) {
  const t = useAdminT()
  // Drafts first because it is the owner's own unfinished work; the other two are published
  // and therefore already visible to somebody. A row with a zero still shows — the point of
  // the card is the whole checklist, and a list that changes length as counts hit zero makes
  // the page jump and hides which checks are even being run.
  const items = [
    { label: t.dashDrafts, count: needs.drafts, href: '/admin/content' },
    { label: t.dashNoExcerpt, count: needs.noExcerpt, href: '/admin/content' },
    { label: t.dashNoImage, count: needs.noImage, href: '/admin/content' },
  ]
  const allClear = items.every((i) => i.count === 0)
  return (
    <Card title={t.dashNeedsAttention}>
      {allClear ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">{t.dashAllClear}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <span className="text-neutral-600 dark:text-neutral-300">{i.label}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                    i.count > 0
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
                  }`}
                >
                  {i.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Where the last 30 days of readers came from. Two short lists, side by side. */
function SourcesCard({ sources }: { sources: DashboardData['sources'] }) {
  const t = useAdminT()
  const columns = [
    { heading: t.analyticsTopReferrers, rows: sources.referrers.slice(0, 4) },
    { heading: t.analyticsTopCountries, rows: sources.countries.slice(0, 4) },
  ]
  const empty = columns.every((c) => c.rows.length === 0)
  return (
    <Card
      title={t.dashSources}
      actions={<Link href="/admin/analytics" className={VIEW_ALL}>{t.dashViewAnalytics}</Link>}
    >
      {empty ? (
        <p className={`${READING} text-sm text-neutral-400 dark:text-neutral-500`}>{t.dashSourcesEmpty}</p>
      ) : (
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {columns.map((col) => (
            <div key={String(col.heading)}>
              <div className="mb-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-500">{col.heading}</div>
              <ul className="space-y-1">
                {col.rows.length === 0 && <li className="py-1 text-sm text-neutral-300 dark:text-neutral-600">—</li>}
                {col.rows.map((r) => (
                  <li key={r.label} className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
                    <span className="min-w-0 truncate text-neutral-600 dark:text-neutral-300">{r.label}</span>
                    <span className="shrink-0 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">{r.visitors.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/**
 * Two column stacks, not four cards dropped into a grid.
 *
 * The grid version is the failure `docs/admin-design.md` already describes for the Settings
 * tabs, reappearing here: a grid lays its children out in ROWS, so "Needs attention" beside a
 * taller Traffic card was stretched to Traffic's height around two lines of text, and the
 * next card could not start until BOTH had finished — which is how "Most viewed" ended up a
 * full-width slab holding one sentence.
 *
 * ⚠️ **Which side a card goes on is a decision, and it has to be RE-MEASURED, not asserted.**
 * This comment used to end "traffic carries a sparkline and is the tall one on its own", and
 * by the time the owner said the page looked uneven that sentence was simply false: measured
 * at 1440px, the left column was 225px against the right's 413px — a 188px hole under Traffic
 * before the next full-width band, and the widest thing on the page was empty. So the left
 * column gets a second card and the numbers are recorded here to be checked against next
 * time: Traffic 225 + Sources ~200 against Needs ~190 + Most viewed 269.
 */
export function DashboardWidgets({ data }: { data: DashboardData }) {
  return (
    <div className={`grid ${CARD_GAP} lg:grid-cols-2`}>
      {/* `min-w-0` on the STACKS, and it is a bug fix rather than a precaution. A grid item's
          automatic minimum size is its content's min-content width, and `truncate` sets
          `white-space: nowrap`, so a "Most viewed" row's min-content is the full untruncated
          headline. The track was therefore sized to 406px inside a 343px grid and the whole
          Overview scrolled sideways on a phone — measured at 375px: `scrollWidth` 422 against
          a 375 viewport, 47px of the page reachable only by dragging it.
          `min-w-0` on the title span was already there and could not help: it lets the FLEX
          item shrink, and the item was shrinking. It is the grid track that would not.
          Same failure the kit records for the analytics table, one level up. */}
      <div className={`min-w-0 ${CARD_STACK}`}>
        <TrafficCard traffic={data.traffic} />
        <SourcesCard sources={data.sources} />
      </div>
      <div className={`min-w-0 ${CARD_STACK}`}>
        <NeedsAttentionCard needs={data.needs} />
        <TopPostsCard posts={data.topPosts} />
      </div>
    </div>
  )
}
