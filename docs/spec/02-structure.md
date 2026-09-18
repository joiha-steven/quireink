# Module structure, caching, concurrency

Replaces the Go plan's package spec.

## Layout

The implementation sits at the REPOSITORY ROOT
([ADR 0012](../decisions/0012-flatten-repo-after-cutover.md)).

```
package.json
src/
  index.ts              boot: env, open the databases, build the app, listen
  env.ts                the environment contract, read once at boot
  web/
    app.ts              the Hono instance, the middleware chain, every route
    guard.ts            ownerRouter(), the owner-gated router group (Invariant 4)
    api.ts              JSON helpers, the error handler, the request logger
    admin/              the owner-gated API groups + the admin shell
    *.css.ts            the hand-written stylesheets (04-frontend.md)
  server/
    cache.ts            the in-process page cache (see below)
    edge-cache.ts       purgeEdge(), the Cloudflare purge behind it
    scheduled.ts warm.ts redirects.ts rate-limit.ts activity.ts backup.ts
  content/              posts, pages, revisions, slugs, taxonomy, series, settings
  media/                media, files, blob, image variants (sharp)
  md/                   the Markdown engine: one parse, and from it the reader's HTML, the
                        editor's document, the Markdown a save writes, the excerpt and the
                        plain text a search index reads (ADR 0052; it replaced four libraries)
  pen/                  the pen: grammar, dies, pigments, the forty variants a mark is dealt
  render/               footnotes, toc, video, inline-md, og. It calls md/, it is not the engine
  comments/             tree, tombstones, markdown subset, notify
  news/                 subscribers, mail, broadcast, send log, email builders
  analytics/            record, aggregate, timezone buckets, ua buckets
  auth/                 password, TOTP, sessions, recovery codes (06-auth.md)
  mcp/                  MCP server, tokens, OAuth DCR
  store/
    db.ts               the two connections + PRAGMAs
    schema.sql          embedded, applied at boot
    schema-analytics.sql
    migrations.sql      one file per database (+ migrations-analytics.sql), not a directory
  import/               WordPress WXR parsing, for the admin's import page; ghost.ts and archive.ts joined it later (noted 2026-09-10)
  admin/                the admin's BROWSER half: island/ (one entry per screen) and the editor,
                        which stands on prosemirror-* directly since ADR 0054's step 7.
                        It was the React SPA ported from src/components/admin until ADR 0054;
                        the markup moved to src/web/admin/
  admin-shared/         what both halves of the admin read: the control vocabulary, the rail,
                        the tabs, the chords, the settings index. Imported by the server that
                        draws the markup AND by the island that wires it
  assets/
    js/                 core, post, login, book-mode, comment-thread, sw, and since ADR 0043 reader-pen (scripts/build-assets.ts)
    static/             fonts and icons
  i18n/                 dates and the locale table; the 11 languages live in locales/ at the root
scripts/                build, checks/, ops/, user.ts, drive.ts, shot.ts
golden/
docs/
```

There is no `src/api/` and no `src/cli/`. Route handlers live beside the views in
`src/web/`, and the command-line entry points are plain scripts under `scripts/`.

## Mapping from `src/lib`

Pure modules moved verbatim; every `db()` caller was rewritten. The table that listed all 65
went with the frozen tree ([ADR 0019](../decisions/0019-remove-the-frozen-tree-from-the-working-copy.md)).

## Caching: the biggest simplification

The frozen tree: an ISR page cache plus a tagged Data Cache plus `lib/revalidate.ts`
computing a `revalidatePath` superset per write, pinned by a test because it is easy to
under-purge.

In Quire 2.0 it is one in-process `Map` of rendered HTML, and **every write clears all
of it**:

```ts
export const cache = new Map<string, CachedPage>()
export function clearCache() { cache.clear() }   // called after every write, unconditionally
```

Invariant 1 becomes structurally unbreakable rather than test-enforced. Re-rendering a
post from SQLite costs well under a millisecond, so a total flush is not a performance
question at this scale. Cloudflare stays in front and is purged the same way, totally.

**Do not reintroduce targeted invalidation.** If a future measurement shows the flush
matters, add a rollup or a longer edge TTL, not a dependency graph.

The warm-then-purge that hangs off the flush (`server/warm.ts`) is **serialised, never
skipped**. A write arriving while a pass is in flight sets a flag and earns another lap when
that pass ends; it must not be dropped. It was dropped, behind an `if (running) return` that
looked like de-duplication — a warm walks every public post (8.4s measured at 77 posts) and
any save landing in that window never reached `purgeEdge`, so the in-process cache cleared
and the CDN kept the old page. That is the whole of "saving does not clear the cache".

## Concurrency

Single-threaded event loop, and this removes an entire class of design work the Go plan
needed:

- `bun:sqlite` is **synchronous**. A query does not yield, so no request can observe a
  half-applied transaction and no mutex is needed anywhere.
