// Boot. Opens the databases, builds the router, listens.
//
// Order matters and is the reason this file is separate from `web/app.ts`: `db()` throws
// if it is called before `openDatabases`, so the failure mode of getting this wrong is a
// clear error at startup rather than a confusing one on the first request.

import { readEnv } from '@/env'
import { getSettings, siteUrlIsUnset } from '@/content/settings'
import { openDatabases, closeDatabases } from '@/store/db'
import { ensureBlobStore } from '@/media/blob-local'
import { flushAnalytics, resetAnalyticsBuffer } from '@/analytics/buffer'
import { createApp } from '@/web/app'
import { enableBackgroundCache } from '@/server/warm'

const env = readEnv()
openDatabases(env.dataDir)
// Same reason `openDatabases` creates its directory: a fresh install should come up
// healthy, not report degraded storage until somebody uploads a file.
ensureBlobStore()

const app = createApp()

// `hostname` explicitly, and the log prints what `Bun.serve` came back with rather than a
// literal. Without the option Bun listens on 0.0.0.0 while this line said 127.0.0.1, so the
// one place anybody would look to check was the one place that could not be wrong out loud.
const server = Bun.serve({ hostname: env.host, port: env.port, fetch: app.fetch })
console.log(`quire 2.0 listening on http://${server.hostname}:${server.port}`)

// Say it once, at boot, when nobody has said what this site's address is.
//
// Not a nicety and not a lint: with neither `SITE_URL` nor the admin field set, the sitemap,
// the feed, every OG tag and the newsletter links all go out saying `localhost:3000`, and the
// site works perfectly for a reader while being broken for every crawler and every mail
// client. It cannot be fixed by guessing from the request — `content/settings.ts` has the
// cache-poisoning reason — so the only honest option is to be loud about it.
if (siteUrlIsUnset(await getSettings())) {
  console.warn(
    '[WARN] No site address is set. Feeds, the sitemap, OG images and newsletter links will'
    + ' all say http://localhost:3000. Set SITE_URL, or Settings → Search & URLs → Site address.',
  )
}

// Re-fill the page cache after any write, and purge the CDN behind it. Registered HERE
// rather than inside `clearCache()` so that a test suite, a script or an import job gets a
// plain Map.clear() and nothing else.
enableBackgroundCache()

// Analytics buffers in memory (Invariant 7), so a shutdown that skips this loses the
// pageviews recorded since the last flush. Two seconds of them, but there is no reason to.
function shutdown(signal: string): void {
  console.log(`\n${signal}: flushing and closing`)
  try {
    flushAnalytics()
  } finally {
    resetAnalyticsBuffer()
    closeDatabases()
    process.exit(0)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
