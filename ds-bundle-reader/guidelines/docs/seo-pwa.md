> Split from CLAUDE.md — read when touching SEO toggles, sitemap/feed/llms/robots, OG image, PWA, or the web manifest.

# SEO & PWA

## SEO (toggleable, Admin → Settings → SEO)

- `settings.seo` = `{ autoSchema, sitemap, llms, robots, rss, ogImage, ogFallbackImage }` +
  `settings.siteUrl` (canonical; '' → localhost via `resolveSiteUrl()`).
- **The four machine surfaces are one code path.** `feedRoute()` in `src/web/app.ts` mounts
  `/feed.xml`, `/sitemap.xml`, `/robots.txt` and `/llms.txt`; each is gated on its own
  `settings.seo` flag and **404s when off** rather than serving an empty document, because an
  empty feed looks like a broken site to an aggregator and a 404 looks like what it is. The
  bodies are built by `src/web/feeds.ts`. All four send
  `public, s-maxage=300, stale-while-revalidate=600` — a write purges the zone anyway, so a
  subscriber never waits on the window.
- `renderRobots` — always `Disallow: /admin` and `Disallow: /api`, `Allow: /` for everything
  else, plus the `Sitemap:` line when the sitemap is on.
- `renderSitemap` — home + posts + pages. `renderLlms` — a markdown index of posts and pages,
  newest first, titles and one-line summaries only: a model that wants the body follows the
  link.
- `/og` (`src/web/og.ts`) — the dynamic 1200×630 card, rendered by `satori` + `sharp` in
  `src/render/og-card.ts`. It reads NO settings and touches no database; the caller
  (`src/render/og.ts`) has already decided what the card says. `ogImageUrl` builds a post's
  URL, `ogCardUrl` + `siteDomain` a listing's; `seo.ogFallbackImage` covers a post with no
  featured image. `?bg=` and `?font=` are fetched by the SERVER and are therefore restricted
  to this site's own origin, with `safeFetch` as the backstop — that restriction is the whole
  security story of the route and must not be relaxed.
- **Canonical:** every indexable page emits its own absolute `<link rel="canonical">`, built
  against `resolveSiteUrl(settings)` — `canonicalPath` for listings
  (`src/web/listing-page.ts`), the slug for an article (`src/web/article.ts`). With no
  `siteUrl` configured there is no canonical rather than a wrong one.
- **A miss is a real 404.** `notFoundPage()` returns status 404 with a rendered page in the
  site shell, and `src/web/cache-headers.ts` refuses a shared cache anything that is not a
  200, so a 404 never outlives the reason for it.

**Not carried over yet** (tracked in [`spec/07-parity.md`](spec/07-parity.md), do not
document these as present): JSON-LD structured data — `seo.autoSchema` is in the settings
shape and nothing reads it — the `/page/1` → `/` redirect, the `sitemaps.xml` → `/sitemap.xml`
redirect, category and tag entries and per-post `<image:image>` entries in the sitemap, and
the three-group crawler policy (search / AI / scraper bot lists) the frozen tree's `robots.ts`
carried.

## PWA

- Installs to the home screen, launches standalone. **No service worker (offline is out of
  scope by design)** → nothing to register; admin/API are never cached.
- `src/web/manifest.ts` serves `/manifest.webmanifest` from settings: name/short_name = the
  site title, `background_color`/`theme_color` = the default palette's light background,
  `display: standalone`, icons via `resolveAppIcon` at 192/512 `any` plus a 512 `maskable`
  so adaptive Android launchers can theme it.
- **The `<link rel="manifest">` is written by hand** in `src/web/layout.ts`. Nothing injects
  it: the route existed and nothing ever asked for it, so the site was not installable no
  matter what the route returned. Same for `<link rel="alternate" type="application/rss+xml">`,
  which is gated on `seo.rss` so a site with the feed off does not advertise a 404.
- App icon order: `appIconUrl` → `faviconUrl` → the bundled `app-icon.png`.
- **Favicon: ONE `<link rel="icon">`**, emitted by `layout.ts` only when `settings.faviconUrl`
  is set. `/favicon.ico` redirects to that URL when there is one and otherwise serves the
  bundled file (`src/web/app.ts`).
