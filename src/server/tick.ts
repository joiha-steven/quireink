// What a maintenance tick DOES, and the clock that runs it.
//
// Split out of `web/admin/ops.ts` on 2026-08-27 with [ADR 0031], which made the process
// schedule itself. The body had to move first: two callers writing out the same eight steps
// is two descriptions of one job, and they drift within a release. The route is now a
// bearer check, a rate limit and one call.
//
// [ADR 0031]: ../../docs/decisions/0031-the-blog-winds-its-own-clock.md

import { one } from '@/store/query'
import { finalizePendingThumbs, finalizePendingVariants } from '@/media/finalize'
import { purgeExpiredSessions } from '@/auth/sessions'
import { sweepPendingSubscribers } from '@/news/subscribers'
import { pruneRendered } from '@/render/render-cache'
import { sweepScheduled, PUBLISH_TICK_LOOKBACK_MS, HOURLY_LOOKBACK_MS } from '@/server/scheduled'
import { maybeRunBackup } from '@/server/backup'
import { purgeEdge } from '@/server/edge-cache'
import { clearCache } from '@/server/cache'

export type FullTick = {
  purged: boolean
  finalized: number
  thumbs: number
  published: number
  sessions: number
  staleSignups: number
  renderRows: number
  backup: { ran: boolean; name?: string; error?: string }
}

/**
 * The frequent tick: flip due scheduled posts live, and nothing else.
 *
 * Its lookback matches its cadence. One indexed query when there is nothing due, which is
 * why it can afford to run every minute on a clock the operator did not have to configure.
 */
export async function publishTick(): Promise<number> {
  // The cheapest possible read, which doubles as a liveness probe for whoever called this
  // over HTTP.
  one<{ id: number }>(`select id from settings limit 1`)
  const published = await sweepScheduled(PUBLISH_TICK_LOOKBACK_MS)
  if (published > 0) clearCache()
  return published
}

/**
 * The hourly tick: everything else, each step isolated.
 *
 * A finalize failure must not skip the publish sweep, and neither must skip the session
 * purge. That isolation is why these are not one try block.
 */
export async function fullTick(opts: { purge?: boolean } = {}): Promise<FullTick> {
  one<{ id: number }>(`select id from settings limit 1`)

  // Deploy hook. A code deploy runs no admin write, so nothing would otherwise flush the
  // edge; the caller asks for this explicitly. The origin cache is a Map and empties free.
  const purged = opts.purge === true
  if (purged) {
    clearCache()
    await purgeEdge().catch(() => { /* the edge is best-effort */ })
  }

  let finalized = 0
  let thumbs = 0
  try {
    finalized = await finalizePendingVariants()
    thumbs = await finalizePendingThumbs()
  } catch (error) {
    console.error(`[ERROR] tick finalize: ${(error as Error).message}`)
  }
  // A finalised straggler changes rendered output (a plain <img> becomes a <picture>), and
  // the pages embedding it were cached without those sources.
  if (finalized > 0) clearCache()

  let published = 0
  try {
    published = await sweepScheduled(HOURLY_LOOKBACK_MS)
    if (published > 0) clearCache()
  } catch (error) {
    console.error(`[ERROR] tick publish sweep: ${(error as Error).message}`)
  }

  // Sessions expire but their rows do not remove themselves, and the request path
  // deliberately only deletes the one it has in hand.
  let sessions = 0
  try {
    sessions = purgeExpiredSessions()
  } catch (error) {
    console.error(`[ERROR] tick session purge: ${(error as Error).message}`)
  }

  // Pending sign-ups that never confirmed. Same standing as the session purge: rows that
  // expire but do not remove themselves, swept here because nothing on the request path
  // should ever pay for it.
  let staleSignups = 0
  try {
    staleSignups = await sweepPendingSubscribers()
  } catch (error) {
    console.error(`[ERROR] tick subscriber sweep: ${(error as Error).message}`)
  }

  // The render cache is insert-only for the same reason it needs no invalidation, so this
  // is the only thing that ever removes a row from it. Bounded per tick, and it swallows
  // its own failures.
  const renderRows = pruneRendered()

  // Last, and isolated like the rest: a snapshot is the slowest thing in the tick (it reads
  // both databases and the whole uploads tree), and nothing above it should wait on that or
  // be skipped by its failure.
  let backup: FullTick['backup'] = { ran: false }
  try {
    backup = await maybeRunBackup()
  } catch (error) {
    backup = { ran: false, error: (error as Error).message }
    console.error(`[ERROR] tick backup: ${(error as Error).message}`)
  }

  return { purged, finalized, thumbs, published, sessions, staleSignups, renderRows, backup }
}

