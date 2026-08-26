// Maintenance and operations: the cron tick, the health probe, the draft preview link,
// and the WordPress import.
//
// Two of these are PUBLIC by necessity and are listed in `scripts/checks/routes-guarded.ts`
// with their reasons — `/api/cron` is called by an external scheduler that has no session,
// and `/api/health` is called by a reverse proxy that has no session either.

import { timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import { one } from '@/store/query'
import { savePost } from '@/content/posts'
import { savePage } from '@/content/pages'
import { SlugConflictError } from '@/content/slugs'
import { previewToken } from '@/content/preview'
import { publishTick, fullTick } from '@/server/tick'
// Still here for the importers below, which empty the page cache after a bulk insert.
import { clearCache } from '@/server/cache'
import { clientIp, rateLimited } from '@/server/rate-limit'
import { logActivity } from '@/server/activity'
import { fail, json } from '@/web/api'
import { ownerRouter } from '@/web/guard'

/** WXR is text. Anything larger than this is not an export, it is a mistake or an attack. */
const MAX_IMPORT_BYTES = 100 * 1024 * 1024

/** Per-IP cap on the cron tick. See the comment at the route for why it needs one. */
const CRON_PER_MINUTE = 12

/**
 * Constant-time bearer comparison.
 *
 * A plain `===` returns as soon as two bytes differ, so an attacker can recover the secret
 * one character at a time by measuring how long the rejection takes.
 */
function bearerOk(header: string | null, secret: string): boolean {
  const given = Buffer.from(header ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  // `timingSafeEqual` THROWS on a length mismatch, so the length has to be checked first —
  // which does leak the length. That is not a useful leak: the length is fixed by the
  // format, and the alternative is an exception on every wrong-length request.
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * Save under `base`, appending `-2`, `-3`… until the slug is free.
 *
 * Posts and pages share one namespace (Invariant 2), so a collision here can be with
 * either. Nothing is ever overwritten: an import ADDS.
 */
async function saveUnique(base: string, save: (slug: string) => Promise<unknown>): Promise<string> {
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    try {
      await save(slug)
      return slug
    } catch (error) {
      if (error instanceof SlugConflictError) continue
      throw error
    }
  }
  throw new Error(`could not find a free slug for "${base}"`)
}

/** The owner-gated half. */
export function opsRoutes() {
  const router = ownerRouter()

  // The client builds `${origin}/preview/${slug}?key=${token}` from this.
  router.get('/api/preview-link', async (c) => {
    const slug = c.req.query('slug')
    if (!slug) return fail(c, 'Missing slug', 400)
    return json({ token: previewToken(slug) })
  })

  router.post('/api/import/wordpress', async (c) => {
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return fail(c, 'no_file', 400)
    if (file.size > MAX_IMPORT_BYTES) return fail(c, 'file_too_large', 413)

    const xml = await file.text()
    // A cheap shape check before parsing 100 MB. The message is specific because "import
    // failed" on the wrong file is the least useful thing to tell someone.
    if (!xml.includes('<rss') || !xml.includes('wp:post_type')) {
      return fail(c, 'not_a_wordpress_export', 400)
    }

    // Loaded here rather than at the top of the file: the parser pulls turndown, its GFM
    // plugin and fast-xml-parser, none of which any other route touches. A blog that never
    // came from WordPress — which is most of them, forever — never loads them. The shape
    // check above runs first, so a wrong file is rejected without the import.
    const { parseWxr } = await import('@/import/wordpress')
    const { posts, pages, skipped } = parseWxr(xml, new Date().toISOString())
    let importedPosts = 0
    let importedPages = 0
    for (const { slug, ...rest } of posts) {
      await saveUnique(slug, (s) => savePost({ ...rest, slug: s }))
      importedPosts += 1
    }
    for (const { slug, ...rest } of pages) {
      await saveUnique(slug, (s) => savePage({ ...rest, slug: s }))
      importedPages += 1
    }

    if (importedPosts + importedPages > 0) clearCache()
    void logActivity('import.wordpress', `${importedPosts} posts + ${importedPages} pages`)
    return json({ posts: importedPosts, pages: importedPages, skipped })
  })

  // One save loop for every importer that is not WordPress; the parsers are pure and the
  // persistence is identical, so the difference between routes is only "who parsed it".
  const persist = async (
    result: { posts: import('@/import/convert').ImportedPost[]; pages: import('@/import/convert').ImportedPage[]; skipped: number },
    source: string,
  ) => {
    let importedPosts = 0
    let importedPages = 0
    for (const { slug, ...rest } of result.posts) {
      await saveUnique(slug, (s) => savePost({ ...rest, slug: s }))
      importedPosts += 1
    }
    for (const { slug, ...rest } of result.pages) {
      await saveUnique(slug, (s) => savePage({ ...rest, slug: s }))
      importedPages += 1
    }
    if (importedPosts + importedPages > 0) clearCache()
    void logActivity('import.wordpress', `${source}: ${importedPosts} posts + ${importedPages} pages`)
    return { posts: importedPosts, pages: importedPages, skipped: result.skipped }
  }

  router.post('/api/import/ghost', async (c) => {
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return fail(c, 'no_file', 400)
    if (file.size > MAX_IMPORT_BYTES) return fail(c, 'file_too_large', 413)
    let doc: unknown
    try {
      doc = JSON.parse(await file.text())
    } catch {
      return fail(c, 'not_a_ghost_export', 400)
    }
    const { looksLikeGhost, parseGhost } = await import('@/import/ghost')
    if (!looksLikeGhost(doc)) return fail(c, 'not_a_ghost_export', 400)
    return json(await persist(parseGhost(doc, new Date().toISOString()), 'ghost'))
  })

  router.post('/api/import/archive', async (c) => {
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return fail(c, 'no_file', 400)
    if (file.size > MAX_IMPORT_BYTES) return fail(c, 'file_too_large', 413)

    // Substack and Medium both hand people a ZIP; nobody remembers which is which, so
    // the server tells them apart by structure (posts.csv vs h-entry markup), not by
    // asking. Only .html/.csv entries are read as text; images and everything else in
    // the archive stay untouched — this importer, like the others, keeps image URLs.
    const { unzipSync } = await import('fflate')
    let entries: { name: string; text: string }[]
    try {
      const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
      entries = Object.entries(files)
        .filter(([name]) => /\.(html|csv)$/i.test(name))
        .map(([name, data]) => ({ name, text: new TextDecoder().decode(data) }))
    } catch {
      return fail(c, 'not_a_zip', 400)
    }
    const { isSubstack, isMedium, parseSubstack, parseMedium } = await import('@/import/archive')
    const now = new Date().toISOString()
    if (isSubstack(entries)) return json(await persist(parseSubstack(entries, now), 'substack'))
    if (isMedium(entries)) return json(await persist(parseMedium(entries, now), 'medium'))
    return fail(c, 'not_a_recognised_export', 400)
  })

  return router
}

/**
 * The two routes an external caller reaches without a session.
 *
 * Not on the owner router, and that is the point of them being in a separate function:
 * a scheduler and a load balancer both call these, and neither can sign in.
 */
export function publicOpsRoutes(): Hono {
  const app = new Hono()

  // ----- the cron tick --------------------------------------------------------
  //
  // Run it hourly from cron or a panel. It does NOT email anyone: a scheduled post goes
  // live on time, but the newsletter broadcast is always pressed by hand.

  app.get('/api/cron', async (c) => {
    // A cap BEFORE the token check, and the reason is what this route does rather than what
    // it returns: one call clears the page cache, purges the CDN if one is configured, runs sharp
    // over any pending image variants and may take a full backup of both databases and the
    // uploads tree. On a fresh install CRON_SECRET is unset and the route is open — so it
    // was an unauthenticated lever on the most expensive work the process can do, on a
    // runtime with exactly one thread. A scheduler on the tightest sensible cadence spends
    // one of these a minute; anything past twelve is not a scheduler.
    if (rateLimited(`cron:${clientIp(c)}`, CRON_PER_MINUTE)) {
      return fail(c, 'Too many requests', 429)
    }
    // When CRON_SECRET is set, the scheduler sends it as a Bearer token. Unset means open,
    // so the keep-alive still works on a fresh install before anything is configured.
    const secret = process.env.CRON_SECRET
    if (secret && !bearerOk(c.req.header('authorization') ?? null, secret)) {
      return fail(c, 'Unauthorized', 401)
    }

    // What a tick does lives in `server/tick.ts`, because since ADR 0031 the process runs
    // the same two ticks on its own clock and two copies of this would drift.
    if (c.req.query('publish') === '1') {
      return json({ alive: true, published: await publishTick() })
    }
    return json({ alive: true, ...await fullTick({ purge: c.req.query('purge') === '1' }) })
  })

  // ----- the health probe -----------------------------------------------------
  // Public and unauthenticated: a reverse proxy or orchestrator calls it, and one that
  // had to hold a session would be a worse probe.

  app.get('/api/health', async (c) => {
    const database = checkDatabase()
    const storage = await checkStorage()
    const healthy = database && storage
    // 503 when degraded, so a load balancer takes this instance out of rotation. A 200
    // with `status: degraded` in the body would be read by nothing.
    return c.json(
      { status: healthy ? 'ok' : 'degraded', checks: { database, storage } },
      healthy ? 200 : 503,
      { 'cache-control': 'no-store' },
    )
  })

  return app
}

function checkDatabase(): boolean {
  try {
    one<{ id: number }>(`select id from settings limit 1`)
    return true
  } catch {
    return false
  }
}

async function checkStorage(): Promise<boolean> {
  try {
    const { access, constants } = await import('node:fs/promises')
    const { resolve } = await import('node:path')
    // WRITABLE, not merely present. A full disk or a read-only mount is exactly the
    // failure a probe exists to catch, and both pass an existence check.
    await access(resolve(process.env.STORAGE_LOCAL_DIR || './uploads'), constants.W_OK)
    return true
  } catch {
    return false
  }
}