- There is exactly one writer by construction. No `SQLITE_BUSY` queue to build.
- Analytics writes buffer in an array and flush on `setInterval` every 2 seconds or at
  200 rows, whichever comes first, in one transaction against `analytics.db`. This is
  Invariant 7 and it is the only deferred write in the system.
- Long CPU work (image variants via `sharp`, OG rendering via `satori`) must not run on
  the event loop. Both are already async and offloaded by their libraries; the deferred
  `-1024` / `-1600` variant generation keeps its cron sweep.

## Route mapping

**Public (`src/web`):** `/`, `/page/:n`, `/:slug`, `/category/:slug` (+`/page/:n`),
`/tag/:slug` (+`/page/:n`), `/series/:slug`, `/archive`, `/search`, `/preview/:slug`, `/login`,
`/setup`, `/sw.js`, `/assets/:file`, `/feed.xml` (and a feed per archive),
`/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/manifest.webmanifest`, `/og`, `/uploads/*`,
`/.well-known/*`, `/api/md/:slug`. Server-rendered HTML built as strings, not JSX.

**A term or series slug falls back to the name itself** when `slugify` returns nothing, which it
does for every script it cannot fold — Japanese, Chinese, Korean, Thai, Arabic, Hebrew, Hindi,
Greek. Three of those are languages this admin is translated into, and until 2026-09-19 a blog
written in one of them had no reachable `/tag/`, `/category/` or `/series/` page at all: the
links pointed at the bare kind path, the sitemap advertised it, and the canonical check redirected
the one address that did work into the one that did not. The fallback is the RAW name and not a
percent-encoded one, because `resolveTerm`/`resolveSeries` decode before matching and
`term-routes.ts` encodes once when it redirects; the sitemap encodes at the point of emission,
where a `<loc>` wants the URL as it would be fetched.

**Admin (`src/web/admin` drawing, `src/admin` wiring):** every address is a page the server
draws, and the browser gets one island per screen — ADR 0054, which replaced 0006. It was one
route serving an embedded SPA shell with client-side routing and 13 pages; there is no shell, no
router and no bundle now, and `src/admin` holds only what runs in the browser.

**API:** the existing routes, same paths, same shapes, registered in `src/web/` beside
the views rather than in a directory of their own. Split into two router groups:

- **public**: the `PUBLIC_WRITES` list in `scripts/checks/routes-guarded.ts`, each with its reason
- **owner-gated**: everything else, mounted under a group that runs the session check
  once (Invariant 4). A new route is owner-gated by default; making it public is an
  explicit act, which is the opposite of today's `isPublicApi()` allowlist and safer.

`ownerRouter()` (`src/web/guard.ts`) applies the gate AT CONSTRUCTION, so there is no
router someone can create and then forget to guard. The CSRF origin check lives inside
that same middleware rather than beside it: a cookie-authenticated write is exactly the
request that needs both, and splitting them creates the possibility of mounting one
without the other.

`bun run check:routes` (`scripts/checks/routes-guarded.ts`) is the enforcement. It fails
the build on any POST/PUT/PATCH/DELETE registered outside a gated router, unless its path
appears in that script's `PUBLIC_WRITES` map WITH the reason it is public. Making the
exception a list entry that carries an argument is the point; a naming convention would
not be one. It caught a forgotten `/api/auth/enrol/done` the first time it ran.

## Invariants carried over

1. **Cache is cleared completely after every write.** `clearCache()`, unconditional.
2. **Posts and pages share one `/{slug}` namespace.** `ensureSlugFree` on create and
   rename; trashed rows still reserve their slug.
3. **Image refs are stored store-relative.** `collapseBlob` on write, `expandBlob` on
   read, in the data layer only. Both anchor the `/uploads/` prefix to where a URL
   BEGINS — string start, or right after `](` / `src="` / `href="`. Stripping it
   wherever it appears also eats the segment out of a foreign URL, and every WordPress
   site serves images from `/wp-content/uploads/…`.
4. **Write routes are owner-gated by router-group membership**, not by a per-handler
   check.
5. **Raw HTML in markdown is escaped, never executed.** `rawHtml: 'escape'` in the
   engine's page rules plus `safeHref`, which is where the `marked` renderer override and its
   test moved on 2026-09-13 (ADR 0052). Same behaviour, same test.
6. **Every delete is a soft delete.** One `liveOnly` SQL fragment shared by every live
   read.
7. **Analytics writes go through the flush buffer**, never straight to a request handler.

Each has a test that fails if it is weakened, and the test must be updated in the same
commit, which makes the weakening visible.

## File size and style rules

Same as the frozen tree, because they worked: **400 lines per file maximum**, no `any`
(use `unknown` and narrow), every handler times and logs its request, errors wrap with
context, comments explain why rather than what.

English for code, comments, identifiers, filenames, commits and docs. Vietnamese only in
`src/i18n` locale data and user-facing strings.
