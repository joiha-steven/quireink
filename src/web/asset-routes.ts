// THE FILES THIS BUILD COMPILED IN, and how each one is allowed to be kept.
//
// Split out of `web/app.ts` on 2026-09-19, when mounting the fediverse put that file over its
// 400-line ceiling. The seam is not the line count: every other route in the router answers with
// something the OWNER wrote, and every route here answers with something the BUILD produced —
// the icon, the reading font, the browser bundles, the service worker. They are read at
// different times by different people, and the caching rules below are about content addressing
// rather than about freshness.
//
// ⚠️ THE ORDER IS PRESERVED BY CALLING THIS WHERE THE BLOCK USED TO BE. Every path here is
// fixed, so none of them competes with `/:slug` — but `web/app.ts` says route order is
// load-bearing, and a split that quietly moved a registration would be the kind of change that
// is correct today and wrong after the next one.

import type { Hono } from 'hono'
import { getSettings } from '@/content/settings'
import { assetBody, SW_BODY } from '@/web/assets'
import { staticFile, staticPaths } from '@/web/static'

export function registerAssetRoutes(app: Hono): void {
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
}
