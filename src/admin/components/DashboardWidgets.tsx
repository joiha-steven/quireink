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
  needs: { drafts: number }
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
  const items = [{ label: t.dashDrafts, count: needs.drafts, href: '/admin/content' }]
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

/**
 * Two column stacks, not three cards dropped into a grid.
 *
 * The grid version is the failure `docs/admin-design.md` already describes for the Settings
 * tabs, reappearing here: a grid lays its children out in ROWS, so "Needs attention" beside a
 * taller Traffic card was stretched to Traffic's height around two lines of text, and the
 * next card could not start until BOTH had finished — which is how "Most viewed" ended up a
 * full-width slab holding one sentence.
 *
 * Each stack packs independently, so a short card is short and the card under it comes up to
 * meet it. Which side a card goes on is a decision, made so the two columns come out close in
 * height: traffic carries a sparkline and is the tall one on its own.
 */
export function DashboardWidgets({ data }: { data: DashboardData }) {
  return (
    <div className={`grid ${CARD_GAP} lg:grid-cols-2`}>
      <div className={CARD_STACK}>
        <TrafficCard traffic={data.traffic} />
      </div>
      <div className={CARD_STACK}>
        <NeedsAttentionCard needs={data.needs} />
        <TopPostsCard posts={data.topPosts} />
      </div>
    </div>
  )
}
