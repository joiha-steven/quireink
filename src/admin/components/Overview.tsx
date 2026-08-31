// Quiet, action-first admin home. Detailed analytics, taxonomy and runtime data
// already have dedicated screens; the home only surfaces state that helps the
// owner decide what to do next.
import Link from '@/admin/router'
import type { UpdateState } from '@/server/update-check'
import type { ActivityEntry } from '@/server/activity'
import { formatBytes } from '@/utils'
import { buttonClass } from '@/admin/ui/Button'
import { Card, SECTION_GAP } from './kit'
import { StatBand, StatCard } from './stat-band'
import { DashboardWidgets, type DashboardData } from './DashboardWidgets'
import { FirstRun } from './FirstRun'
import { Greeting, type GreetingAuthor } from './Greeting'
import { PickUpBand } from './PickUpBand'
import { ActivityFeed } from './ActivityFeed'
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
  /** The engine's own version, empty if it could not be asked. */
  databaseVersion: string
  /** `Linux 6.8 · x64`. */
  os: string
  /** When this PROCESS started, ISO — a duration frozen at render time is wrong by however
      long the tab has been open, and this screen is one people leave open. */
  startedAt: string
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
  author: GreetingAuthor
  lastPublishedAt: string | null
  version: string
  commit: string | null
  update: UpdateState
  system: SystemInfo
  dashboard: DashboardData
}

/**
 * The build, and a way to check it. `2.0.0-dev` has named every deploy since the cutover, so
 * the version alone cannot answer the only question this line exists for: is the running code
 * what was just shipped. The short SHA answers it, and is absent when the deploy left no
 * `build-sha` — a dev machine, or somebody else's install.
 *
 * ⚠️ The link goes to the PROJECT, not the commit (owner's instruction, 2026-08-15). The SHA
 * is here to be READ; the link is a different job. A per-commit URL served neither, and 404s
 * the moment a SHA is stale or the deploy shipped from a branch later rebased.
 */
/**
 * The version's own traffic light: amber when a newer release exists, green when this install
 * is on the newest, and NOTHING when the answer is not known.
 *
 * ⚠️ The first colour in the admin outside the highlighter, against `admin-design.md`'s rule
 * that status stays neutral. Owner's call 2026-08-22, and the exception is written into that
 * document rather than left as a surprise.
 *
 * The third state is the point, not decoration. "Up to date" is a CLAIM, makeable only from an
 * answer received recently — a blog whose check is off, or that has never reached the internet,
 * knows nothing. Green on that is the worst of the three, because it is the one state a person
 * acts on by doing nothing. So it draws no dot.
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

/**
 * How long this process has been up, in the largest unit that still says something.
 *
 * NOT the greeting's `relative()`, which collapses anything from today down to "today" — right
 * for a publication date and useless for a restart, where four minutes and nineteen hours are
 * the difference between "it just came back" and "it has been fine all day". `Intl` supplies
 * the words, so eleven languages get their own plural rules without a table here.
 */
function sinceStart(startedAt: string, now: Date): string {
  const started = Date.parse(startedAt)
  if (Number.isNaN(started)) return ''
  const minutes = Math.round((started - now.getTime()) / 60_000)
  const lang = typeof document !== 'undefined' ? document.documentElement.lang || 'en' : 'en'
  try {
    const fmt = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
    if (Math.abs(minutes) < 60) return fmt.format(Math.min(minutes, -1), 'minute')
    if (Math.abs(minutes) < 60 * 48) return fmt.format(Math.round(minutes / 60), 'hour')
    return fmt.format(Math.round(minutes / 1440), 'day')
  } catch {
    return ''
  }
}

function BuildLabel({ version, commit, update }: {
  version: string; commit: string | null; update: UpdateState
}) {
  const behind = update.state === 'behind'
  const t = useAdminT()
  // WHERE IT POINTS is the difference between a version number and something to act on.
  // Behind: the release that is out. Current: the notes for the version actually running —
  // "what am I running" is the question the number raises and the tag page is its answer.
  // Unknown: the release list, because claiming either state would be a guess.
  const href =
    update.state === 'behind' ? update.release.url
    : update.state === 'current' ? `${REPO}/releases/tag/v${version}`
    : `${REPO}/releases`
  const said =
    update.state === 'behind' ? t.updateAvailable.replace('{v}', update.release.latest)
    : update.state === 'current' ? t.updateCurrent
    : null
  return (
    // `hidden sm:inline`, because on a phone this line is not small print, it is a THIRD
    // thing in the title row: measured at 390px it sat between "Overview" and New post and
    // took the width off both. It answers "is the running code what was just shipped", which
    // is a question asked at a desk. It still does not belong beside the page title at all —
    // `docs/admin-design.md` says system information does not compete on the home page — but
    // its real home is Settings → System, and moving it there is plumbing, not a class.
    <a
      href={href}
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
      {/* The DOT alone said this, and only to somebody who knew that amber meant behind and
          green meant current — a colour is a reminder, not a sentence. The words are the
          ones the Updates card already uses in all eleven languages, so the two screens
          cannot come to disagree about what the same state is called. */}
      {said && <span className="ml-1.5">· {said}</span>}
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
  const { posts, pages, comments, originals, totalBytes, recent, activityEnabled, version, commit, update, system, dashboard, firstRunDone, author, lastPublishedAt } = props
  return (
    <div className={SECTION_GAP}>
      {/* The greeting REPLACES the page title, it does not sit above one. "Overview" was a
          category name over six blocks of numbers about strangers; the row that says whose
          desk this is has to be the first row, or it is decoration on someone else's page. */}
      <Greeting
        author={author}
        lastPublishedAt={lastPublishedAt}
        actions={
          <>
            <BuildLabel version={version} commit={commit} update={update} />
            <Link href="/admin/editor" className={buttonClass()}>{t.newPost}</Link>
          </>
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
          <ActivityFeed entries={recent} />
        )}
      </Card>

      <div className={`flex flex-wrap items-center justify-between gap-3 px-1 ${META_ON_CANVAS}`}>
        {/* WHAT IS ACTUALLY RUNNING. This line read "SQLite · online · Local filesystem":
            three facts that are identical on every install of this program, so it answered a
            question nobody asks and not the one they do — what am I running, and is it what I
            think it is. Versions and the machine, plus how long this process has been up.
            `dbReachable` survives as the one that can be FALSE, and it is only printed then:
            "online" beside a working database is noise, "offline" beside a broken one is the
            most important word on the screen. */}
        <span>
          {[system.runtime,
            system.databaseVersion ? `SQLite ${system.databaseVersion}` : system.database,
            system.os,
            `${t.sysStartedPrefix} ${sinceStart(system.startedAt, new Date())}`,
          ].filter(Boolean).join(' · ')}
          {!system.dbReachable && <span className="ml-1.5 font-medium text-[var(--pen-red)]">· offline</span>}
        </span>
        {system.siteHref && <a href={system.siteHref} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900 dark:hover:text-white">{t.viewSite} ↗</a>}
      </div>
    </div>
  )
}