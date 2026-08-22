// The one request this software makes on its own behalf, and everything it does not say.
//
// A blog asks what the newest release is, and by asking it is counted. One call doing two
// jobs, so there is no telemetry service to keep alive and nothing running when nobody is
// reading. What leaves the process is four fields wide:
//
//     GET https://check.quireink.com/releases.json?v=2.1.3&t=8f2c91a04b7e&d=1&new=1
//
//   v    the version this instance runs
//   t    sha256(this instance's own secret + today's UTC date), first 12 hex characters
//   d    1 when the site has a real public address, 0 when it is still on a laptop
//   new  present only on the first check a fresh database ever makes
//
// No address, no hostname, no title, no content, no counts, and no identifier that
// survives the day. `t` is recomputed from a new date every midnight, so today's number is
// exact and yesterday's cannot be linked to it. Counting by IP was the alternative and it
// breaks on the shape this product is licensed for: one process per blog (ADR 0021) means
// a hundred blogs can share one address.
//
// Reported only when `NODE_ENV=production`, which the Docker image sets and `bun run dev`
// and `bun test` do not — a developer's afternoon never becomes an install. The owner has
// a switch in Settings, and an operator running this for other people has `UPDATE_CHECK=0`,
// which turns it off for every instance they start.
//
// `docs/self-host.md` says all of this again in the words of somebody who is deciding
// whether to allow it.

import { createHash } from 'node:crypto'
import { serverSecret } from '@/auth/secret'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { isBlockedAddress } from '@/server/safe-fetch'
import { one, run, tx } from '@/store/query'
import pkg from '../../package.json' with { type: 'json' }

const ENDPOINT = 'https://check.quireink.com/releases.json'
const VERSION = (pkg as { version: string }).version
const DAY_MS = 86_400_000

/** Short. Nothing waits on this call, but a socket held open for a minute is still a
    socket, and the answer is a 121-byte static file or it is nothing. */
const TIMEOUT_MS = 5_000

export type Release = { latest: string; url: string; date: string }

// ----- what the process has already decided today ----------------------------

/**
 * The UTC day this PROCESS has already decided about — decided, not sent. A day on which
 * the owner has the check turned off is decided too, or the settings row would be read
 * from disk on every public request for the sake of a switch that is off.
 *
 * The durable half of the same question lives in the database (`update_check.last_day`),
 * because a restart must not buy the day a second time.
 */
let decidedEpochDay = -1

/**
 * Why this deployment is not reporting, or null when it is.
 *
 * **INVERTED on 2026-08-22, owner's call, and the reason is worth keeping.** The rule was
 * "report only when `NODE_ENV=production`". The Docker image sets that; the systemd unit in
 * `docs/self-host.md` never did — so every from-source install would have been silent
 * FOREVER while looking perfectly healthy, and the number would have counted Docker and
 * nothing else without anything on any screen saying so.
 *
 * So the question is now the honest one: is this clearly NOT a real install? Each answer
 * below was measured on Bun 1.3.14 rather than assumed, because the whole trap was an
 * assumption about what sets `NODE_ENV`:
 *
 *   bun src/index.ts           NODE_ENV unset       execArgv []           <- systemd: REPORTS
 *   bun --watch src/index.ts   NODE_ENV unset       execArgv ['--watch']  <- `bun run dev`: silent
 *   bun test                   NODE_ENV 'test'      execArgv []           <- silent
 *   the Docker image           NODE_ENV 'production'                      <- REPORTS
 *
 * `--watch` is what separates the two cases that share an empty `NODE_ENV`, and it is the
 * flag `bun run dev` is defined with in `package.json`.
 *
 * **There is a second net under this one, and it is why loosening the first is safe.** A
 * developer's machine has no public `SITE_URL`, so anything that slips through arrives as
 * `d=0` and lands on the TRIAL line, which is kept out of "blogs alive" on the receiving
 * end precisely because a trial is deleted and recreated all week.
 *
 * Memoised: none of these can change under a running process.
 *
 * TWO KINDS of answer, named separately, because a screen that gives the wrong one is worse
 * than a screen that gives none. The admin printed `UPDATE_CHECK=0` for every case until a
 * screenshot on 2026-08-22 showed it saying so on an instance that had never set the
 * variable — the real cause was a missing `NODE_ENV`, which is a different fix entirely.
 */
let blocked: string | null | undefined

/** `NODE_ENV` values that mean somebody is working on the software rather than running it. */
const DEV_ENVS = new Set(['test', 'development', 'dev', 'ci'])

/** Bun's own reload flags. Either one means a person is editing the files underneath. */
const WATCH_FLAGS = new Set(['--watch', '--hot'])

function blockedBy(): string | null {
  if (blocked !== undefined) return blocked
  if (process.env.UPDATE_CHECK === '0') return (blocked = 'UPDATE_CHECK=0')
  const env = (process.env.NODE_ENV ?? '').trim().toLowerCase()
  if (DEV_ENVS.has(env)) return (blocked = `NODE_ENV=${env}`)
  const watch = process.execArgv.find((flag) => WATCH_FLAGS.has(flag))
  if (watch !== undefined) return (blocked = watch)
  return (blocked = null)
}