// ----- the clock ------------------------------------------------------------------------

/** Every minute. The documented crontab said five; a timer that costs one query can afford
 *  better, and "published within the minute" is what a person means by "at 09:00". */
const PUBLISH_EVERY_MS = 60_000

/** Hourly, matching the crontab this replaces. */
const FULL_EVERY_MS = 60 * 60_000

/**
 * Two minutes, and not zero.
 *
 * A process that crash-loops would otherwise run a backup and a sharp sweep on every boot,
 * which is the worst possible response to a machine already in trouble. Two minutes is long
 * enough that a loop never reaches it and short enough that a normal restart loses nothing.
 */
const FIRST_FULL_DELAY_MS = 2 * 60_000

/** `NODE_ENV` values that mean somebody is working on the software rather than running it. */
const DEV_ENVS = new Set(['test', 'development', 'dev', 'ci'])

/** Bun's own reload flags. Either one means a person is editing the files underneath. */
const WATCH_FLAGS = new Set(['--watch', '--hot'])

/**
 * Why the clock is not running, or `null` when it is.
 *
 * The same three questions the update check asks, for the same reason: a background timer
 * inside `bun test` fails a different test later with no visible cause, and one inside
 * `bun --watch` runs a backup every time a file is saved.
 */
export function clockBlockedBy(source: NodeJS.ProcessEnv = process.env): string | null {
  if (source.CRON_INTERNAL === '0') return 'CRON_INTERNAL=0'
  const env = (source.NODE_ENV ?? '').trim().toLowerCase()
  if (DEV_ENVS.has(env)) return `NODE_ENV=${env}`
  const watch = process.execArgv.find((flag) => WATCH_FLAGS.has(flag))
  if (watch !== undefined) return watch
  return null
}

/**
 * Start the internal clock. Returns a function that stops it.
 *
 * Both timers are `unref`'d: they must never be the reason the process stays alive, and a
 * shutdown mid-tick loses nothing that is not idempotent on the next one.
 */
export function startClock(): () => void {
  const blocked = clockBlockedBy()
  if (blocked !== null) return () => { /* never started */ }

  const publish = setInterval(() => {
    void publishTick().catch((error: unknown) => {
      console.error(`[ERROR] clock publish: ${(error as Error).message}`)
    })
  }, PUBLISH_EVERY_MS)

  let full: ReturnType<typeof setInterval> | undefined
  // ONE line, on the first sweep only, and it exists because of what the log could not say.
  // A stopped clock and a running one looked identical from outside: the only evidence was
  // the ABSENCE of the "clock off" line at boot, which proves the timer was created and
  // nothing about whether it ever fired. An operator asking "is this thing sweeping?" now
  // has an answer that is not an inference. Every sweep after it stays silent, because a
  // line an hour for years is how a log stops being read.
  let announced = false
  const first = setTimeout(() => {
    const run = () => {
      void fullTick().then((result) => {
        if (announced) return
        announced = true
        console.log(
          `clock: first sweep done (published ${result.published}, variants ${result.finalized},`
          + ` sessions ${result.sessions}, cached rows ${result.renderRows})`,
        )
      }).catch((error: unknown) => {
        console.error(`[ERROR] clock full: ${(error as Error).message}`)
      })
    }
    run()
    full = setInterval(run, FULL_EVERY_MS)
    full.unref?.()
  }, FIRST_FULL_DELAY_MS)

  publish.unref?.()
  first.unref?.()

  return () => {
    clearInterval(publish)
    clearTimeout(first)
    if (full !== undefined) clearInterval(full)
  }
}
