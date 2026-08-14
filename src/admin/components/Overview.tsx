// Quiet, action-first admin home. Detailed analytics, taxonomy and runtime data
// already have dedicated screens; the home only surfaces state that helps the
// owner decide what to do next.
import Link from '@/admin/router'
import type { ActivityEntry } from '@/server/activity'
import { formatBytes, formatDateTimeShort } from '@/utils'
import { buttonClass } from '@/admin/ui/Button'
import { Card, CARD_GAP, PageHeader, SECTION_GAP, StatCard } from './kit'
import { DashboardWidgets, type DashboardData } from './DashboardWidgets'
import { FirstRun } from './FirstRun'
import { useAdminT } from './I18nProvider'
import { REPO } from './help-kit'

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
  system: SystemInfo
  dashboard: DashboardData
}

/**
 * The build, and a way to check it.
 *
 * `2.0.0-dev` has named every deploy since the cutover, so the version alone cannot answer
 * the only question this line is here for: is the running code what was just shipped. The
 * short SHA links to that exact commit on GitHub. Absent when the deploy left no
 * `build-sha` behind, which is a dev machine or somebody else's install.
 */
function BuildLabel({ version, commit }: { version: string; commit: string | null }) {
  return (
    <span className="text-xs text-neutral-400">
      quire<span className="font-bold">INK</span> v{version}
      {commit && (
        <>
          {' · '}
          <a
            href={`${REPO}/commit/${commit}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono underline hover:text-neutral-900 dark:hover:text-white"
          >
            {commit.slice(0, 7)}
          </a>
        </>
      )}
    </span>
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
  const { posts, pages, comments, originals, totalBytes, recent, activityEnabled, version, commit, system, dashboard, firstRunDone } = props
  return (
    <div className={SECTION_GAP}>
      <PageHeader
        title={t.overviewTitle}
        actions={
          <div className="flex items-center gap-3">
            <BuildLabel version={version} commit={commit} />
            <Link href="/admin/editor" className={buttonClass()}>{t.newPost}</Link>
          </div>
        }
      />

      {/* Above the numbers on purpose: on a fresh install every number is zero, and a screen
          of zeroes is the least useful thing a new owner can be shown first. */}
      <FirstRun done={firstRunDone} onDone={markFirstRunDone} />

      <div className={`grid grid-cols-2 ${CARD_GAP} sm:grid-cols-3 lg:grid-cols-5`}>
        <StatCard label={t.statPosts} value={posts} href="/admin/content" />
        <StatCard label={t.statPages} value={pages} href="/admin/content" />
        <StatCard label={t.statComments} value={comments} href="/admin/comments" />
        <StatCard label={t.statMedia} value={originals} href="/admin/media" />
        <StatCard label={t.statStorage} value={formatBytes(totalBytes)} />
      </div>

      <DashboardWidgets data={dashboard} />

      {/* `Card`, not a hand-rolled copy of it. This one was a `<section>` wearing CARD with
          its own header at `mb-4` and 14px against the kit's `mb-5` and 15px, so the three
          panels above it and this one were two different components on one screen. */}
      <Card
        title={t.recentActivity}
        actions={<Link href="/admin/log" className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white">{t.recentViewAll}</Link>}
      >
        {!activityEnabled || recent.length === 0 ? (
          <p className="text-sm text-neutral-400">{t.logEmpty}</p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recent.slice(0, 6).map((entry) => (
              // 180px, not 120px, and the action truncates. An action is a dotted identifier
              // with nothing to wrap on, and the long ones overran the old track and painted
              // on top of the detail beside them — `auth.recovery.regenerated` measured 176px
              // against 120px of column. The grid is on the ROW, so each row sizes its own
              // tracks: a content-sized column would fix the overlap and then stagger the
              // detail edge from row to row. A fixed track keeps the list aligned, and the
              // truncate is the backstop for whatever action name gets added next.
              <li key={entry.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                <span className={`truncate ${entry.action === 'error' ? 'font-medium text-neutral-900 dark:text-white' : 'text-neutral-500'}`}>{entry.action}</span>
                <span className="truncate text-neutral-700 dark:text-neutral-300">{entry.detail}</span>
                <time className="text-xs text-neutral-400">{formatDateTimeShort(entry.at)}</time>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-neutral-400">
        {/* The engine NAME comes from the server. It was the literal string 'PostgreSQL'
            here, left behind by the port, so the dashboard of a SQLite install reported a
            database it does not have. */}
        <span>{system.database} · {system.dbReachable ? 'online' : 'offline'} · {system.storage}</span>
        {system.siteHref && <a href={system.siteHref} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900 dark:hover:text-white">{t.viewSite} ↗</a>}
      </div>
    </div>
  )
}