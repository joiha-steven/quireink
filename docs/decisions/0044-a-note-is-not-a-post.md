# 0044 — A note is written like a post and kept apart from the posts

Date: 2026-09-09
Status: accepted

## Context

The reader's pen (0043) set out three tiers, and the third is a notebook of the reader's own:
every passage they mark on any site can be sent home, to their own Quire Ink, and kept there
with where it came from. That needs somewhere on the receiving blog for such things to land.

Two homes already existed and both were wrong. A **post** is a publication: it goes in the
feed, on the front page, into the newsletter's next issue and the archive's year, and it is
what a reader subscribes to. A kept passage from someone else's site is none of those things,
and a notebook that leaks into the feed is a feed nobody wants. A **page** has no date and no
list, and a notebook is exactly a dated list.

The owner's instruction was explicit on both halves: a note should work like a post — the
same editor, the same Markdown, a date, a status, an address — and it must not be mixed in
with the posts.

## Decision

**A third kind of writing, `notes`, with its own table, its own address and its own list.**
`/notes` lists every published note newest first; `/notes/{slug}` reads one. A note is never
in the post feed, the front page, the archive, the newsletter or the post's related list; it
IS in the sitemap and in `llms.txt`, under its own heading, because it is public writing.

**The slug lives in a namespace of its own.** Posts and pages share one `/{slug}` namespace
(Invariant 2); notes do not join it. A note called `about` and a page called `about` can
both exist, and `notes` itself joins `RESERVED_SLUGS` so no post can shadow the notebook.
A rename leaves a 301 under `/notes/`, as a post's does under `/`.

**A clip is a note with three more fields.** `source_url`, `source_title` and `quote` hold
where a passage came from and the passage itself, as COLUMNS rather than lines of Markdown,
because a later tier sends a Webmention to the source and a URL that has to be parsed back out
of prose is a URL that will be missed. A clip reads as the passage first, in a blockquote in
the reading face, then the owner's own words. The source is only ever an `http(s)` URL; anything
else is dropped at save.

**Written in the same editor.** The note editor is the page editor's sheet with a date and the
clip fields on its attributes panel; it autosaves under its own kind, keeps its draft in the
same safety net, and moves to the same Trash. In the Write list a note is one more kind beside
posts and pages, with its own scope tab and its own label on the row — mixed in the OWNER's
list, where a label is enough, and never in the READER's.

**Agents get the same five verbs.** `list_notes`, `get_note`, `create_note`, `update_note`,
`delete_note` (and `restore_note`) over the same data-layer functions the admin uses, so an
agent can keep a passage for the owner with where it came from. This is also the door the
third tier's Micropub endpoint will open onto.

## Consequences

- One table, one migration (`012-notes`), a search index shaped like the posts', and no
  change to any existing row. Fresh installs and existing ones arrive at the same shape.
- The public rendering is deliberately small: no comments, no series, no table of contents,
  no related. Those are a post's furniture, and a note that grows them has become a post.
- The notebook is a public page for a public note and nothing for a draft: the owner's
  private notes are drafts, seen only in the admin, and there is no half-public state. A
  visibility of its own can come with the tier that needs it.
- What this does NOT decide: how a passage arrives from another site. That is the next
  decision — the receiving door, then the open standards it speaks.
