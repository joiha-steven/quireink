// Quiet, action-first admin home. Detailed analytics, taxonomy and runtime data
// already have dedicated screens; the home only surfaces state that helps the
// owner decide what to do next.
import Link from '@/admin/router'
import type { UpdateState } from '@/server/update-check'
import type { ActivityEntry } from '@/server/activity'
import { formatBytes, formatDateTimeShort } from '@/utils'
import { buttonClass } from '@/admin/ui/Button'
import { Card, PageHeader, SECTION_GAP } from './kit'
import { StatBand, StatCard } from './stat-band'
import { DashboardWidgets, type DashboardData } from './DashboardWidgets'
import { FirstRun } from './FirstRun'
import { PickUpBand } from './PickUpBand'
import { useAdminT } from './I18nProvider'
import { REPO } from './help-kit'
import { META_ON_CANVAS } from './scale'

// ⚠️ `Taxo`, `SeoHealth` and `TrafficSources` were declared here and threaded through Props
// for six values this component never read. The two that were worth showing are now inside
// `DashboardData`, where the widgets that render them live; the other four are gone, and so
// is the `tally()` walk over every post that produced two of them.
export type SystemInfo = {
  hosting: string
  site: string
  siteHref?: string
  env: string
  database: string
  dbReachable: boolean
  storage: string
  runtime: string
  framework: string
  mcpEnabled: boolean
  backupOn: boolean
  backupLastRun?: string | null
}

type Props = {
  posts: number
  pages: number
  comments: number
  originals: number
  totalBytes: number
  recent: ActivityEntry[]
  activityEnabled: boolean
  firstRunDone: boolean
  version: string
  commit: string | null
  update: UpdateState
  system: SystemInfo
  dashboard: DashboardData
}

/**
 * The build, and a way to check it.
 *
 * `2.0.0-dev` has named every deploy since the cutover, so the version alone cannot answer
 * the only question this line is here for: is the running code what was just shipped. The
 * short SHA answers it. Absent when the deploy left no `build-sha` behind, which is a dev
 * machine or somebody else's install.
 *
 * ⚠️ The link goes to the PROJECT, not to the commit — the owner's instruction on 2026-08-15:
 * *"mã commit (link tới dự án, ko phải link tới commit)"*. The SHA is here to be READ (does
 * this match what I just shipped), and the link is a different job: getting to the repository.
 * A per-commit URL served neither well — it is a page nobody wants from a dashboard, and it
 * 404s the moment a SHA is stale or the deploy shipped from a branch that was later rebased.
 */
/**
 * The version's own traffic light: amber when a newer release exists, green when this
 * install is on the newest one, and NOTHING when the answer is not known.
 *
 * ⚠️ **This is the first colour in the admin outside the highlighter**, and
 * `docs/admin-design.md` says status stays on the neutral scale. Owner's call on
 * 2026-08-22, asked for in those words ("chấm cam" / "chấm xanh"), and the exception is
 * written into that document rather than left as a surprise for whoever reads the rule next.
 *
 * The three states are the point, and the third is not decoration. "Up to date" is a CLAIM,
 * and it can only be made from an answer this instance received recently — a blog whose
 * check is off, or that has never reached the internet, or that has had no readers for a
 * fortnight, knows nothing. Green on that is the worst of the three, because it is the one
 * state a person acts on by doing nothing. So it draws no dot at all.
 */
function VersionDot({ update }: { update: UpdateState }) {
  const t = useAdminT()
  if (update.state === 'unknown') return null
  const behind = update.state === 'behind'
  return (
    <span
      aria-hidden
      title={behind ? t.updateAvailable.replace('{v}', update.release.latest) : t.updateCurrent}
      className={`mr-1.5 inline-block h-[6px] w-[6px] rounded-full align-middle ${
        behind ? 'bg-amber-500' : 'bg-emerald-500'}`}
    />
  )
}

function BuildLabel({ version, commit, update }: {
  version: string; commit: string | null; update: UpdateState
}) {
  const behind = update.state === 'behind'
  return (
    // `hidden sm:inline`, because on a phone this line is not small print, it is a THIRD
    // thing in the title row: measured at 390px it sat between "Overview" and New post and
    // took the width off both. It answers "is the running code what was just shipped", which
    // is a question asked at a desk. It still does not belong beside the page title at all —
    // `docs/admin-design.md` says system information does not compete on the home page — but
    // its real home is Settings → System, and moving it there is plumbing, not a class.
    <a
      href={REPO}
      target="_blank"
      rel="noopener noreferrer"
      // Desktop-only at rest, for the reason above — but an update is not small print, so
      // a behind install shows the line on a phone too. The Updates card in Settings carries
      // the same fact with the release link, which is where somebody acts on it.
      className={`${META_ON_CANVAS} hover:text-neutral-900 dark:hover:text-white ${
        behind ? 'inline' : 'hidden sm:inline'}`}
    >
      <VersionDot update={update} />
      quire<span className="font-bold">INK</span> v{version}
      {commit && <span className="tabular-nums"> ({commit.slice(0, 7)})</span>}
    </a>
  )
}