function reportingAllowed(): boolean {
  return blockedBy() === null
}

/** Test seam, and the reason `blocked` may be memoised at all. */
export function resetUpdateCheck(): void {
  blocked = undefined
  decidedEpochDay = -1
}

// ----- the pure parts --------------------------------------------------------

/** `YYYY-MM-DD`, UTC. The receiving end buckets by the timestamp its own log wrote, so
    both ends have to agree on which day a call belongs to, and UTC is the only clock
    neither of them has to be told about. */
export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

/** The identifier, and the whole privacy argument in one line: a new date every midnight
    means an exact count today and no thread back to yesterday. */
export function dailyToken(secret: string, day: string): string {
  return createHash('sha256').update(`${secret}|${day}`).digest('hex').slice(0, 12)
}

/**
 * Minute of the UTC day before which this instance does not check, taken from its own
 * secret so two blogs started by the same script do not share it.
 *
 * Under an hour on purpose. The trigger is a reader arriving rather than a clock, so real
 * traffic already spreads a hundred blogs across the day; what traffic does NOT spread is
 * the rollover — a blog busy enough to have a reader every second would fire at 00:00:00
 * UTC exactly, and so would every other blog like it. An hour breaks that. A wider window
 * would start costing counts instead, and the blogs it dropped would be the ones whose
 * readers all arrive early in the UTC day, dropped silently.
 */
export function spreadMinutes(secret: string): number {
  return parseInt(createHash('sha256').update(secret).digest('hex').slice(0, 8), 16) % 60
}

/**
 * Is this address one a reader could actually reach?
 *
 * `d` separates a blog from a trial, and the receiving end keeps them on separate lines
 * because a trial is deleted and recreated all week: mixed in, it would invent installs
 * that never existed. So the question is deliberately strict — anything this cannot prove
 * is public counts as a trial.
 *
 * `isBlockedUrl` in `safe-fetch.ts` is the wrong tool here despite the overlap: it answers
 * a pre-DNS SSRF question about literal IPs and lets the NAME `localhost` straight through,
 * which is the single most common way this field would be wrong.
 */
export function isPublicAddress(siteUrl: string): boolean {
  let host: string
  try {
    host = new URL(siteUrl).hostname.replace(/^\[|\]$/g, '').toLowerCase()
  } catch {
    return false
  }
  if (!host) return false
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  // Reserved by RFC 6761/8375 and RFC 2606 for exactly the machines that are not on the
  // internet: a NAS on `.local`, a container on `.internal`, a fixture on `.test`.
  if (/\.(local|localdomain|internal|home|lan|test|example|invalid)$/.test(host)) return false
  if (isBlockedAddress(host)) return false
  // A bare name with no dot in it is a hostname on somebody's own network, not a domain.
  return host.includes('.')
}

/** Is `latest` newer than `current`? Three numeric parts, compared as numbers — the
    project's own versioning rule (`docs/conventions/releases.md`) never issues anything
    else, and a string comparison would put 2.1.10 behind 2.1.9. */
export function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map(Number)
  const b = current.split('.').map(Number)
  if (a.length !== 3 || b.length !== 3 || [...a, ...b].some((n) => !Number.isInteger(n))) return false
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! > b[i]!
  }
  return false
}

/** What the answer has to look like before any of it is kept. A static file behind a CDN
    can come back as an error page, a login wall or a captcha, and none of those should end
    up in the admin as a release announcement. */
export function parseRelease(body: unknown): Release | null {
  const o = (body ?? {}) as Partial<Record<keyof Release, unknown>>
  const latest = typeof o.latest === 'string' ? o.latest : ''
  const url = typeof o.url === 'string' ? o.url : ''
  const date = typeof o.date === 'string' ? o.date : ''
  if (!/^\d+\.\d+\.\d+$/.test(latest)) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  // The link is put in front of the owner to click, so where it may point is a decision
  // and not a formality.
  if (!url.startsWith('https://github.com/')) return null
  return { latest, url, date }
}

// ----- the durable half ------------------------------------------------------

type Row = {
  last_day: string | null
  first_done: number
  latest: string | null
  latest_url: string | null
  latest_date: string | null
  checked_at: number | null
}

const readRow = (): Row | null =>
  one<Row>(`select last_day, first_done, latest, latest_url, latest_date, checked_at
              from update_check where id = 1`)

/**
 * Take today, once, or find that somebody already has it.
 *
 * The conditional UPDATE **is** the lock and has to stay one statement. Read-then-write
 * lets two requests arriving in the same millisecond both see yesterday and both send, and
 * a blog with readers would then count itself several times a day — which looks like
 * growth rather than like a bug.
 */
function claimDay(day: string): { claimed: boolean; previous: string | null } {
  return tx(() => {
    run(`insert or ignore into update_check (id) values (1)`)
    const previous = readRow()?.last_day ?? null
    const { changes } = run(
      `update update_check set last_day = $day
        where id = 1 and (last_day is null or last_day <> $day)`,
      { day },
    )
    return { claimed: changes === 1, previous }
  })
}

