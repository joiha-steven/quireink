# 0055 — The writing leaves as Markdown, and comes back the same way

Date: 2026-09-19
Status: accepted
In force: see the [index](README.md). The index is maintained; this file is not.

## Context

This software imports from four places — WordPress, Ghost, Substack, Medium — and exported to
none of them. The only way out was `/api/backup/export`, a tar.gz of two SQLite files and the
uploads tree, which restores **this** blog and which nothing else on earth can read.

The README makes a claim about that:

> Your writing is two SQLite files on your own disk. No account, no plan, no export button you
> have to hope still works in five years.

The second sentence was true of the hosted platforms it is aimed at and not true here. There
was no export button at all. An owner who wanted to move to Hugo, Astro, Eleventy, Ghost or
back to WordPress had two options: write a SQLite reader, or copy four hundred posts out of the
editor by hand. That is lock-in, arrived at by omission rather than by design, which is the
only kind this project could have arrived at.

It also undercuts the licence argument. [0050](0050-the-licence-opens-by-itself-after-48-months-without-a-release.md)
opens the licence after 48 months without a release, so that abandonment cannot trap anyone.
That promise is about the *software*. It says nothing about the *writing*, and the writing is
the part the owner made.

## Decision

**A second export: the writing, as a ZIP of Markdown files with YAML front matter.**

    posts/<slug>.md    every post, drafts included
    pages/<slug>.md
    notes/<slug>.md
    uploads/…          the blob store, paths unchanged
    site.json          the settings, whole
    README.md          what the bundle is, in English

Four choices inside that, each of which could have gone the other way.

**ZIP, not the tar.gz the backup uses.** The destination is somebody else's importer, and every
blog platform's importer takes a ZIP — including this one's, which has read `unzip.ts` since
Substack and Medium arrived. So the bundle needs no new reader to be re-imported here, and it
opens with a double click on every operating system. The cost is a ZIP **writer**, which did not
exist: `import/zip-write.ts`, about 200 lines, no dependency ([0053](0053-a-dependency-is-a-decision.md)),
because `node:zlib` ships raw deflate and a seedable CRC-32.

**Image paths are left exactly as the body holds them** — `/uploads/media/photo.webp`, absolute.
Rewriting them to be relative to the bundle would be lossy in one direction and unround-trippable
in the other. What is served on the live site is what is in the file, and the bundle's README
says the one thing a reader needs: put `uploads/` at your web root.

**Every string in the front matter is double-quoted.** YAML has nine ways to write a scalar and
eight of them have a case that bites — a title beginning `- `, holding `: `, reading `yes`, or
being empty is not itself unquoted. The double-quoted form has two characters to escape and no
exceptions. It is noisier and it cannot be got wrong.

**There is a reader, `import/quireink.ts`, and it is the point.** Not because anyone will move a
blog from Quire Ink to Quire Ink, but because an export whose losslessness is nobody's job stops
being lossless quietly: a field added to a post next month is a field the writer starts emitting
and nothing notices is unreadable. With a reader, "everything survives the round trip" is a test
that goes red in the same commit that breaks it. It is wired into `/api/import/archive` as a
fourth recognised shape, which makes coming back a real path rather than a theoretical one.

## What is deliberately not in it

Revisions, comments, subscribers, analytics, the activity log, sessions, and every credential.
This is the writing, not the install; the backup is one button along and holds all of it. The
settings go in whole rather than as a hand-picked list of fields, on the argument
`media/media-usage.ts` lost twice: a list goes stale and nothing says so. A test plants three
secrets in `integration_keys` and looks for them in the bundle, with a counter-test that a value
which *should* be there is found by the same search.

## Consequences

- **Two downloads in one card**, and the two sentences under them say which is which. An owner
  looking for either is looking for "let me take a copy away".
- **A ZIP writer is now ours to maintain.** Zip64 is written only when a field overflows, and
  the count-overflow branch is tested at 65,536 entries. The size-overflow branch is **not**
  exercised, because reaching it means writing four gigabytes; that is named in the test rather
  than left as a silence.
- **`ImportedPost` gained six optional fields** — series, order, cover, featured, meta title,
  meta description — because a Quire Ink bundle is an export of this shape rather than a
  conversion out of somebody else's. Declared rather than cast in: a cast there is the compiler
  being told to stop looking at exactly the fields whose survival is the point.
- **`ImportResult` gained `notes`**, optional, because no other platform has the kind
  ([0044](0044-a-note-is-not-a-post.md)).
- **The README's claim is now true**, and can be said plainly instead of implied.
