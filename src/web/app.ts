// The public router.
//
// Hono, not a framework: a route is a function from a request to a string, and the whole
// page cache is one Map (Invariant 1). What was ISR plus a tagged data cache plus a
// per-write path superset is now "render it, keep the string, throw all of them away on
// any write".
//
// Route order is load-bearing. `/:slug` matches anything, so every fixed path is
// registered before it; Hono matches in registration order.

import { Hono } from 'hono'
import type { Context } from 'hono'
import { getSettings } from '@/content/settings'
import { cached, notFoundPage, pageNumber } from '@/web/listing-page'
import { renderHome, renderPostList, slugRole } from '@/web/home-mode'
import { registerFeedRoutes } from '@/web/feed-routes'
import { registerTermRoutes } from '@/web/term-routes'
import { renderArticle } from '@/web/article'
import { assetBody, SW_BODY } from '@/web/assets'
import { handleOg } from '@/web/og'
import { handleTrack } from '@/web/track'
import { handleUpload } from '@/web/uploads'
import { handleMarkdown, wantsMarkdown } from '@/web/markdown'
import { handleManifest } from '@/web/manifest'
import { handlePreview } from '@/web/preview'
import { handleSearch, handleSearchIndex } from '@/web/search-api'
import { handleSearchPage } from '@/web/search-page'
import { canonicalPath } from '@/web/canonical-path'
import { userRedirects } from '@/web/redirects'
import { cacheHeaders } from '@/web/cache-headers'
import { securityHeaders } from '@/web/security-headers'
import { updatePing } from '@/web/update-ping'
import { compression } from '@/web/compress'
import { errorHandler, notFoundHandler, requestLogger } from '@/web/api'
import { contentRoutes } from '@/web/admin/content'
import { securityRoutes } from '@/web/admin/security'
import { siteRoutes } from '@/web/admin/site'
import { uploadRoutes } from '@/web/admin/uploads'
import { newsRoutes } from '@/web/admin/news'
import { opsRoutes, publicOpsRoutes } from '@/web/admin/ops'
import { assistantRoutes } from '@/web/admin/assistant'
import { mcpAdminRoutes, mcpOAuthRoutes } from '@/web/admin/mcp'
import { viewRoutes } from '@/web/admin/views'
import { backupRoutes } from '@/web/admin/backup'
import { handleMcp } from '@/web/admin/mcp-transport'
import { adminShell, handleAdminAsset } from '@/web/admin/spa'
import { currentOwner } from '@/web/guard'
import { staticFile, staticPaths } from '@/web/static'
import { handleCommentsGet, handleCommentsPost, handleStampGet } from '@/web/comments'
import { commentAuthRoutes } from '@/web/comment-auth'
import { SPECULATION_PATH, speculationRules } from '@/web/speculation'
import {
  handleConfirm, handleOpenPixel, handleSubscribe, handleUnsubscribeGet, handleUnsubscribePost,
} from '@/web/newsletter'
import {
  handleLogin, handleLoginPage, handleLogout, handleTwoFactor, handleTwoFactorPage,
} from '@/web/auth-routes'
import { handleEnrol, handleEnrolDone, handleEnrolSkip } from '@/web/enrol-routes'
import { handleSetupClaim, handleSetupPage, setupWizardRoutes } from '@/web/setup-routes'

/**
 * The admin shell, for the owner, or a redirect to sign in.
 *
 * The redirect carries where they were going, so signing in lands them on the page they
 * asked for rather than dumping them at the dashboard.
 */
async function adminPage(c: Context): Promise<Response> {
  if (currentOwner(c) === null) {
    const next = encodeURIComponent(c.req.path + (new URL(c.req.url).search || ''))
    return c.redirect(`/login?next=${next}`, 302)
  }
  // The shell carries the owner's language, typeface and palette, so the first paint is
  // already correct. The frozen tree got them from the root layout the admin sat inside.
  return c.html(adminShell(await getSettings()), 200, { 'x-robots-tag': 'noindex, nofollow' })
}