/** Give the day back, and only if it is still ours to give. */
function releaseDay(day: string, previous: string | null): void {
  run(`update update_check set last_day = $previous where id = 1 and last_day = $day`,
    { previous, day })
}

// ----- the call --------------------------------------------------------------

/**
 * Decide about today, and if the answer is yes, ask. Called from the public request path
 * and returns immediately: the work is started, never awaited, and a reader waits on none
 * of it (`web/update-ping.ts`).
 */
export function maybeRunUpdateCheck(now: number = Date.now()): void {
  if (!reportingAllowed()) return
  const epochDay = Math.floor(now / DAY_MS)
  if (decidedEpochDay === epochDay) return
  // Memoised after the first hit, so this is a Map lookup on the request path.
  const secret = serverSecret('update-check')
  if (Math.floor((now % DAY_MS) / 60_000) < spreadMinutes(secret)) return
  decidedEpochDay = epochDay
  void runUpdateCheck(secret, now)
}

/**
 * Exported for the tests, which is the only way to observe a call that is deliberately
 * unobservable in production: it is never awaited and it never throws.
 */
export async function runUpdateCheck(secret: string, now: number): Promise<void> {
  try {
    const settings = await getSettings()
    if (!settings.updateCheck) return

    const day = dayKey(now)
    const { claimed, previous } = claimDay(day)
    if (!claimed) return

    const url = new URL(ENDPOINT)
    url.searchParams.set('v', VERSION)
    url.searchParams.set('t', dailyToken(secret, day))
    url.searchParams.set('d', isPublicAddress(resolveSiteUrl(settings)) ? '1' : '0')
    if ((readRow()?.first_done ?? 0) === 0) url.searchParams.set('new', '1')

    let res: Response
    try {
      res = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      // Nothing arrived, so nothing was counted and the day is not spent: a restart may
      // try again. Silent on purpose, and this is the line most likely to be "tidied" into
      // a `console.error` by somebody being helpful — a blog whose network does not allow
      // outbound requests is not a blog with a problem, and a daily error in its log would
      // tell its owner that it was.
      releaseDay(day, previous)
      return
    }

    // It arrived. The receiving end is an nginx log line written before the response, so
    // `new=1` has been counted whatever the status turns out to be and whatever the body
    // says. Recorded HERE, ahead of reading that body, because a malformed answer would
    // otherwise send `new=1` again tomorrow and land one install in the numbers as two.
    run(`update update_check set first_done = 1 where id = 1`)

    if (!res.ok) return
    const release = parseRelease(await res.json().catch(() => null))
    if (!release) return
    run(
      `update update_check
          set latest = $latest, latest_url = $url, latest_date = $date, checked_at = $at
        where id = 1`,
      { latest: release.latest, url: release.url, date: release.date, at: now },
    )
  } catch {
    // Never throws. Nothing on a reader's request path may fail because of a number
    // nobody is waiting for.
  }
}

/**
 * The three answers the admin can honestly give about this install's version, and the fact
 * that there are THREE is the whole point.
 *
 * `unknown` is not a rounding of `current`. "You are up to date" is a claim, and it can only
 * be made from an answer this instance actually received and received RECENTLY. A blog whose
 * check is off, or which has never reached the internet, or which has had no readers for a
 * fortnight, knows nothing — and a green dot on that is worse than no dot at all, because it
 * is the one state a person acts on by doing nothing.
 *
 * Hence the staleness window. A release can happen in a week; an answer from before it
 * cannot rule that out.
 */
export type UpdateState =
  | { state: 'behind'; release: Release }
  | { state: 'current' }
  | { state: 'unknown' }

const STALE_MS = 7 * DAY_MS

export function updateState(now: number = Date.now()): UpdateState {
  const row = readRow()
  if (!row?.latest || !row.latest_url || !row.latest_date || !row.checked_at) return { state: 'unknown' }
  if (now - row.checked_at > STALE_MS) return { state: 'unknown' }
  if (isNewer(row.latest, VERSION)) {
    return { state: 'behind', release: { latest: row.latest, url: row.latest_url, date: row.latest_date } }
  }
  return { state: 'current' }
}

/**
 * What the admin needs to draw the Updates card: whether this deployment permits the check
 * at all, and what it currently knows about the version.
 *
 * `blockedBy` is separate from the owner's switch on purpose, and it names WHICH deployment
 * rule is in the way. An operator running blogs for other people sets `UPDATE_CHECK=0` and
 * the switch in Settings then has no effect; a process started with `--watch` is silent for
 * an unrelated reason and needs an unrelated fix. Either way the screen says so, rather than
 * showing an ON switch beside a check that never runs.
 */
export function updateCheckStatus(now: number = Date.now()): {
  blockedBy: string | null
  update: UpdateState
} {
  return { blockedBy: blockedBy(), update: updateState(now) }
}
