# Site-level behaviour

## Homepage mode — [`docs/homepage.md`](../homepage.md)

What `/` serves: the post list, a chosen page, or the composed front page. Its own file, both
because it is long and because it is the one feature somebody installing Quire Ink reads before
they have a blog to configure. [ADR 0014](../decisions/0014-homepage-modes.md).
## URL redirects — `src/server/redirects.ts`, Admin → Settings → SEO

- **What:** owner-managed 301 (permanent) / 302 (temporary) redirects, plus an automatic
  301 whenever a post/page slug is renamed (so existing links + search results survive a
  move). Rows live in the `redirects` table (`source` unique, `destination`, `permanent`).
- **Served as a real HTTP 301/302 before any route runs** (`src/web/redirects.ts`, registered
  in `app.ts` as the last middleware before the routes). The lookup is skipped for `/admin`,
  `/api`, `/uploads/` and `/assets/`, and **fails open**: an unreadable table logs and lets the
  request through rather than taking the site down. `Location` is the destination **exactly as
  stored** — a path stays relative, an absolute URL stays absolute — and the query string is
  not carried over, because the destination is the whole of the new URL. ⚠ Do not "improve"
  this by resolving against the request: TLS terminates at the proxy, so the origin sees
  `http://` and every redirect would point there.
  ⚠ Between the port and 2026-08-02 the rows were stored and **nothing served them**, which
  made the auto-301 below silently untrue: every rename in that window lost its old URL.
  There is no in-process cache; the frozen tree's 60s one paid for an HTTP fetch to PostgREST,
  and here the lookup is an indexed read of a local file on the same thread.
- **Live content always wins.** Saving a post/page at slug X deletes any redirect whose
  `source` is `/X` (`clearRedirectForPath`), so a live URL is never shadowed by a stale
  redirect and a rename-back (A→B then B→A) cannot create a self-loop.
- **Admin:** a Redirects card (list + add + delete) in Settings → SEO. `source` is normalized
  (leading slash, no query/trailing slash); `destination` is a path or an absolute http(s) URL;
  a self-redirect is rejected. CRUD via the owner-gated `/api/redirects` (+ `/:id`).
