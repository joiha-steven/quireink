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
- `renderRobots` — **three groups**, restored from 1.x on 2026-08-29. Search engines and AI
  crawlers share one ALLOW group (named agents, `Allow: /`, the two `Disallow:` lines);
  the SEO/backlink miners get `Disallow: /`; `*` gets the allow group's directives, so an
  unknown good crawler is welcome. The `Sitemap:` line follows when the sitemap is on.
  **Nothing in it blocks an AI crawler, deliberately**: this software ships `/llms.txt` for
  those readers, and whether a blog joins a training set is the OWNER's decision about their
  own writing. Turning it into a block needs a `seo` setting and a switch in the admin
  beside the others — not a default. Only the tier that crawls heavily, sends no readers and
  resells the blog's links is turned away.
- `renderSitemap` — home + posts + pages, **plus one entry per category and per tag**, and
  `<image:image>` on a post that has one. Terms are read off the PUBLIC post list, never
  `getCategories`/`getTags`: those include drafts, and `/category/x` 404s for a term no
  public post carries. They are keyed by slug (two names can slugify to one URL) and their
  `lastmod` is the freshest post in the term, because a term page IS its posts. The images
  are the post's two image FIELDS only — `coverImage` and `featuredImage`, made absolute —
  and nothing scraped from the body: 1.x read every post's markdown here and could afford to
  because Next cached the document for an hour, while this route builds on request.
  `xmlns:image` is declared only when an entry actually uses it.
- `/sitemaps.xml` **301s to `/sitemap.xml`** (`src/web/feed-routes.ts`). The plural is the
  common misspelling and the shape of some old Search Console submissions. An alias, not a
  second document: unconditional, reading no settings, so when the sitemap is switched off
  the 404 comes from the one route that owns that answer.
- `renderLlms` — a markdown index of posts and pages, newest first, titles and one-line
  summaries only: a model that wants the body follows the link.
- **Page 1 of a listing IS the listing.** `/category/x/page/1` → `/category/x`, the same for
  a tag, and `/page/1` → wherever the post list lives: a 301 from `canonicalPath()`
  (`src/web/canonical-path.ts`), beside the trailing-slash rule because it is the same rule —
  one address per page, every other spelling a permanent move. The home destination is
  `listRoot` (`/` in list mode, `settings.home.listPath` once a page or the front owns `/`,
  ADR 0014), which is what `renderPostList` already put in the canonical tag; sending it to
  `/` unconditionally would hand the reader a different document. Settings are read only on a
  path that matched, so the hot path still costs one regex. It runs ahead of the routes, so
  `/page/:n` only ever sees a real page number. The paginator has always linked page 1 at the
  bare path; what this catches is the URL a person typed, a crawler guessed from `/page/2`,
  or an old inbound link still carries.
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

- **JSON-LD, when `seo.autoSchema` is on** (`src/render/schema.ts`). Two shapes and no more,
  matching what the setting promises the owner: `WebSite` on the home page — with a
  `SearchAction` only when search is switched on, because describing an endpoint that answers
  404 is worse than describing none — and `BlogPosting` on each post, carrying the real
  `dateModified` and only when there IS one. A static page gets none: a `WebPage` object that
  restates the title and the canonical adds no fact the tags beside it did not. No `author`,
  because this software has no owner-name setting and the only name on record is
  `users.username`, which is half a credential; `publisher` names the site instead. Absolute
  URLs or nothing, the same rule as the canonical.
  **This is the setting that was in the shape, defaulted to `true`, described in the admin,
  and read by nothing** until 2026-08-25 — an owner looking at the switch saw a feature that
  was on. Wiring it was the fix; hiding it would also have been one.
- **A page that should not be indexed says so.** `Head.robots` prints
  `<meta name="robots">`, and two pages use it: sign-in, and `/search`. The results page mints
  a URL per query and had no canonical either, so a crawler following the form found an
  unbounded set of near-duplicate listings with nothing telling it to stop. `noindex, follow`
  rather than `noindex, none`: the links on that page are the real posts.
- **A listing describes itself.** `listingPage` takes a `description`; the default is
  `settings.description` and for the home page that is exactly right, because it IS the site.
  Everywhere else it was a bug wearing a default — search, every tag, every category, every
  series and the 404 shipped one identical sentence. Term pages and series pages now build
  theirs from `metaTerm` / `metaSeries` in `locales/`, and the 404 and search use the
  strings already on the page. They are SHORT by SEO convention's 120-160, and deliberately:
  reaching 120 on a tag page means inventing words about it, and a padded sentence that is
  the same shape on ninety pages is the problem this fixed, not the cure.

**Not carried over yet** (tracked in [`spec/07-parity-public.md`](spec/07-parity-public.md), do not
document this as present): the `Content-Signal` line in `robots.txt`. It is the one part of
1.x's robots policy left out on purpose — it declares how the content may be USED
(`ai-train=yes`), which is the owner's stance and not a constant this file gets to pick. See
[`agent-ready.md`](agent-ready.md), "Content-usage policy".

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