export function createApp(): Hono {
  const app = new Hono()

  // Every request is timed and logged here rather than at the end of each handler. A rule
  // kept by remembering it is a rule that a route eventually forgets.
  app.use('*', requestLogger())

  // ...and the same argument for errors: a handler may throw, and this is the one place
  // that becomes a logged, typed 500.
  app.onError(errorHandler())

  // A trailing slash is the same page, not a miss. See `web/canonical-path.ts`.
  app.use('*', canonicalPath())

  // A URL NO route claims. The `/{slug}` route answers a single-segment miss with the 404
  // page, so that case has always looked right — and it is the only case anyone checked.
  // Anything with two or more segments matched no route at all and fell through to Hono's
  // built-in `404 Not Found`, in text/plain, with no viewport meta: measured at 390px, the
  // exact failure `notFoundPage` was written to prevent. The URLs this hits are not
  // hypothetical. A WordPress site imported into Quire Ink has every old inbound link
  // shaped `/2024/01/slug`, and every one of them landed here.
  app.notFound(notFoundHandler())

  // What a shared cache may do with a page, in one rule at the door.
  app.use('*', cacheHeaders())

  // ...and the three response headers that cost nothing and are wrong to omit.
  app.use('*', securityHeaders())

  // Nothing here ever sent content-encoding, so every page and every asset left the origin
  // uncompressed. Outermost of the three, so it sees the finished body of every route.
  app.use('*', compression())

  // A URL the owner MOVED answers before any route sees it. See `web/redirects.ts`.
  app.use('*', userRedirects())

  // A reader arriving is what triggers the once-a-day update check, and this is the only
  // line of it on the request path. See `web/update-ping.ts` for why it is a reader rather
  // than a timer, and `server/update-check.ts` for what the call carries.
  app.use('*', updatePing())

  // `/` is the post list, or a page the owner chose. Resolved per request rather than when
  // the routes are built, because the mode is a setting: see `web/home-mode.ts`.
  app.get('/', async () => cached('/', renderHome)())

  app.get('/page/:n', async (c) => {
    const page = pageNumber(c.req.param('n'))
    if (page === null) return notFoundPage()
    return cached(`/page/${page}`, () => renderPostList(page))()
  })

  // ----- the archives ---------------------------------------------------------
  // Category, tag, series and the year index, each with its own feed. In their own file
  // since 2026-08-30: they are the routes that resolve a NAME to a set of posts, and this
  // one had nine lines left. See `web/term-routes.ts`.

  registerTermRoutes(app)

  // ----- search ---------------------------------------------------------------

  app.get('/search', handleSearchPage)

  // ----- the analytics beacon -------------------------------------------------
  // Public and unauthenticated by necessity: it is called by every reader's browser. It
  // is rate-limited per IP, drops bots and admin paths, and stores no PII.

  app.post('/api/track', handleTrack)

  // ----- the JSON and machine surfaces ----------------------------------------

  app.get('/api/search', handleSearch)

  app.get('/api/search/index', handleSearchIndex)
  app.get('/api/comments', handleCommentsGet)
  app.get('/api/comments/stamp', handleStampGet)
  app.post('/api/comments', handleCommentsPost)
  // Reader sign-in, which is not the owner's: it grants a filled-in name and a skipped
  // captcha, nothing more. Mounted here rather than with `/api/auth` for that reason.
  app.route('/', commentAuthRoutes())
  app.post('/api/subscribe', handleSubscribe)
  app.get('/api/newsletter/confirm', handleConfirm)
  // GET asks for a click, POST does it. Link scanners and mail-client prefetchers issue
  // GETs, so unsubscribing on GET means an appliance that merely looked at an inbox can
  // remove the reader from the list.
  app.get('/api/newsletter/unsubscribe', handleUnsubscribeGet)
  app.post('/api/newsletter/unsubscribe', handleUnsubscribePost)
  app.get('/api/newsletter/open', handleOpenPixel)
  app.get('/api/md/:slug', handleMarkdown)
  app.get('/manifest.webmanifest', handleManifest)
  // Pointed at by the `Speculation-Rules` header on every public page. A document rather
  // than an inline script, so the public site keeps shipping none.
  app.get(SPECULATION_PATH, () => speculationRules())

  // ----- sign-in --------------------------------------------------------------
  // The only write routes that cannot be owner-gated, because they are how one becomes an
  // owner. Each is listed in `scripts/checks/routes-guarded.ts` with the reason it is
  // public, so the exception is a decision on the record rather than an omission.

  app.get('/login', handleLoginPage)
  app.get('/login/2fa', handleTwoFactorPage)
  app.post('/api/auth/login', handleLogin)
  app.post('/api/auth/2fa', handleTwoFactor)
  app.post('/api/auth/enrol', handleEnrol)
  app.post('/api/auth/enrol/done', handleEnrolDone)
  app.post('/api/auth/enrol/skip', handleEnrolSkip)

  // First run. Both refuse the moment an account exists, so on a claimed blog these are two
  // more 404s rather than a door left standing open with nothing behind it.
  app.get('/setup', handleSetupPage)
  app.post('/api/setup/claim', handleSetupClaim)
  app.post('/api/auth/logout', handleLogout)

  // ----- the admin API --------------------------------------------------------
  // Mounted at the root because each route already carries its full `/api/...` path, and
  // `route()` here would prefix them a second time. Every one of these is behind
  // `requireOwner()` by virtue of the router it was registered on, not by a check inside
  // it (Invariant 4), and `check:routes` fails the build if one escapes.

  app.route('/', contentRoutes().routes)
  app.route('/', securityRoutes().routes)
  app.route('/', siteRoutes().routes)
  app.route('/', uploadRoutes().routes)
  app.route('/', newsRoutes().routes)
  app.route('/', opsRoutes().routes)
  app.route('/', assistantRoutes().routes)
  app.route('/', setupWizardRoutes().routes)
  app.route('/', publicOpsRoutes())
  app.route('/', mcpAdminRoutes().routes)
  app.route('/', mcpOAuthRoutes())
  app.route('/', viewRoutes().routes)
  app.route('/', backupRoutes().routes)

  // The MCP endpoint. NOT on an owner-gated router: it authenticates with a bearer token
  // the owner minted, not with the session cookie, and it must answer 401 with the
  // metadata pointer rather than the gate's plain refusal. Declared public in
  // `check:routes` with that reason.
  app.get('/api/mcp', handleMcp)
  app.post('/api/mcp', handleMcp)
  app.delete('/api/mcp', handleMcp)

  // ----- the admin ------------------------------------------------------------
  // The built bundle, and the empty shell that mounts it. Registered before `/:slug` so a
  // page called "admin" cannot shadow it.
  //
  // The assets are PUBLIC by deliberate choice: they are a compiled front end containing
  // no data, every byte of it is in a public repository, and gating them would only mean a
  // signed-out reader who lands on /admin gets a broken page instead of a sign-in form.
  // Everything the bundle then asks for is gated.
  app.get('/admin/assets/*', handleAdminAsset)

  app.get('/admin', async (c) => await adminPage(c))
  app.get('/admin/*', async (c) => await adminPage(c))

  // ----- drafts ---------------------------------------------------------------
  // Registered before `/:slug` so a post that happens to be called "preview" cannot
  // shadow it, and kept off that route so the public page has no token branch at all.

  app.get('/preview/:slug', handlePreview)

  // ----- the Open Graph card --------------------------------------------------
  // Everything it needs is in the query string, so it reads no settings and no database.

  app.get('/og', handleOg)

  // ----- media ----------------------------------------------------------------
  // Every image and video in a rendered page resolves here. Streamed, range-capable, and
  // cached forever, because upload names are content-stable.

  app.get('/uploads/*', handleUpload)

  // `/favicon.ico` is the path a browser asks for when nothing told it otherwise, and what
  // it got was the icon compiled into the PRODUCT — so a bookmark, a feed reader or any tab
  // whose page carried no icon link showed Quire Ink's mark on somebody else's blog. The owner's
  // own upload wins when there is one; the bundled file is the fallback, which is the right
  // answer for a fresh install. The redirect itself is not a 200, so `cache-headers.ts`
  // gives it `private, no-store` — which is what a pointer that changes on the next upload
  // wants, while the file it points AT keeps its immutable year.
  app.get('/favicon.ico', async (c) => {
    const { faviconUrl } = await getSettings()
    if (faviconUrl) return c.redirect(faviconUrl, 302)
    return (await staticFile('/favicon.ico')) ?? new Response('Not found', { status: 404 })
  })

  // Fonts, favicon and app icon. Registered path by path rather than under a prefix, so
  // this route can only ever serve files that are compiled in. The reading font is the LCP
  // resource on an article page, which is why the head preloads it.
  for (const path of staticPaths()) {
    app.get(path, async () => (await staticFile(path)) ?? new Response('Not found', { status: 404 }))
  }

  // ----- browser bundles ------------------------------------------------------
  // The URL carries a content hash, so the answer is cacheable forever and a deploy that
  // changes the code changes the URL. A miss is a 404, never a stale body: an unknown
  // hash means the reader is asking for a version this server does not have.

  // The service worker, at the root because that is the only scope from which it can see a
  // page (ADR 0039). `no-cache` and not `immutable`: the build lives in the query string,
  // but a worker script is the one file whose staleness cannot be fixed by a reload — a
  // browser holding an old one keeps serving from it — so it revalidates every time.
  //
  // Registered unconditionally. The route existing costs nothing; what decides whether any
  // reader installs it is `features.offline`, which is read where the page is built.
  app.get('/sw.js', () => new Response(SW_BODY, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-cache',
      // Without this a worker served from `/sw.js` still only claims `/`, which is what is
      // wanted — the header is here so a future move of the file cannot silently narrow it.
      'service-worker-allowed': '/',
    },
  }))

  app.get('/assets/:file', (c) => {
    const file = c.req.param('file')
    const body = assetBody(`/assets/${file}`)
    if (body === null) return c.text('Not found', 404)
    return new Response(body, {
      headers: {
        'content-type': file.endsWith('.css')
          ? 'text/css; charset=utf-8'
          : 'text/javascript; charset=utf-8',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })
  })

  // ----- machine-readable -----------------------------------------------------
  // The feed, the sitemap, robots.txt and llms.txt. In their own file since 2026-08-22:
  // they are the only routes here answering a program rather than a person, and this one
  // reached its line ceiling.

  registerFeedRoutes(app)

  // ----- the catch-all: one /{slug} namespace for posts AND pages -------------

  app.get('/:slug', async (c) => {
    const slug = c.req.param('slug')
    // ...and two slugs in this namespace may not be a document at all once `/` has been
    // given away: one is the post list's new home, and one is the page already served at
    // `/`, whose own slug is then a second URL for one document (ADR 0014).
    const role = await slugRole(slug)
    if (role === 'list') return cached(`/${slug}`, () => renderPostList(1))()
    if (role === 'home') return c.redirect('/', 301)
    // An agent that asks for Markdown gets the source it was written in rather than HTML
    // it would have to parse back into prose. Same URL, same visibility rules.
    if (wantsMarkdown(c.req.header('accept'))) return handleMarkdown(c)
    return cached(`/${slug}`, () => renderArticle(slug))()
  })

  return app
}
