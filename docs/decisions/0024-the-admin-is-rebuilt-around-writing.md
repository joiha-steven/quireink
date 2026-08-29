# 0024 — The admin is rebuilt around writing. Everything else moves out of the way

Date: 2026-08-16
Status: accepted
Extends [0011](0011-settings-regrouped-into-seven.md) and the visual contract in
[`../admin-design.md`](../admin-design.md), which stays in force.

## Context

The verdict, on seeing the content screens beside a note app: listing posts, drafts, pages,
taxonomy and series was hard to follow and to manage, and the whole thing looked like
WordPress. And then the judgement that settles the priority — everything other than writing
is secondary.

Four measurements, not impressions, taken off the running demo:

- **Content is split into four tabs** — Posts · Pages · Taxonomy · Series. Finding a thing
  requires knowing which drawer it is in BEFORE looking for it.
- **The list is a table of administration data.** Four of its six columns are Status, Views,
  Comments, Categories. The eye lands on numbers; the writing is one column of titles.
- **The filter box cannot reach the writing.** `PostsTable.tsx` matches title, tags and
  categories only, over a client-side array. A sentence the owner remembers writing in a
  draft returns nothing, which is precisely the thing a note app exists to do.
- **The editor asks its questions at the wrong time.** A 24-button toolbar sits between the
  title and the first line, and an attributes column — slug, publish date, status,
  categories, tags, series, featured image — stays open while the writer is mid-sentence,
  taking nearly half the width.

Every one of those is a shape decision, not a missing feature. The data model already
supports what is wanted: posts are born `draft`, publishing is already an explicit act, and
`posts_fts` — an FTS5 index over title AND body, `remove_diacritics 2` — has existed since
the port and is used by the public `/search`. The admin simply never asked it anything.

## Decision

The admin is organised around the writing surface. Six changes, in this order, each
shippable on its own:

1. **Search reaches the body.** The admin's filter queries `posts_fts` (and a new
   `pages_fts`) through an owner-gated endpoint, drafts included, and each row shows the
   matching line. *This ADR ships with step 1.*
2. **One list.** Posts, pages, drafts and notes in a single stream, most recently touched
   first. Taxonomy and Series stop being top-level drawers and become filters on that stream.
3. **Rows show writing, not administration.** Title plus the first line; status as one mark.
   Views and comments remain, on the piece rather than in the list.
4. **The toolbar arrives when called.** No permanent strip. A selection raises the controls
   at the selection, the highlighter among them.
5. **Attributes are publish-time questions.** Slug, excerpt, terms and date move into a
   panel that opens on Publish, with slug and excerpt pre-filled from what was written.
6. **The rail holds four things**: the mark (home, which carries the numbers, so there is no
   separate Analytics screen), write, media, newsletter. Comments, trash, log and settings
   move behind one more click.

Consequences accepted deliberately:

- **`docs/admin-design.md` still governs.** One face for chrome, the reading face for the
  editor and its title, rank by size and weight, no ALL-CAPS. This ADR changes the SHAPE of
  the admin, never its typography.
- **The public reading interface is untouched.** No route, template or stylesheet under
  `src/web` that a reader sees changes for any of the six.
- **A search endpoint is a new owner-gated read route**, mounted on `OwnerRouter`
  ([invariant 4](../invariants.md)), not checked inside a handler.
- **Pages get their own FTS index**, mirroring `posts_fts` exactly rather than inventing a
  second mechanism. That is one migration, and it is the only schema change the six require.
- **Filtering moves from the client to the server.** The list currently ships every post to
  the browser and filters there, which is why it can only match what it already has. At a
  few thousand posts the array itself becomes the problem, so the direction is right on its
  own.

## Notes

The shape was agreed from a clickable mock rather than from prose, because what was wrong
was a feeling and prose cannot settle one. What the mock does NOT yet cover, and what
therefore is not decided here: inserting images, tables, mathematics and code from the
writing surface, and the media and newsletter screens themselves.