export function Overview(props: Props) {
  const t = useAdminT()
  // One field, merged server-side like every other settings PUT. Fire-and-forget: failing to
  // record a dismissal is not worth a toast, and the steps simply come back next time.
  const markFirstRunDone = () => {
    void fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstRunDone: true }),
    }).catch(() => undefined)
  }
  const { posts, pages, comments, originals, totalBytes, recent, activityEnabled, version, commit, update, system, dashboard, firstRunDone } = props
  return (
    <div className={SECTION_GAP}>
      <PageHeader
        title={t.overviewTitle}
        actions={
          <div className="flex items-center gap-3">
            <BuildLabel version={version} commit={commit} update={update} />
            <Link href="/admin/editor" className={buttonClass()}>{t.newPost}</Link>
          </div>
        }
      />

      {/* Above the numbers on purpose: on a fresh install every number is zero, and a screen
          of zeroes is the least useful thing a new owner can be shown first. */}
      <FirstRun done={firstRunDone} onDone={markFirstRunDone} />

      {/* ADR 0024 step 6. The unfinished writing first, then how the finished writing did,
          and the administration counts last — they used to lead the page. */}
      <PickUpBand items={dashboard.pickUp.items} total={dashboard.pickUp.total} />

      <DashboardWidgets data={dashboard} />

      {/* Below the widgets since 2026-08-17, and it is the ADR's ordering rather than a taste:
          posts · pages · comments · images · storage is inventory, and inventory is what the
          rebuild moves out of the way of the writing. They stay because each one is also the
          shortest route to its screen — two of which (comments, library) the rail no longer
          shows at rest. */}
      <StatBand>
        <StatCard bare label={t.statPosts} value={posts} href="/admin/content" />
        <StatCard bare label={t.statPages} value={pages} href="/admin/content" />
        <StatCard bare label={t.statComments} value={comments} href="/admin/comments" />
        <StatCard bare label={t.statMedia} value={originals} href="/admin/media" />
        <StatCard bare label={t.statStorage} value={formatBytes(totalBytes)} />
      </StatBand>

      {/* `Card`, not a hand-rolled copy of it. This one was a `<section>` wearing CARD with
          its own header at `mb-4` and 14px against the kit's `mb-5` and 15px, so the three
          panels above it and this one were two different components on one screen. */}
      <Card
        title={t.recentActivity}
        actions={<Link href="/admin/log" className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">{t.recentViewAll}</Link>}
      >
        {!activityEnabled || recent.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.logEmpty}</p>
        ) : (
          // TWO COLUMNS on a wide screen, and it is the emptiness that forces it rather than a
          // wish for density. Measured at 1440px: the action track is 180px (honest — the
          // longest action, `auth.recovery.regenerated`, measures 172), the timestamp 85, and
          // the detail column got the remaining 805px to hold strings like
          // `registration-target.png` at ~150. Six rows each carrying ~300px of content across
          // a 1400px band is a card that is three-quarters air, which is what the owner meant
          // by "trống trải quá mức" on 2026-08-15. Halving the width halves the hole, and it
          // fills a band that was the last thing on the page.
          <ul className="grid divide-y divide-neutral-100 xl:grid-cols-2 xl:gap-x-10 dark:divide-neutral-800 [&>li]:border-neutral-100 dark:[&>li]:border-neutral-800 xl:divide-y-0 xl:[&>li]:border-b xl:[&>li:nth-last-child(-n+2)]:border-b-0">
            {recent.slice(0, 6).map((entry) => (
              // 180px, not 120px, and the action truncates. An action is a dotted identifier
              // with nothing to wrap on, and the long ones overran the old track and painted
              // on top of the detail beside them — `auth.recovery.regenerated` measured 176px
              // against 120px of column. The grid is on the ROW, so each row sizes its own
              // tracks: a content-sized column would fix the overlap and then stagger the
              // detail edge from row to row. A fixed track keeps the list aligned, and the
              // truncate is the backstop for whatever action name gets added next.
              <li key={entry.id} className="grid gap-x-4 gap-y-1 py-2.5 text-sm sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]">
                <span className={`truncate ${entry.action === 'error' ? 'font-medium text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'}`}>{entry.action}</span>
                <span className="truncate text-neutral-700 dark:text-neutral-300">{entry.detail}</span>
                <time className="text-xs text-neutral-500 dark:text-neutral-400">{formatDateTimeShort(entry.at)}</time>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className={`flex flex-wrap items-center justify-between gap-3 px-1 ${META_ON_CANVAS}`}>
        {/* The engine NAME comes from the server. It was the literal string 'PostgreSQL'
            here, left behind by the port, so the dashboard of a SQLite install reported a
            database it does not have. */}
        <span>{system.database} · {system.dbReachable ? 'online' : 'offline'} · {system.storage}</span>
        {system.siteHref && <a href={system.siteHref} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900 dark:hover:text-white">{t.viewSite} ↗</a>}
      </div>
    </div>
  )
}