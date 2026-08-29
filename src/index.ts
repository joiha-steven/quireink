// Boot. Opens the databases, builds the router, listens.
//
// Order matters and is the reason this file is separate from `web/app.ts`: `db()` throws
// if it is called before `openDatabases`, so the failure mode of getting this wrong is a
// clear error at startup rather than a confusing one on the first request.

import { readEnv } from '@/env'
import { getSettings, siteUrlIsUnset, resolveSiteUrl } from '@/content/settings'
import { noUsersYet } from '@/auth/users'
import { setupBanner } from '@/web/setup-routes'
import { openDatabases, closeDatabases } from '@/store/db'
import { ensureBlobStore } from '@/media/blob-local'
import { flushAnalytics, resetAnalyticsBuffer } from '@/analytics/buffer'
import { createApp } from '@/web/app'
import pkg from '../package.json' with { type: 'json' }
import { enableBackgroundCache } from '@/server/warm'
import { startClock, clockBlockedBy } from '@/server/tick'

const env = readEnv()
try {
  openDatabases(env.dataDir)
} catch (error) {
  // The audience for this line is the person the product is for: someone who installed a
  // container and cannot read a stack trace. Say what is wrong and what to check, then
  // exit non-zero so the supervisor's restart/backoff machinery sees a failed boot.
  console.error(`[FATAL] Cannot open the database in ${env.dataDir}: ${(error as Error).message}`)
  console.error('        Check that the data directory exists, is writable by this process,')
  console.error('        and that the disk is not full. If the .db files are corrupt, restore')
  console.error('        a snapshot (docs/backups.md).')
  process.exit(1)
}
// Same reason `openDatabases` creates its directory: a fresh install should come up
// healthy, not report degraded storage until somebody uploads a file.
ensureBlobStore()

const app = createApp()

// `hostname` explicitly, and the log prints what `Bun.serve` came back with rather than a
// literal. Without the option Bun listens on 0.0.0.0 while this line said 127.0.0.1, so the
// one place anybody would look to check was the one place that could not be wrong out loud.
//
// `idleTimeout` is stated for the same reason `hostname` is: the default is 10 SECONDS, it
// is nowhere in this file, and the one route the documentation tells every operator to
// schedule (`/api/cron`, self-host.md section 8) is also the only one that can legitimately
// run longer than that. On 2026-08-25 it did — the tick encoding a backlog of images was cut
// off mid-sweep and answered `curl: (52) Empty reply from server`, which reads like a dead
// process rather than a working one being interrupted. The sweep now bounds itself
// (`VARIANT_BUDGET_MS`), so this is headroom rather than the fix: a backup export or a large
// range request should not be racing a number nobody chose.
const server = Bun.serve({
  hostname: env.host,
  port: env.port,
  idleTimeout: 120,
  fetch: app.fetch,
})
// The REAL version, read from package.json the way the dashboard and the update check
// already read it, rather than the literal `2.0` this line carried from the rewrite through
// every release since. It is the first line of every log this software writes, it is what an
// operator quotes in a bug report, and since 2026-08-25 it sits directly above the setup link
// that the Docker and NAS instructions send people to `docker logs` for — so a wrong number
// there is read as the version they just installed.
console.log(`quire ${(pkg as { version: string }).version} listening on http://${server.hostname}:${server.port}`)

// Say it once, at boot, when nobody has said what this site's address is.
//
// Not a nicety and not a lint: with neither `SITE_URL` nor the admin field set, the sitemap,
// the feed, every OG tag and the newsletter links all go out saying `localhost:3000`, and the
// site works perfectly for a reader while being broken for every crawler and every mail
// client. It cannot be fixed by guessing from the request — `content/settings.ts` has the
// cache-poisoning reason — so the only honest option is to be loud about it.
// Nobody owns this install: print the way in, loudly, and print it EVERY boot.
//
// Not once and stored: the token lives in memory (`server/setup-token.ts`), so a restart
// mints a new one and the old line in the log stops being a secret. Printed before the
// site-address warning below because on a fresh install this is the only thing the operator
// can act on — the address is set from inside, and there is no inside yet.
const bootSettings = await getSettings()
if (noUsersYet()) {
  // The bound socket, not `resolveSiteUrl`: on a fresh install there IS no site address yet,
  // and its fallback is a hardcoded `localhost:3000` that ignores the port in front of it.
  const reachable = siteUrlIsUnset(bootSettings)
    ? `http://${server.hostname}:${server.port}`
    : resolveSiteUrl(bootSettings)
  console.log(setupBanner(reachable))
}

if (siteUrlIsUnset(bootSettings)) {
  console.warn(
    '[WARN] No site address is set. Feeds, the sitemap, OG images and newsletter links will'
    + ' all say http://localhost:3000. Set SITE_URL, or Settings → Search & URLs → Site address.',
  )
}

// Re-fill the page cache after any write, and purge the CDN behind it. Registered HERE
// rather than inside `clearCache()` so that a test suite, a script or an import job gets a
// plain Map.clear() and nothing else.
enableBackgroundCache()

// The clock (ADR 0031). Publishing a post at 09:00 and finalising an image are the blog's
// own business, and a fresh install should do them without an operator remembering a
// crontab. `CRON_INTERNAL=0` hands the job back to an external scheduler; `bun test` and
// `bun --watch` never start it. `/api/cron` keeps working either way.
const stopClock = startClock()
const clockOff = clockBlockedBy()
if (clockOff !== null) console.log(`  clock off (${clockOff}); schedule /api/cron yourself`)

// Analytics buffers in memory (Invariant 7), so a shutdown that skips this loses the
// pageviews recorded since the last flush. Two seconds of them, but there is no reason to.
function shutdown(signal: string): void {
  console.log(`\n${signal}: flushing and closing`)
  try {
    stopClock()
    flushAnalytics()
  } finally {
    resetAnalyticsBuffer()
    closeDatabases()
    process.exit(0)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
