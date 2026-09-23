> Read when touching the Content API (`/api/v1`, `src/web/api-v1.ts`, `src/web/api-v1-shape.ts`).

# Content API — `/api/v1`

- **What it is.** The blog's published writing as JSON, for a client building something out of it
  rather than reading it: a second front end, a search index, a static export, an app. Read-only,
  unauthenticated, **off unless the owner enables it** (Admin → Settings → Server & connections,
  `settings.api.enabled`). While off, every path answers `404` with `{"error":"Not found"}` —
  the same status `/api/mcp` gives, for the same reason a `403` would be worse.
- **Why a switch at all.** It publishes no new FACT: everything it serves is already fetchable by
  browsing. It publishes a new SHAPE — the whole blog in as many requests as it has pages instead
  of as many as it has readers. Whether that suits a particular blog is the owner's judgement.
  [ADR 0057](decisions/0057-the-blog-can-be-read-by-a-program.md) has the argument in full.
- **GET only.** Nothing here writes, which is why `src/web/api-v1.ts` appears nowhere in
  `scripts/checks/routes-guarded.ts`. To write to a blog from a program, use Micropub
  ([ADR 0046](decisions/0046-the-notebook-speaks-the-open-standards.md)) or MCP ([mcp.md](mcp.md)).

## The endpoints

| Path | Answers |
|---|---|
| `GET /api/v1` | what this is, the site's own facts, the paths below, and the limits |
| `GET /api/v1/posts` | a page of public posts. `?page` `?per` `?category` `?tag` |
| `GET /api/v1/posts/{slug}` | one post, with its Markdown body and its translations |
| `GET /api/v1/pages` · `GET /api/v1/pages/{slug}` | the same, for pages |
| `GET /api/v1/notes` · `GET /api/v1/notes/{slug}` | the same, for the notebook ([ADR 0044](decisions/0044-a-note-is-not-a-post.md)) |
| `GET /api/v1/taxonomy` | every category and tag, counted over public posts only |

A listing answers `{ items, total, page, per, pages }`. A single piece answers the object itself.
A failure answers `{ error }` — a bare shape, not the admin's `{success,data}` envelope, because
every client of this endpoint is somebody else's code.

## What it will and will not show

- **Only what a reader could already see.** Lists come from the same `getPublic*` readers the
  pages and feeds use; single pieces are tested with the same `isPublicallyVisible` the article
  route applies. A draft, a post dated ahead and a trashed row are absent from the list AND refuse
  by name.
- **Markdown, never rendered HTML** ([ADR 0052](decisions/0052-one-markdown-engine-of-our-own.md)).
  One engine, whose output is cached under a hash of its input and rendered against settings a
  client cannot see.
- **`status`, `deletedAt`, `metaTitle`, `metaDescription` and `translationGroup` never travel.**
  `src/web/api-v1-shape.ts` names every field it emits; nothing spreads a stored row. Its test
  asserts the KEY SET against pieces filled in FULL, including the fields that must stay behind,
  so a column added to `posts` reaches this API only when somebody writes its name there.
- **`translations`** carries the sibling pieces' language, URL and title, read from
  `content/translations.ts` — the same rule behind the article's `hreflang` and the sitemap's
  `xhtml:link` ([ADR 0056](decisions/0056-a-piece-names-its-own-language.md)).

## Limits, caching and CORS

- **`per` is capped at 100**, defaults to 20. `?page` past the end answers the last page. Nonsense
  in either is read as unsaid rather than as an error.
- **120 requests a minute per address**, in-memory and per instance (`src/server/rate-limit.ts`).
  Twice the search endpoint's, because this one is meant to be called in a series.
- **The public page's freshness**, exported from `web/cache-headers.ts` so there is one window
  rather than two. It follows `settings.cache.enabled`.
- **`access-control-allow-origin: *`, and no `access-control-allow-credentials`.** Safe together
  only because the answer never varies by reader: no route here reads the session cookie, and the
  owner's own browser gets byte-for-byte what a stranger gets. `src/web/api-v1.test.ts` asserts
  both halves — the sameness, and the ABSENCE of the credentials header.
- **A preflight is answered whether the API is on or off.** `OPTIONS` describes the method; the
  `GET` behind it says 404 either way.

## Tests

| File | Holds |
|---|---|
| `src/web/api-v1-shape.test.ts` | the key set of every projection, and the paging arithmetic. No database |
| `src/web/api-v1.test.ts` | the switch, who may be seen, the term filter, CORS, and that the owner's session changes nothing |
| `src/admin/island/settings-api.test.ts` | the card: its gate, and that the copy key is actually wired |
