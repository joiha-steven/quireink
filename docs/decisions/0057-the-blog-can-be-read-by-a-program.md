# 0057 — The blog can be read by a program, once the owner says so

Date: 2026-09-19
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

Every machine surface this product had answered one narrow question. The feeds answer *what is
new*, the sitemap *what exists*, `/api/md/:slug` *what does this one say*, MCP *let an agent
operate the blog*. None of them answers *give me this blog's writing so I can build something
out of it* — a second front end, a search index, a static export, an app, a script that checks
its own links.

The only way to do that was to fetch the HTML and parse it back out, which is both worse for the
client and worse for this server: a scraper asks for every page, rendered, one at a time.

WordPress has answered this with `/wp-json` since 2016 and Ghost with a Content API. Astro does
not need one, because an Astro site IS the build. The gap was real and the shape of the answer
was not in dispute.

What WAS in dispute is whether a blog should ship with that door open. WordPress does — `/wp-json`
is on by default on every install, and the surprise it produces (an enumerable user list, a
full-content endpoint) is the single most written-about thing about it.

## Decision

**A read-only JSON API at `/api/v1`, off at install and off on every upgrade, switched on from
Settings → Server & connections.**

Four separate things hold it shut, and they are separate on purpose: each answers a different
version of "what could this be used for".

**1. Off by default, and 404 while off.** Not 403. A 403 confirms the feature exists on this
install and this build, and there is nothing to be gained by saying so to somebody who did not
already know. It is the answer `/api/mcp` gives while MCP is off, for the same reason.

The switch matters even though the API publishes no new FACT. Everything it serves is already
fetchable by browsing. What it publishes is a SHAPE: the whole blog, paginated, parsed, in as
many requests as it has pages rather than as many as it has readers. Whether that is a good
thing to offer is a judgement about a particular blog, and the owner is the one who can make it.

**2. GET only.** Not one route writes. That keeps the file out of the write gate's exception
list entirely ([invariant 4](../invariants.md), `scripts/checks/routes-guarded.ts`) — the safest
way to be on a list of exceptions is to have no business being on it.

**3. Nothing that is not already public.** Every list comes from the same `getPublic*` readers
the pages and the feeds use, and every single piece is tested with the same `isPublicallyVisible`
the article route applies. Drafts, posts dated ahead and trashed rows are invisible here by
construction rather than by a filter somebody has to remember to write on the ninth route.

**4. The answer does not vary by reader.** Nothing on this surface reads the session cookie; the
owner's own browser gets byte-for-byte what a stranger gets. That is what makes
`access-control-allow-origin: *` and a shared-cache window safe AT THE SAME TIME. The pair in
every write-up of a CORS leak is *open to any origin* plus *varies by who asked*, and this
endpoint refuses the second half. `access-control-allow-credentials` is absent, and a test
asserts its absence rather than the presence of anything.

## What it emits, and why that is a key set

`web/api-v1-shape.ts` builds every response object by NAMING each field. Nothing spreads a stored
row and deletes from it. A column added to `posts` next year reaches the public API when somebody
writes its name in that file, on purpose, and never by arriving.

Three fields are deliberately missing, for three different reasons:

- **`deletedAt`** is a fact about the owner's trash.
- **`metaTitle` / `metaDescription`** are instructions to a crawler about a page, not anything the
  piece says.
- **`translationGroup`** is an opaque key that means nothing off this machine. The useful half of
  it — who the translations ARE — travels with the single piece as `translations`, read from
  `content/translations.ts`, the one rule the article's hreflang and the sitemap already read
  ([0056](0056-a-piece-names-its-own-language.md)).

And **`status` is missing**, which is the one worth arguing about. Every piece this API returns
is public, so the field could only ever read `"published"` — and a field that is always the same
is a field a future leak could hide behind. Nothing to compare means nothing to be reassured by.

**Markdown, not HTML** ([0052](0052-one-markdown-engine-of-our-own.md)). There is one markdown engine here,
its output is cached under a hash of its input, and it renders against settings a client cannot
see — tables, figures, galleries and the pen all read them. A second door handing out HTML would
be a second set of those decisions, drifting in silence from the page it claims to copy.

## Consequences

- **`per` is clamped at 100.** An unclamped limit is a one-request way to ask this blog to
  assemble everything it has ever published. `?page` past the end answers the last page rather
  than a 404, and nonsense in either is read as unsaid rather than as an error: `?per=abc` is a
  client bug, and page 1 of 20 is more use to whoever is debugging it than a 400 that reads as
  though the endpoint is broken.
- **A term filter reuses `resolveTerm`,** the archive's own function, so `/api/v1/posts?category=x`
  and `/category/x` cannot disagree about what is in a category. The one nobody checks is the one
  that drifts.
- **The freshness is the public page's,** exported from `web/cache-headers.ts` rather than written
  out a second time beside it. It is the same content, purged by the same write, and it honours
  the owner's cache switch because somebody watching their blog change needs one switch that
  means it.
- **A bare `{error}` and a bare listing,** not the `{success,data}` envelope from `web/api.ts`.
  That envelope is the admin's contract and exists because sixty-eight components read it; a
  public API has no such constituency and every client is somebody else's code, so the shape it
  should have is the shape a stranger expects. `/api/search/index` answers bare for the same
  reason and says so.
- **An OPTIONS preflight is answered whether the door is open or shut.** It describes the METHOD,
  the GET behind it says 404 either way, and answering it without a settings read costs nothing.
- **The rate limit is 120 a minute per address,** twice `/api/search`'s, because this endpoint is
  MEANT to be called in a series: a search box is called once per keystroke by one reader, a site
  generator once per page by one build.

## What this deliberately is not

**Not a write API.** Micropub already accepts a note from a client that authenticated
([0046](0046-the-notebook-speaks-the-open-standards.md)), and MCP already lets an authorised
agent operate the whole blog. A third way to write would be a third authorisation story.

**Not authenticated, and therefore not a way to read drafts.** Adding a token here would make the
switch mean two things at once — "there is a machine door" and "this door may see more than the
site does" — and the second is what MCP's tokens are for.
